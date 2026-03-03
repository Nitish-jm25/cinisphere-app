import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings

router = APIRouter()
TMDB_BASE_URL = "https://api.themoviedb.org/3"


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

    try:
        with urlopen(url, timeout=15) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else str(exc)
        raise HTTPException(status_code=exc.code, detail=detail)
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"TMDB unreachable: {exc.reason}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
