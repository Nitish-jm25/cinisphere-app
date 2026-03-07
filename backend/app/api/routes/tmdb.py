import json
import socket
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings

router = APIRouter()
TMDB_BASE_URL = "https://api.themoviedb.org/3"
RETRYABLE_HTTP_STATUS_CODES = {429, 500, 502, 503, 504}
TMDB_CACHE_TTL_SECONDS = 300
_tmdb_response_cache: dict[str, tuple[float, dict]] = {}


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
            with urlopen(url, timeout=timeout_sec) as response:
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
    return _tmdb_get("/configuration")


@router.get("/trending")
def trending():
    return _tmdb_get("/trending/movie/week")


@router.get("/top-rated")
def top_rated():
    return _tmdb_get("/movie/top_rated")


@router.get("/upcoming")
def upcoming():
    return _tmdb_get("/movie/upcoming")


@router.get("/popular")
def popular():
    return _tmdb_get("/movie/popular")


@router.get("/discover/tamil")
def discover_tamil(page: int = Query(default=1, ge=1, le=500)):
    return _tmdb_get(
        "/discover/movie",
        {"with_original_language": "ta", "sort_by": "popularity.desc", "page": page},
    )


@router.get("/movie/{movie_id}")
def movie_details(movie_id: int):
    return _tmdb_get(f"/movie/{movie_id}", {"append_to_response": "videos,images"})


@router.get("/movie/{movie_id}/credits")
def movie_credits(movie_id: int):
    return _tmdb_get(f"/movie/{movie_id}/credits")


@router.get("/search")
def search_movies(query: str = Query(min_length=1), page: int = Query(default=1, ge=1, le=500)):
    return _tmdb_get(
        "/search/movie",
        {"query": query, "include_adult": "false", "page": page},
    )
