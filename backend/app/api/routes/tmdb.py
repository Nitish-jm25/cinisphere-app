import json
import random
import socket
import time
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import ProxyHandler, build_opener

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.db.mongo import get_movies_collection

router = APIRouter()
TMDB_BASE_URL = "https://api.themoviedb.org/3"
RETRYABLE_HTTP_STATUS_CODES = {429, 500, 502, 503, 504}
TMDB_CACHE_TTL_SECONDS = 300
_tmdb_response_cache: dict[str, tuple[float, dict]] = {}
_tmdb_opener = build_opener(ProxyHandler({}))
_movies_collection = get_movies_collection()
_GENRE_NAME_TO_ID = {
    "action": 28,
    "adventure": 12,
    "animation": 16,
    "comedy": 35,
    "crime": 80,
    "documentary": 99,
    "drama": 18,
    "family": 10751,
    "fantasy": 14,
    "history": 36,
    "horror": 27,
    "music": 10402,
    "mystery": 9648,
    "romance": 10749,
    "sci-fi": 878,
    "science fiction": 878,
    "tv movie": 10770,
    "thriller": 53,
    "war": 10752,
    "western": 37,
}
_ONBOARDING_GENRE_TO_ID = {
    "action": 28,
    "comedy": 35,
    "romance": 10749,
    "horror": 27,
    "drama": 18,
    "scifi": 878,
    "sci-fi": 878,
    "science fiction": 878,
}
_MOOD_TO_GENRE_IDS = {
    "happy": {35, 10751, 12, 16},
    "sad": {18, 10749, 36},
    "stressed": {35, 10751, 16},
    "romantic": {10749, 18, 35},
    "excited": {28, 12, 878, 53},
    "relaxed": {35, 18, 99},
}


def _extract_genre_ids(genres_raw) -> list[int]:
    if not isinstance(genres_raw, list):
        return []
    ids: list[int] = []
    for g in genres_raw:
        if isinstance(g, dict):
            name = str(g.get("name", "")).strip().lower()
        else:
            name = str(g).strip().lower()
        gid = _GENRE_NAME_TO_ID.get(name)
        if gid and gid not in ids:
            ids.append(gid)
    return ids


def _extract_genre_objects(genres_raw) -> list[dict]:
    if not isinstance(genres_raw, list):
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for g in genres_raw:
        if isinstance(g, dict):
            name = str(g.get("name", "")).strip()
        else:
            name = str(g).strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"id": _GENRE_NAME_TO_ID.get(key, 0), "name": name})
    return out


def _to_tmdb_result(doc: dict) -> dict:
    try:
        vote_average = float(doc.get("vote_average") or 0)
        if vote_average != vote_average:  # NaN check
            vote_average = 0.0
    except Exception:
        vote_average = 0.0
    try:
        vote_count = int(float(doc.get("vote_count") or 0))
    except Exception:
        vote_count = 0
    try:
        popularity = float(doc.get("popularity") or 0)
        if popularity != popularity:  # NaN check
            popularity = 0.0
    except Exception:
        popularity = 0.0

    release_date_raw = str(doc.get("release_date") or "").strip()
    if not release_date_raw or release_date_raw.lower() == "nan":
        release_date_raw = ""

    tmdb_id = int(doc.get("tmdb_id") or doc.get("movie_id") or 0)
    poster = doc.get("poster_path")
    backdrop = doc.get("backdrop_path") or poster
    genres_raw = doc.get("genres") or []
    return {
        "id": tmdb_id,
        "movie_id": int(doc.get("movie_id") or tmdb_id),
        "tmdb_id": tmdb_id,
        "title": doc.get("title") or "Untitled",
        "poster_path": poster,
        "backdrop_path": backdrop,
        "overview": doc.get("overview") or "",
        "vote_average": vote_average,
        "vote_count": vote_count,
        "popularity": popularity,
        "release_date": release_date_raw,
        "genre_ids": _extract_genre_ids(genres_raw),
        "genres": _extract_genre_objects(genres_raw),
    }


def _mongo_list(query: dict, sort_fields: list[tuple[str, int]], page: int = 1, per_page: int = 20, shuffle: bool = True) -> dict:
    base_query = {
        "$and": [
            query or {},
            {"title": {"$nin": [None, ""]}},
            {"poster_path": {"$nin": [None, "", "/vite.svg"]}},
        ]
    }
    pool_size = max(per_page * 5, 80)
    docs = list(_movies_collection.find(base_query, {"_id": 0}).sort(sort_fields).limit(pool_size))
    if docs and shuffle:
        random.shuffle(docs)
    start = max((page - 1) * per_page, 0)
    results = [_to_tmdb_result(d) for d in docs[start:start + per_page]]
    return {"page": page, "results": results, "total_results": len(docs), "total_pages": 1}


