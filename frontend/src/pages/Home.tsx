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

    useEffect(() => {
        const fetchHomeData = async () => {
            setLoading(true);
            try {
                // Fetch all rows concurrently
                const [
                    trendingData,
                    recommendedData,
                    upcomingData,
                    moodData,
                    tamilData,
                    friendsData
                ] = await Promise.all([
                    tmdbService.getTrendingMovies(),
                    tmdbService.getRecommendedMovies(), // Represents ML recommendation Logic
                    tmdbService.getUpcomingMovies(),
                    tmdbService.getMoodPicks(), // Uses Context API mood potentially
                    tmdbService.getTamilMovies(), // Fetch popular Tamil movies
                    dataService.getSuggestedFriends() // Fetch friend suggestions
                ]);

                setTrending(trendingData.results);
                setRecommended(recommendedData.results);
                setUpcoming(upcomingData.results);
                setMoodPicks(moodData.results);
                setTamilMovies(tamilData.results);
                setSuggestedFriends(friendsData);

                // Randomly pick a trending movie for the hero banner
                if (trendingData.results.length > 0) {
                    setHeroMovie(trendingData.results[0]);
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
