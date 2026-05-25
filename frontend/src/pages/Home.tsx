import { useState, useEffect, useCallback } from 'react';
import { tmdbService } from '../services/tmdb';
import type { Movie } from '../services/tmdb';
import { HeroBanner } from '../components/movies/HeroBanner';
import { MovieRow } from '../components/movies/MovieRow';
import { UserRow } from '../components/community/UserRow';
import { useAppContext } from '../context/AppContext';
import { dataService } from '../services/mockData';
import type { User } from '../services/mockData';
import { MoodSurveyModal } from '../components/surveys/MoodSurveyModal';

export const Home = () => {
    const { onboardingData } = useAppContext();
    const [isSurveyOpen, setIsSurveyOpen] = useState(false);

    const [heroMovie, setHeroMovie] = useState<Movie | undefined>();
    const [trending, setTrending] = useState<Movie[]>([]);
    const [recommended, setRecommended] = useState<Movie[]>([]);
    const [upcoming, setUpcoming] = useState<Movie[]>([]);
    const [moodPicks, setMoodPicks] = useState<Movie[]>([]);
    const [tamilMovies, setTamilMovies] = useState<Movie[]>([]);
    const [suggestedFriends, setSuggestedFriends] = useState<User[]>([]);

    // Per-row loading flags for progressive rendering
    const [loadingTrending, setLoadingTrending] = useState(true);
    const [loadingRecommended, setLoadingRecommended] = useState(true);
    const [loadingUpcoming, setLoadingUpcoming] = useState(true);
    const [loadingTamil, setLoadingTamil] = useState(true);
    const [loadingMood, setLoadingMood] = useState(true);
    const [loadingFriends, setLoadingFriends] = useState(true);

    const normalizeMoodForApi = useCallback((mood: string | null) => {
        if (!mood) return null;
        const map: Record<string, string> = {
            happy: 'happy', sad: 'sad', okay: 'relaxed',
            energetic: 'excited', tired: 'relaxed', relaxed: 'relaxed',
            excited: 'excited', romantic: 'romantic',
        };
        const key = mood.trim().toLowerCase();
        return map[key] || key;
    }, []);

    const normalizeMindsetForApi = useCallback((mindset: string | null) => {
        if (!mindset) return null;
        return mindset.trim().toLowerCase();
    }, []);

    const filterRenderableMovies = (input: Movie[]) =>
        input.filter((movie) => movie?.id && movie.poster_path && movie.title);

    // ── Progressive data fetching: each row loads independently ──
    useEffect(() => {
        // Trending
        (async () => {
            try {
                const data = await tmdbService.getTrendingMovies();
                const movies = filterRenderableMovies(data.results);
                setTrending(movies);
                if (movies.length > 0 && !heroMovie) {
                    setHeroMovie(movies[Math.floor(Math.random() * movies.length)]);
                }
            } catch { /* silent */ }
            setLoadingTrending(false);
        })();

        // Recommended
        (async () => {
            try {
                const data = await tmdbService.getRecommendedMovies();
                setRecommended(filterRenderableMovies(data.results));
            } catch { /* silent */ }
            setLoadingRecommended(false);
        })();

        // Upcoming
        (async () => {
            try {
                const data = await tmdbService.getUpcomingMovies();
                // Accept movies from 2024 onwards (not just 2026+) so the row isn't empty
                const movies = filterRenderableMovies(data.results).filter((m) => {
                    const year = new Date(m.release_date || '').getFullYear();
                    return Number.isFinite(year) && year >= 2024;
                });
                setUpcoming(movies);
            } catch { /* silent */ }
            setLoadingUpcoming(false);
        })();

        // Tamil — rely solely on backend /discover/tamil endpoint
        (async () => {
            try {
                const data = await tmdbService.getTamilMovies();
                setTamilMovies(filterRenderableMovies(data.results));
            } catch { /* silent */ }
            setLoadingTamil(false);
        })();

        // Suggested friends
        (async () => {
            try {
                const friends = await dataService.getSuggestedFriends();
                setSuggestedFriends(friends);
            } catch { /* silent */ }
            setLoadingFriends(false);
        })();

        // Mood picks (initial)
        (async () => {
            try {
                const data = await tmdbService.getMoodPicks({
                    mood: normalizeMoodForApi(onboardingData.mood),
                    mindset: normalizeMindsetForApi(onboardingData.mindset),
                    language: onboardingData.languages[0] || null,
                    genres: onboardingData.genres,
                });
                setMoodPicks(filterRenderableMovies(data.results));
            } catch { /* silent */ }
            setLoadingMood(false);
        })();

        // Show survey if not completed this session
        const hasCompletedSurvey = sessionStorage.getItem('hasCompletedMoodSurvey');
        if (!hasCompletedSurvey) {
            setTimeout(() => setIsSurveyOpen(true), 800);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Refresh mood picks when onboarding data changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoadingMood(true);
                const data = await tmdbService.getMoodPicks({
                    mood: normalizeMoodForApi(onboardingData.mood),
                    mindset: normalizeMindsetForApi(onboardingData.mindset),
                    language: onboardingData.languages[0] || null,
                    genres: onboardingData.genres,
                });
                if (!cancelled) {
                    setMoodPicks(filterRenderableMovies(data.results));
                }
            } catch { /* silent */ }
            if (!cancelled) setLoadingMood(false);
        })();
        return () => { cancelled = true; };
    }, [onboardingData.mood, onboardingData.mindset, onboardingData.languages.join(','), onboardingData.genres.join(',')]);

    // Hero auto-rotate
    useEffect(() => {
        if (trending.length === 0) return;
        const intervalId = setInterval(() => {
            setHeroMovie((current) => {
                if (!current) return trending[0];
                const idx = trending.findIndex((m) => m.id === current.id);
                return trending[(idx + 1) % trending.length];
            });
        }, 8000);
        return () => clearInterval(intervalId);
    }, [trending]);

    // Global loading = true only until hero has something to show
    const heroLoading = loadingTrending && !heroMovie;

    return (
        <div className="min-h-screen bg-background pb-20">
            <MoodSurveyModal
                isOpen={isSurveyOpen}
                onClose={() => setIsSurveyOpen(false)}
            />

            <HeroBanner movie={heroMovie} loading={heroLoading} />

            <div className="relative z-20 -mt-12 space-y-12 pb-12 max-w-7xl mx-auto w-full">
                <UserRow
                    title="Suggested Friends"
                    users={suggestedFriends}
                    loading={loadingFriends}
                />

                <MovieRow
                    title="Recommended for You"
                    movies={recommended}
                    loading={loadingRecommended}
                />

                <MovieRow
                    title="Trending Now"
                    movies={trending}
                    loading={loadingTrending}
                />

                <MovieRow
                    title="Kollywood (Tamil)"
                    movies={tamilMovies}
                    loading={loadingTamil}
                />

                {/* Personalized mood/mindset row */}
                <MovieRow
                    title={
                        onboardingData.mood && onboardingData.mindset
                            ? `Because you're ${onboardingData.mood} & ${onboardingData.mindset}`
                            : onboardingData.mood
                                ? `Because you're feeling ${onboardingData.mood}`
                                : onboardingData.mindset
                                    ? `Picks for "${onboardingData.mindset}" mood`
                                    : "Mood-based Picks"
                    }
                    movies={moodPicks}
                    loading={loadingMood}
                />

                <MovieRow
                    title="Upcoming Arrivals"
                    movies={upcoming}
                    loading={loadingUpcoming}
                />
            </div>
        </div>
    );
};