def _mongo_search(query: str, page: int = 1, per_page: int = 20) -> dict:
    regex = {"$regex": query, "$options": "i"}
    docs = list(
        _movies_collection.find(
            {
                "$and": [
                    {"title": regex},
                    {"poster_path": {"$nin": [None, "", "/vite.svg"]}},
                ]
            },
            {"_id": 0},
        )
        .sort([("popularity", -1), ("vote_average", -1), ("vote_count", -1)])
        .limit(max(per_page * 5, 80))
    )
    results = [_to_tmdb_result(d) for d in docs[:per_page]]
    return {"page": page, "results": results, "total_results": len(docs), "total_pages": 1}


def _mongo_movie_details(movie_id: int) -> dict:
    doc = _movies_collection.find_one(
        {"$or": [{"tmdb_id": movie_id}, {"movie_id": movie_id}]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Movie not found")
    out = _to_tmdb_result(doc)
    out["runtime"] = int(doc.get("runtime") or 0)
    out["videos"] = {"results": []}
    out["images"] = {"backdrops": [{"file_path": out["backdrop_path"]}]}
    return out


def _parse_people_list(raw_value) -> list[dict]:
    if not raw_value:
        return []
    if isinstance(raw_value, list):
        items = raw_value
    else:
        items = [raw_value]

    out: list[dict] = []
    seen: set[str] = set()
    for item in items:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip()
            character = str(item.get("character") or item.get("role") or "").strip()
            job = str(item.get("job") or item.get("department") or "").strip()
            profile_path = item.get("profile_path")
        else:
            name = str(item).strip()
            character = ""
            job = ""
            profile_path = None

        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "id": len(out) + 1,
            "name": name,
            "character": character,
            "job": job,
            "department": "",
            "profile_path": profile_path,
        })
    return out


def _mongo_movie_credits(movie_id: int) -> dict:
    doc = _movies_collection.find_one(
        {"$or": [{"tmdb_id": movie_id}, {"movie_id": movie_id}]},
        {"_id": 0},
    )
    if not doc:
        return {"id": movie_id, "cast": [], "crew": []}

    cast = _parse_people_list(doc.get("cast") or doc.get("actors") or doc.get("top_cast"))
    crew_source = doc.get("crew")
    if not crew_source:
        crew_bits = []
        for field_name, job in (
            ("director", "Director"),
            ("directors", "Director"),
            ("writer", "Writer"),
            ("writers", "Writer"),
            ("screenplay", "Screenplay"),
            ("producer", "Producer"),
            ("producers", "Producer"),
        ):
            raw = doc.get(field_name)
            for item in _parse_people_list(raw):
                item["job"] = item["job"] or job
                crew_bits.append(item)
        crew = crew_bits
    else:
        crew = _parse_people_list(crew_source)

    return {"id": movie_id, "cast": cast, "crew": crew}


def _parse_genre_ids(genres_csv: str | None, mood: str | None) -> set[int]:
    out: set[int] = set()
    if genres_csv:
        for raw in str(genres_csv).split(","):
            token = raw.strip().lower()
            if not token:
                continue
            gid = _ONBOARDING_GENRE_TO_ID.get(token) or _GENRE_NAME_TO_ID.get(token)
            if gid:
                out.add(gid)
    mood_key = (mood or "").strip().lower()
    out.update(_MOOD_TO_GENRE_IDS.get(mood_key, set()))
    return out


