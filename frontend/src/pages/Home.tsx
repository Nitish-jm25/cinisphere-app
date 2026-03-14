import { useState, useEffect } from 'react';
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
    const fallbackSearchQueries = ['love', 'war', 'dark', 'moon', 'city', 'king'];
    const tamilFallbackSearchQueries = ['raja', 'veer', 'amma', 'kaadhal', 'thalapathy', 'nayakan'];
    const upcomingFallbackSearchQueries = ['2026', 'future', 'next', 'new'];
    const { onboardingData } = useAppContext();
    const [isSurveyOpen, setIsSurveyOpen] = useState(false);

    const [heroMovie, setHeroMovie] = useState<Movie | undefined>();
    const [trending, setTrending] = useState<Movie[]>([]);
    const [recommended, setRecommended] = useState<Movie[]>([]);
    const [upcoming, setUpcoming] = useState<Movie[]>([]);
    const [moodPicks, setMoodPicks] = useState<Movie[]>([]);
    const [tamilMovies, setTamilMovies] = useState<Movie[]>([]);
    const [suggestedFriends, setSuggestedFriends] = useState<User[]>([]);

    const [loading, setLoading] = useState(true);

    const normalizeMoodForApi = (mood: string | null) => {
        if (!mood) return null;
        const map: Record<string, string> = {
            happy: 'happy',
            sad: 'sad',
            okay: 'relaxed',
            energetic: 'excited',
            tired: 'relaxed',
            relaxed: 'relaxed',
            excited: 'excited',
            romantic: 'romantic',
        };
        const key = mood.trim().toLowerCase();
        return map[key] || key;
    };

    const filterRenderableMovies = (input: Movie[]) =>
        input.filter((movie) => movie?.id && movie.poster_path && movie.title);

    const isUpcomingMovie = (movie: Movie) => {
        const year = new Date(movie.release_date || '').getFullYear();
        return Number.isFinite(year) && year >= 2026;
    };

    const looksTamil = (movie: Movie) => {
        const title = (movie.title || '').toLowerCase();
        const overview = (movie.overview || '').toLowerCase();
        const text = `${title} ${overview}`;
        return ['tamil', 'kollywood', 'chennai', 'raja', 'amma', 'kaadhal', 'veer', 'nayakan'].some((token) =>
            text.includes(token)
        );
    };

    const uniqueMovies = (input: Movie[], seen?: Set<number>, limit = 20): Movie[] => {
        const out: Movie[] = [];
        for (const movie of input) {
            if (!movie?.id || (seen && seen.has(movie.id))) continue;
            seen?.add(movie.id);
            out.push(movie);
            if (out.length >= limit) break;
        }
        return out;
    };

    useEffect(() => {
        const fetchHomeData = async () => {
            setLoading(true);
            try {
                const [
                    trendingResult,
                    recommendedResult,
                    upcomingResult,
                    tamilResult,
                    friendsResult
                ] = await Promise.allSettled([
                    tmdbService.getTrendingMovies(),
                    tmdbService.getRecommendedMovies(),
                    tmdbService.getUpcomingMovies(),
                    tmdbService.getTamilMovies(),
                    dataService.getSuggestedFriends()
                ]);

                const recommendedBase = recommendedResult.status === 'fulfilled' ? filterRenderableMovies(recommendedResult.value.results) : [];
                const trendingBase = trendingResult.status === 'fulfilled' ? filterRenderableMovies(trendingResult.value.results) : [];
                const upcomingBase = upcomingResult.status === 'fulfilled'
                    ? filterRenderableMovies(upcomingResult.value.results).filter(isUpcomingMovie)
                    : [];
                const tamilBase = tamilResult.status === 'fulfilled' ? filterRenderableMovies(tamilResult.value.results) : [];
                let fallbackPool = uniqueMovies([
                    ...recommendedBase,
                    ...trendingBase,
                    ...upcomingBase,
                    ...tamilBase,
                ], undefined, 40);

                if (fallbackPool.length < 12) {
                    const searchResults = await Promise.allSettled(
                        fallbackSearchQueries.map((query) => tmdbService.searchMovies(query))
                    );
                    const backupMovies = searchResults.flatMap((result) =>
                        result.status === 'fulfilled' ? filterRenderableMovies(result.value.results) : []
                    );
                    fallbackPool = uniqueMovies([...fallbackPool, ...backupMovies], undefined, 60);
                }

                const [tamilSearchResults, upcomingSearchResults] = await Promise.all([
                    Promise.allSettled(tamilFallbackSearchQueries.map((query) => tmdbService.searchMovies(query))),
                    Promise.allSettled(upcomingFallbackSearchQueries.map((query) => tmdbService.searchMovies(query))),
                ]);

                const tamilFallbackPool = uniqueMovies(
                    tamilSearchResults.flatMap((result) =>
                        result.status === 'fulfilled'
                            ? filterRenderableMovies(result.value.results).filter(looksTamil)
                            : []
                    ),
                    undefined,
                    40
                );

                const upcomingFuturePool = uniqueMovies(
                    upcomingSearchResults.flatMap((result) =>
                        result.status === 'fulfilled'
                            ? filterRenderableMovies(result.value.results).filter(isUpcomingMovie)
                            : []
                    ),
                    undefined,
                    40
                );

                const usedMovieIds = new Set<number>();
                const uniqueRecommended = uniqueMovies(recommendedBase.length ? recommendedBase : fallbackPool, usedMovieIds);
                const uniqueTrending = uniqueMovies(trendingBase.length ? trendingBase : fallbackPool, usedMovieIds);
                const tamilSource = tamilBase.length ? tamilBase : (tamilFallbackPool.length ? tamilFallbackPool : fallbackPool);
                let uniqueTamil = uniqueMovies(tamilSource, usedMovieIds);
                const upcomingFallback = upcomingFuturePool.length ? upcomingFuturePool : fallbackPool.filter(isUpcomingMovie);
                let uniqueUpcoming = uniqueMovies(upcomingBase.length ? upcomingBase : upcomingFallback, usedMovieIds);
                const moodData = await tmdbService.getMoodPicks({
                    mood: normalizeMoodForApi(onboardingData.mood),
                    language: onboardingData.languages[0] || null,
                    genres: onboardingData.genres,
                });
                const uniqueMood = uniqueMovies(
                    filterRenderableMovies(moodData.results).length ? filterRenderableMovies(moodData.results) : fallbackPool,
                    usedMovieIds
                );

                if (uniqueTamil.length === 0) {
                    uniqueTamil = uniqueMovies(tamilSource, undefined);
                }

                if (uniqueUpcoming.length === 0) {
                    uniqueUpcoming = uniqueMovies(upcomingBase.length ? upcomingBase : upcomingFallback, undefined);
                }

                setRecommended(uniqueRecommended);
                setTrending(uniqueTrending);
                setTamilMovies(uniqueTamil);
                setMoodPicks(uniqueMood);
                setUpcoming(uniqueUpcoming);
                setSuggestedFriends(friendsResult.status === 'fulfilled' ? friendsResult.value : []);

                // Pick a random movie from available rows for hero variety.
                const heroPool = [...uniqueTrending, ...uniqueRecommended, ...uniqueUpcoming, ...fallbackPool];
                if (heroPool.length > 0) {
                    const randomIndex = Math.floor(Math.random() * heroPool.length);
                    setHeroMovie(heroPool[randomIndex]);
                }

            } catch (error) {
                console.error("Failed to load home data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHomeData();

        // Check if user has already completed the survey this session
        const hasCompletedSurvey = sessionStorage.getItem('hasCompletedMoodSurvey');
        if (!hasCompletedSurvey) {
            // Slight delay so the user sees the page load before the modal pops up
            setTimeout(() => {
                setIsSurveyOpen(true);
            }, 1000);
        }
    }, []);

    useEffect(() => {
        const refreshMoodPicks = async () => {
            try {
                const moodData = await tmdbService.getMoodPicks({
                    mood: normalizeMoodForApi(onboardingData.mood),
                    language: onboardingData.languages[0] || null,
                    genres: onboardingData.genres,
                });
                const fallbackPool = uniqueMovies([
                    ...recommended,
                    ...trending,
                    ...tamilMovies,
                    ...upcoming,
                ], undefined, 30);
                const filteredMood = filterRenderableMovies(moodData.results);
                setMoodPicks(uniqueMovies(filteredMood.length ? filteredMood : fallbackPool, undefined));
            } catch {
                setMoodPicks([]);
            }
        };
        refreshMoodPicks();
    }, [onboardingData.mood, onboardingData.languages.join(','), onboardingData.genres.join(',')]);

    useEffect(() => {
        if (trending.length === 0) return;

        const intervalId = setInterval(() => {
            setHeroMovie((current) => {
                if (!current) return trending[0];
                const currentIndex = trending.findIndex((m) => m.id === current.id);
                const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % trending.length;
                return trending[nextIndex];
            });
        }, 8000);

        return () => clearInterval(intervalId);
    }, [trending]);

    return (
        <div className="min-h-screen bg-background pb-20">
            <MoodSurveyModal
                isOpen={isSurveyOpen}
                onClose={() => setIsSurveyOpen(false)}
            />

            <HeroBanner movie={heroMovie} loading={loading} />

            <div className="relative z-20 -mt-12 space-y-12 pb-12 max-w-7xl mx-auto w-full">
                <UserRow
                    title="Suggested Friends"
                    users={suggestedFriends}
                    loading={loading}
                />

                <MovieRow
                    title="Recommended for You"
                    movies={recommended}
                    loading={loading}
                />

                <MovieRow
                    title="Trending Now"
                    movies={trending}
                    loading={loading}
                />

                <MovieRow
                    title="Kollywood Masterpieces (Tamil)"
                    movies={tamilMovies}
                    loading={loading}
                />

                {/* If user picked a mood in onboarding, personalize this row title */}
                <MovieRow
                    title={onboardingData.mood ? `Because you're feeling ${onboardingData.mood}` : "Mood-based Picks"}
                    movies={moodPicks}
                    loading={loading}
                />

                <MovieRow
                    title="Upcoming Arrivals"
                    movies={upcoming}
                    loading={loading}
                />
            </div>
        </div>
    );
};
