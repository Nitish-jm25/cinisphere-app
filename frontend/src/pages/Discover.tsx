import './Discover.css';

import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ExternalLink, Sparkles, Star } from 'lucide-react';

import { MovieDetailsModal } from '../components/movies/MovieDetailsModal';
import { Skeleton } from '../components/ui/Skeleton';
import { tmdbService, type Movie, MOCK_GENRES } from '../services/tmdb';

const DISCOVER_SEARCH_QUERIES = [
    'a', 'e', 'i', 'o', 'u', 's', 'r', 'n', 't', 'l',
    'c', 'm', 'd', 'p', 'b', 'k', 'h', 'g', 'f', 'y',
    'th', 'an', 're', 'in', 'er', 'on', 'en', 'ar',
];
const TARGET_MOVIE_COUNT = 500;

type SphereTile = {
    movie: Movie;
    x: number;
    y: number;
    z: number;
    scale: number;
    opacity: number;
    rotateY: number;
    tilt: number;
};

const buildImageUrl = (path: string | null | undefined, size: 'w500' | 'original' = 'w500') => {
    if (!path) return '';
    return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${size}${path}`;
};

const buildImdbSearchUrl = (movie?: Movie) => {
    if (!movie) return 'https://www.imdb.com/';
    const query = [movie.title, safeYear(movie.release_date)].filter(Boolean).join(' ');
    return `https://www.imdb.com/find/?q=${encodeURIComponent(query)}&s=tt`;
};

const buildYoutubeEmbedUrl = (videoKey: string) =>
    `https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoKey}&modestbranding=1&rel=0&playsinline=1`;

const genresForMovie = (movie?: Movie) => {
    if (!movie) return [];
    return (movie.genre_ids || []).map((id) => MOCK_GENRES[id]).filter(Boolean);
};

const safeYear = (value?: string) => {
    const date = new Date(value || '');
    const year = date.getFullYear();
    return Number.isFinite(year) ? year : 'Now';
};

const dedupeMovies = (results: Movie[]) =>
    results
        .filter((movie, index, arr) => movie?.id && arr.findIndex((entry) => entry.id === movie.id) === index)
        .filter((movie) => movie.poster_path || movie.backdrop_path);

const toSafeNumber = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const isStrongDiscoverMovie = (movie?: Movie) => {
    if (!movie?.id || !movie.title) return false;
    if (!movie.poster_path) return false;
    if ((movie.overview || '').trim().length < 72) return false;
    if (toSafeNumber(movie.vote_average) < 6) return false;

    const voteCount = toSafeNumber(movie.vote_count);
    const popularity = toSafeNumber(movie.popularity);
    return voteCount >= 120 || popularity >= 30;
};

const rankMovies = (results: Movie[]) =>
    [...results].sort((left, right) => {
        const voteDelta = toSafeNumber(right.vote_average) - toSafeNumber(left.vote_average);
        if (voteDelta !== 0) return voteDelta;
        const voteCountDelta = toSafeNumber(right.vote_count) - toSafeNumber(left.vote_count);
        if (voteCountDelta !== 0) return voteCountDelta;
        return (right.title || '').localeCompare(left.title || '');
    });

const mergeMovieSets = (...sets: Movie[][]) => rankMovies(dedupeMovies(sets.flat()));

const buildSphereTiles = (pool: Movie[], count: number): SphereTile[] => {
    if (pool.length === 0) return [];

    const total = Math.min(count, Math.max(pool.length, 24));
    const radiusX = 280;
    const radiusY = 214;
    const radiusZ = 250;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    return Array.from({ length: total }, (_, index) => {
        const movie = pool[Math.floor((index / total) * pool.length) % pool.length];
        const yUnit = 1 - (index / Math.max(total - 1, 1)) * 2;
        const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
        const theta = goldenAngle * index;
        const x = Math.cos(theta) * radial * radiusX;
        const y = yUnit * radiusY;
        const z = Math.sin(theta) * radial * radiusZ;
        const depth = (z + radiusZ) / (radiusZ * 2);

        return {
            movie,
            x,
            y,
            z,
            scale: 0.54 + depth * 0.64,
            opacity: 0.24 + depth * 0.76,
            rotateY: (-theta * 180) / Math.PI,
            tilt: Math.sin(theta * 1.4) * 10,
        };
    }).sort((left, right) => left.z - right.z);
};