def _mongo_mood_picks(
    mood: str | None,
    language: str | None,
    genres_csv: str | None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    query: dict = {
        "title": {"$nin": [None, ""]},
        "poster_path": {"$nin": [None, "", "/vite.svg"]},
        "vote_average": {"$gte": 6.8},
        "vote_count": {"$gte": 80},
    }
    lang = (language or "").strip().lower()
    if lang:
        query["original_language"] = lang

    pool = list(
        _movies_collection.find(query, {"_id": 0})
        .sort([("vote_average", -1), ("vote_count", -1), ("popularity", -1)])
        .limit(600)
    )
    if not pool and lang:
        query.pop("original_language", None)
        pool = list(
            _movies_collection.find(query, {"_id": 0})
            .sort([("vote_average", -1), ("vote_count", -1), ("popularity", -1)])
            .limit(600)
        )

    desired_genres = _parse_genre_ids(genres_csv, mood)
    scored: list[tuple[float, dict]] = []
    for doc in pool:
        item = _to_tmdb_result(doc)
        vote_avg = float(item.get("vote_average") or 0.0)
        vote_count = float(item.get("vote_count") or 0.0)
        popularity = float(item.get("popularity") or 0.0)
        quality_score = (vote_avg * 0.72) + (min(vote_count, 5000) / 5000 * 1.4) + (min(popularity, 1000) / 1000 * 0.9)
        genre_match_bonus = 0.0
        if desired_genres and set(item.get("genre_ids", [])).intersection(desired_genres):
            genre_match_bonus = 1.8
        random_bonus = random.uniform(0, 0.25)
        scored.append((quality_score + genre_match_bonus + random_bonus, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    ranked = [item for _, item in scored]
    start = max((page - 1) * per_page, 0)
    results = ranked[start:start + per_page]
    return {"page": page, "results": results, "total_results": len(ranked), "total_pages": 1}


def _tmdb_enabled() -> bool:
    return bool(settings.TMDB_API_KEY) and not settings.TMDB_USE_MONGO_ONLY


def _cache_key(path: str, params: dict | None) -> str:
    query_items = tuple(sorted((params or {}).items()))
    return f"{path}|{query_items}"


def _get_cached_response(cache_key: str) -> dict | None:
    cached = _tmdb_response_cache.get(cache_key)
    if not cached:
        return None
    expires_at, payload = cached
    if time.time() > expires_at:
        _tmdb_response_cache.pop(cache_key, None)
        return None
    return payload


def _set_cached_response(cache_key: str, payload: dict) -> None:
    _tmdb_response_cache[cache_key] = (time.time() + TMDB_CACHE_TTL_SECONDS, payload)


def _tmdb_get(path: str, params: dict | None = None):
    if not settings.TMDB_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="TMDB_API_KEY is not set on backend",
        )

    query = {"api_key": settings.TMDB_API_KEY}
    if params:
        query.update(params)

    url = f"{TMDB_BASE_URL}{path}?{urlencode(query)}"
    cache_key = _cache_key(path, params)
    max_retries = max(settings.TMDB_MAX_RETRIES, 1)
    timeout_sec = max(settings.TMDB_TIMEOUT_SECONDS, 1)
    base_delay = max(settings.TMDB_RETRY_BASE_DELAY_SECONDS, 0.1)
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            with _tmdb_opener.open(url, timeout=timeout_sec) as response:
                payload = response.read().decode("utf-8")
                parsed = json.loads(payload)
                _set_cached_response(cache_key, parsed)
                return parsed
        except HTTPError as exc:
            detail = exc.read().decode("utf-8") if exc.fp else str(exc)
            if exc.code in RETRYABLE_HTTP_STATUS_CODES and attempt < max_retries:
                time.sleep(base_delay * (2 ** (attempt - 1)))
                continue
            cached_payload = _get_cached_response(cache_key)
            if cached_payload is not None:
                return cached_payload
            raise HTTPException(status_code=exc.code, detail=detail)
        except (URLError, TimeoutError, socket.timeout) as exc:
            last_error = exc
            if attempt < max_retries:
                time.sleep(base_delay * (2 ** (attempt - 1)))
                continue
            cached_payload = _get_cached_response(cache_key)
            if cached_payload is not None:
                return cached_payload
            raise HTTPException(
                status_code=504,
                detail="TMDB request timed out or network is unreachable",
            )
        except json.JSONDecodeError as exc:
            cached_payload = _get_cached_response(cache_key)
            if cached_payload is not None:
                return cached_payload
            raise HTTPException(status_code=502, detail=f"Invalid TMDB response format: {exc}")
        except Exception as exc:
            last_error = exc
            if attempt < max_retries:
                time.sleep(base_delay * (2 ** (attempt - 1)))
                continue
            cached_payload = _get_cached_response(cache_key)
            if cached_payload is not None:
                return cached_payload
            raise HTTPException(status_code=502, detail=f"TMDB request failed: {exc}")

    cached_payload = _get_cached_response(cache_key)
    if cached_payload is not None:
        return cached_payload

    raise HTTPException(
        status_code=502,
        detail=f"TMDB request failed after retries: {last_error}",
    )


@router.get("/configuration")
def configuration():
    if _tmdb_enabled():
        return _tmdb_get("/configuration")
    return {"images": {"secure_base_url": "https://image.tmdb.org/t/p/", "poster_sizes": ["w500"], "backdrop_sizes": ["original"]}}


@router.get("/trending")
def trending():
    if _tmdb_enabled():
        try:
            return _tmdb_get("/trending/movie/week")
        except HTTPException:
            pass
    return _mongo_list({}, [("popularity", -1), ("vote_average", -1), ("vote_count", -1)])


@router.get("/top-rated")
def top_rated():
    if _tmdb_enabled():
        try:
            return _tmdb_get("/movie/top_rated")
        except HTTPException:
            pass
    return _mongo_list({}, [("vote_average", -1), ("vote_count", -1), ("popularity", -1)])


@router.get("/upcoming")
def upcoming():
    if _tmdb_enabled():
        try:
            return _tmdb_get("/movie/upcoming")
        except HTTPException:
            pass
    primary = _mongo_list(
        {
            "release_date": {"$regex": r"^\d{4}-\d{2}-\d{2}$", "$gte": date.today().isoformat()},
            "vote_average": {"$gte": 5.5},
        },
        [("release_date", 1), ("vote_average", -1), ("vote_count", -1), ("popularity", -1)],
        shuffle=False,
    )
    if len(primary.get("results", [])) >= 12:
        return primary

    # Fallback: fill with recent high-rated releases to keep row populated.
    fallback = _mongo_list(
        {
            "release_date": {"$regex": r"^\d{4}-\d{2}-\d{2}$", "$gte": "2023-01-01"},
            "vote_average": {"$gte": 6.5},
            "vote_count": {"$gte": 120},
        },
        [("release_date", -1), ("vote_average", -1), ("vote_count", -1), ("popularity", -1)],
        shuffle=False,
    )
    merged = []
    seen: set[int] = set()
    for item in primary.get("results", []) + fallback.get("results", []):
        mid = int(item.get("id") or 0)
        if mid <= 0 or mid in seen:
            continue
        seen.add(mid)
        merged.append(item)
        if len(merged) >= 20:
            break
    return {"page": 1, "results": merged, "total_results": len(merged), "total_pages": 1}


@router.get("/popular")
def popular():
    if _tmdb_enabled():
        try:
            return _tmdb_get("/movie/popular")
        except HTTPException:
            pass
    return _mongo_list({}, [("popularity", -1), ("vote_average", -1), ("vote_count", -1)])


@router.get("/mood-picks")
def mood_picks(
    mood: str | None = Query(default=None),
    language: str | None = Query(default=None),
    genres: str | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=500),
):
    return _mongo_mood_picks(mood=mood, language=language, genres_csv=genres, page=page)


@router.get("/discover/tamil")
def discover_tamil(page: int = Query(default=1, ge=1, le=500)):
    if _tmdb_enabled():
        try:
            return _tmdb_get(
                "/discover/movie",
                {"with_original_language": "ta", "sort_by": "popularity.desc", "page": page},
            )
        except HTTPException:
            pass
    return _mongo_list(
        {
            "original_language": {"$regex": "^(ta|tamil)$", "$options": "i"},
            "vote_average": {"$gte": 6.8},
            "vote_count": {"$gte": 80},
        },
        [("vote_average", -1), ("vote_count", -1), ("popularity", -1), ("release_date", -1)],
        page=page,
        shuffle=False,
    )


@router.get("/movie/{movie_id}")
def movie_details(movie_id: int):
    if _tmdb_enabled():
        try:
            return _tmdb_get(f"/movie/{movie_id}", {"append_to_response": "videos,images"})
        except HTTPException:
            pass
    return _mongo_movie_details(movie_id)


@router.get("/movie/{movie_id}/credits")
def movie_credits(movie_id: int):
    if _tmdb_enabled():
        try:
            return _tmdb_get(f"/movie/{movie_id}/credits")
        except HTTPException:
            pass
    return _mongo_movie_credits(movie_id)


@router.get("/search")
def search_movies(query: str = Query(min_length=1), page: int = Query(default=1, ge=1, le=500)):
    if _tmdb_enabled():
        try:
            return _tmdb_get(
                "/search/movie",
                {"query": query, "include_adult": "false", "page": page},
            )
        except HTTPException:
            pass
    return _mongo_search(query=query, page=page)