export const Discover = () => {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [rotation, setRotation] = useState(-16);
    const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
    const [featuredDetails, setFeaturedDetails] = useState<Movie | null>(null);
    const [featuredCast, setFeaturedCast] = useState<string[]>([]);
    const [featuredCrew, setFeaturedCrew] = useState<string[]>([]);
    const [recentMovieIds, setRecentMovieIds] = useState<number[]>([]);
    const [openDetails, setOpenDetails] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [stagePaused, setStagePaused] = useState(false);
    const [visibleTileCount, setVisibleTileCount] = useState(90);
    const [loadedBackdropUrl, setLoadedBackdropUrl] = useState('');
    const [isIdle, setIsIdle] = useState(false);

    const dragStartX = useRef<number | null>(null);
    const dragStartRotation = useRef(-16);
    const idleTimerRef = useRef<number | null>(null);
    const lastPointerXRef = useRef<number | null>(null);
    const lastPointerTimeRef = useRef<number | null>(null);
    const velocityRef = useRef(0);
    const momentumFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const loadMovieUniverse = async () => {
            setLoading(true);
            try {
                const [topRated, trending, upcoming, tamil] = await Promise.all([
                    tmdbService.getRecommendedMovies(),
                    tmdbService.getTrendingMovies(),
                    tmdbService.getUpcomingMovies(),
                    tmdbService.getTamilMovies(),
                ]);

                const merged = mergeMovieSets(
                    topRated.results,
                    trending.results,
                    upcoming.results,
                    tamil.results,
                ).filter(isStrongDiscoverMovie);

                setMovies(merged);
                setLoading(false);

                if (merged.length < TARGET_MOVIE_COUNT) {
                    const searchResponses = await Promise.allSettled(
                        DISCOVER_SEARCH_QUERIES.map((query) => tmdbService.searchMovies(query))
                    );
                    const searchResults = searchResponses.flatMap((result) =>
                        result.status === 'fulfilled' ? result.value.results : []
                    );

                    const expanded = mergeMovieSets(merged, searchResults).filter(isStrongDiscoverMovie);
                    setMovies(expanded);
                }
            } finally {
                setLoading(false);
            }
        };

        loadMovieUniverse();
    }, []);

    useEffect(() => {
        const updateVisibleTileCount = () => {
            const width = window.innerWidth;
            if (width < 640) {
                setVisibleTileCount(34);
                return;
            }
            if (width < 960) {
                setVisibleTileCount(56);
                return;
            }
            setVisibleTileCount(90);
        };

        updateVisibleTileCount();
        window.addEventListener('resize', updateVisibleTileCount);
        return () => window.removeEventListener('resize', updateVisibleTileCount);
    }, []);

    const deferredMovies = useDeferredValue(movies);
    const sphereTiles = useMemo(() => buildSphereTiles(deferredMovies, visibleTileCount), [deferredMovies, visibleTileCount]);

    useEffect(() => {
        if (!deferredMovies.some((movie) => movie.id === selectedMovieId)) {
            setSelectedMovieId(deferredMovies[0]?.id ?? null);
        }
    }, [deferredMovies, selectedMovieId]);

    useEffect(() => {
        if (!selectedMovieId) return;
        setRecentMovieIds((current) => {
            const next = [selectedMovieId, ...current.filter((id) => id !== selectedMovieId)];
            return next.slice(0, 8);
        });
    }, [selectedMovieId]);

    const featuredMovie = useMemo(() => {
        if (deferredMovies.length === 0) return undefined;
        return deferredMovies.find((movie) => movie.id === selectedMovieId) ?? deferredMovies[0];
    }, [deferredMovies, selectedMovieId]);

    const featuredGenres = genresForMovie(featuredMovie).slice(0, 3);
    const spotlightPoster = buildImageUrl(featuredMovie?.backdrop_path || featuredMovie?.poster_path, 'original');
    const featuredRating = toSafeNumber(featuredMovie?.vote_average);
    const imdbUrl = featuredDetails?.imdb_id
        ? `https://www.imdb.com/title/${featuredDetails.imdb_id}/`
        : buildImdbSearchUrl(featuredMovie);
    const featuredRuntime = toSafeNumber(featuredDetails?.runtime);
    const trailerKey = featuredDetails?.videos?.results?.find(
        (video) => video.site === 'YouTube' && ['Trailer', 'Teaser'].includes(video.type)
    )?.key;
    const teaserUrl = trailerKey ? buildYoutubeEmbedUrl(trailerKey) : '';

    useEffect(() => {
        if (!spotlightPoster) {
            setLoadedBackdropUrl('');
            return;
        }

        const image = new Image();
        image.src = spotlightPoster;
        image.onload = () => setLoadedBackdropUrl(spotlightPoster);
    }, [spotlightPoster]);

    useEffect(() => {
        if (!featuredMovie?.id) {
            setFeaturedDetails(null);
            setFeaturedCast([]);
            setFeaturedCrew([]);
            return;
        }

        let cancelled = false;

        tmdbService.getMovieDetails(String(featuredMovie.id))
            .then((details) => {
                if (!cancelled) setFeaturedDetails(details);
            })
            .catch(() => {
                if (!cancelled) setFeaturedDetails(null);
            });

        tmdbService.getMovieCredits(featuredMovie.id)
            .then((credits) => {
                if (!cancelled) {
                    const preferredCrewJobs = [
                        'Director',
                        'Writer',
                        'Screenplay',
                        'Story',
                        'Characters',
                        'Producer',
                        'Executive Producer',
                    ];

                    setFeaturedCast(
                        credits.cast
                            .slice(0, 3)
                            .map((member) => member.name)
                            .filter(Boolean)
                    );
                    setFeaturedCrew(
                        credits.crew
                            .filter((member) => preferredCrewJobs.includes(member.job))
                            .map((member) => member.name)
                            .filter(Boolean)
                            .filter((name, index, arr) => arr.indexOf(name) === index)
                            .slice(0, 3)
                    );
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setFeaturedCast([]);
                    setFeaturedCrew([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [featuredMovie?.id]);

    useEffect(() => {
        const clearIdleTimer = () => {
            if (idleTimerRef.current !== null) {
                window.clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
        };

        const scheduleIdle = () => {
            clearIdleTimer();
            setIsIdle(false);
            idleTimerRef.current = window.setTimeout(() => setIsIdle(true), 2600);
        };

        scheduleIdle();

        window.addEventListener('pointermove', scheduleIdle);
        window.addEventListener('keydown', scheduleIdle);

        return () => {
            clearIdleTimer();
            window.removeEventListener('pointermove', scheduleIdle);
            window.removeEventListener('keydown', scheduleIdle);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (momentumFrameRef.current !== null) {
                window.cancelAnimationFrame(momentumFrameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isIdle || dragging || stagePaused) return;
        const frame = window.setTimeout(() => {
            setRotation((current) => current + (0 - current) * 0.08);
        }, 32);

        return () => window.clearTimeout(frame);
    }, [isIdle, dragging, rotation, stagePaused]);

    useEffect(() => {
        if (!deferredMovies.length || selectedMovieId === null) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;

            const currentIndex = deferredMovies.findIndex((movie) => movie.id === selectedMovieId);
            if (currentIndex === -1) return;

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setSelectedMovieId(deferredMovies[(currentIndex + 1) % deferredMovies.length].id);
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setSelectedMovieId(deferredMovies[(currentIndex - 1 + deferredMovies.length) % deferredMovies.length].id);
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                setOpenDetails(true);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [deferredMovies, selectedMovieId]);

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('.discover-card, .discover-open-btn, .discover-secondary-btn')) {
            return;
        }
        if (momentumFrameRef.current !== null) {
            window.cancelAnimationFrame(momentumFrameRef.current);
            momentumFrameRef.current = null;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartX.current = event.clientX;
        dragStartRotation.current = rotation;
        lastPointerXRef.current = event.clientX;
        lastPointerTimeRef.current = performance.now();
        velocityRef.current = 0;
        setIsIdle(false);
        setDragging(true);
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragStartX.current === null) return;
        const now = performance.now();
        if (lastPointerXRef.current !== null && lastPointerTimeRef.current !== null) {
            const deltaX = event.clientX - lastPointerXRef.current;
            const deltaTime = Math.max(now - lastPointerTimeRef.current, 1);
            velocityRef.current = deltaX / deltaTime;
        }
        lastPointerXRef.current = event.clientX;
        lastPointerTimeRef.current = now;
        const delta = event.clientX - dragStartX.current;
        setIsIdle(false);
        setRotation(dragStartRotation.current + delta * 0.18);
    };

    const onPointerUp = (event?: React.PointerEvent<HTMLDivElement>) => {
        if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragStartX.current = null;
        lastPointerXRef.current = null;
        lastPointerTimeRef.current = null;
        setDragging(false);

        const animateMomentum = () => {
            velocityRef.current *= 0.94;
            if (Math.abs(velocityRef.current) < 0.005) {
                momentumFrameRef.current = null;
                return;
            }
            setRotation((current) => current + velocityRef.current * 10);
            momentumFrameRef.current = window.requestAnimationFrame(animateMomentum);
        };

        if (Math.abs(velocityRef.current) >= 0.005) {
            momentumFrameRef.current = window.requestAnimationFrame(animateMomentum);
        }
    };

    if (loading || !featuredMovie) {
        return (
            <div className="discover-page">
                <div className="discover-shell">
                    <Skeleton variant="hero" className="h-[84vh] rounded-[2rem]" />
                </div>
            </div>
        );
    }

    const focusTile = sphereTiles.find((tile) => tile.movie.id === featuredMovie.id);
    const recentMovies = recentMovieIds
        .map((id) => deferredMovies.find((movie) => movie.id === id))
        .filter((movie): movie is Movie => Boolean(movie));
    const focusFacts = [
        featuredRuntime > 0 ? { label: 'Runtime', value: `${featuredRuntime} min` } : null,
        featuredCast.length ? { label: 'Cast', value: featuredCast.join(', '), wide: true } : null,
        !featuredCast.length && featuredCrew.length ? { label: 'Crew', value: featuredCrew.join(', '), wide: true } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; wide?: boolean }>;

    return (
        <div className="discover-page">
            <div className="discover-shell">
                <section className="discover-hero">
                    <div className="discover-topbar">
                        <div className="discover-badge">
                            <Sparkles className="h-4 w-4" />
                            <span>Discover Cinematic Globe</span>
                        </div>
                    </div>

                    <div
                        className="discover-stage"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={() => onPointerUp()}
                        onMouseEnter={() => setStagePaused(true)}
                        onMouseLeave={() => setStagePaused(false)}
                    >
                        {teaserUrl ? (
                            <div className="discover-teaser-wrap" aria-hidden="true">
                                <iframe
                                    className="discover-teaser-frame"
                                    src={teaserUrl}
                                    title={`${featuredMovie.title} teaser`}
                                    allow="autoplay; encrypted-media; picture-in-picture"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    tabIndex={-1}
                                />
                            </div>
                        ) : null}
                        <div
                            className="discover-spotlight"
                            style={loadedBackdropUrl ? { backgroundImage: `url(${loadedBackdropUrl})` } : undefined}
                        />
                        <div className="discover-stage-vignette" />
                        <div className="discover-stage-noise" />

                        <div className="discover-overlay discover-overlay--left">
                            <div className="discover-progress">
                                <Star className="h-5 w-5 fill-current" />
                                <span className="discover-progress-value">{featuredRating.toFixed(1)}</span>
                            </div>

                            <div className="discover-copy">
                                <div className="discover-copy-tags">
                                    {featuredGenres.map((genre) => (
                                        <span key={genre} className="discover-genre-chip">{genre}</span>
                                    ))}
                                </div>
                                <h1 className="discover-title">{featuredMovie.title}</h1>
                                <p className="discover-meta">
                                    {safeYear(featuredMovie.release_date)} | {featuredRating.toFixed(1)} rating
                                </p>
                                <p className="discover-overview">{featuredMovie.overview}</p>

                                <div className="discover-actions">
                                    <a
                                        href={imdbUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        className="discover-open-btn"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        More Info
                                    </a>
                                    <button
                                        type="button"
                                        className="discover-secondary-btn"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenDetails(true);
                                        }}
                                    >
                                        Quick View
                                    </button>
                                </div>

                                {focusFacts.length ? (
                                    <div className="discover-focus-panel">
                                        <span className="discover-focus-kicker">Focus Panel</span>
                                        <div className={`discover-focus-grid ${focusFacts.length === 1 ? 'is-single' : ''}`}>
                                            {focusFacts.map((fact) => (
                                                <div key={fact.label} className={fact.wide ? 'discover-focus-cast' : undefined}>
                                                    <label>{fact.label}</label>
                                                    <strong>{fact.value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="discover-overlay discover-overlay--center">
                            <div
                                className="discover-globe-shell"
                                style={{ '--manual-rotation': `${rotation}deg` } as CSSProperties}
                            >
                                <div className={`discover-globe ${dragging || stagePaused ? 'is-paused' : ''}`}>
                                    <div className="discover-globe-core" />
                                    <div className="discover-globe-ring discover-globe-ring--outer" />
                                    <div className="discover-globe-ring discover-globe-ring--mid" />
                                    <div className="discover-globe-ring discover-globe-ring--inner" />
                                    <div className="discover-depth-fog discover-depth-fog--back" />
                                    <div className="discover-depth-fog discover-depth-fog--front" />
                                    {focusTile ? (
                                        <div
                                            className="discover-focus-halo"
                                            style={{
                                                transform: `translate3d(${focusTile.x}px, ${focusTile.y}px, ${focusTile.z - 2}px) scale(${focusTile.scale * 1.16})`,
                                                zIndex: Math.round(focusTile.z + 401),
                                            }}
                                        />
                                    ) : null}

                                    {sphereTiles.map((tile, index) => {
                                        const isFeatured = tile.movie.id === featuredMovie.id;
                                        const depthMix = (tile.z + 250) / 500;

                                        return (
                                            <button
                                                key={`${tile.movie.id}-${index}`}
                                                type="button"
                                                className={`discover-card ${isFeatured ? 'is-featured' : ''}`}
                                                style={{
                                                    transform: `translate3d(${tile.x}px, ${tile.y}px, ${tile.z}px) rotateX(${tile.y * -0.03}deg) rotateY(${tile.rotateY}deg) rotateZ(${tile.tilt}deg) scale(${tile.scale})`,
                                                    opacity: tile.opacity,
                                                    filter: `brightness(${0.66 + depthMix * 0.62}) saturate(${0.74 + depthMix * 0.54}) blur(${(1 - depthMix) * 0.9}px)`,
                                                    zIndex: Math.round(tile.z + 400),
                                                }}
                                                onPointerDown={(event) => event.stopPropagation()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedMovieId(tile.movie.id);
                                                }}
                                            >
                                                <img
                                                    src={buildImageUrl(tile.movie.poster_path)}
                                                    alt={tile.movie.title}
                                                    className="discover-card-image"
                                                    loading="lazy"
                                                />
                                                <span className="discover-card-title">{tile.movie.title}</span>
                                            </button>
                                        );
                                    })}

                                    <div className="discover-globe-label">
                                        <span className="discover-globe-label-kicker">featured</span>
                                        <strong>{featuredMovie.title}</strong>
                                        <div className="discover-globe-meta">
                                            <span>{safeYear(featuredMovie.release_date)}</span>
                                            <span>{featuredRating.toFixed(1)}</span>
                                            {featuredRuntime > 0 ? <span>{featuredRuntime} min</span> : null}
                                            <span>{featuredGenres[0] || 'Cinema'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                    {recentMovies.length > 0 ? (
                        <div className="discover-rail">
                            <span className="discover-rail-label">Recently Viewed</span>
                            <div className="discover-rail-track">
                                {recentMovies.map((movie) => (
                                    <button
                                        key={movie.id}
                                        type="button"
                                        className={`discover-rail-card ${movie.id === featuredMovie.id ? 'is-active' : ''}`}
                                        onClick={() => setSelectedMovieId(movie.id)}
                                    >
                                        <img
                                            src={buildImageUrl(movie.poster_path)}
                                            alt={movie.title}
                                            className="discover-rail-image"
                                            loading="lazy"
                                        />
                                        <span className="discover-rail-title">{movie.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>

            {openDetails && featuredMovie && (
                <MovieDetailsModal movie={featuredMovie} onClose={() => setOpenDetails(false)} />
            )}
        </div>
    );
};
