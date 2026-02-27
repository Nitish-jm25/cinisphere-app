import { useState, useEffect } from 'react';
import {
    Settings, Edit3, Grid, Activity,
    Users, Bookmark, Star, Calendar,
    MapPin, Share2, LogOut
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import { MOCK_MOVIES, tmdbService } from '../services/tmdb';
import type { Movie } from '../services/tmdb';
import { MovieCard } from '../components/movies/MovieCard';
import { FeedPost } from '../components/community/FeedPost';
import { UserRow } from '../components/community/UserRow';
import { dataService } from '../services/mockData';
import type { User } from '../services/mockData';

// Mock Data for Profile
const USER_PROFILE = {
    name: 'Alex Sterling',
    handle: 'alex_cinephile',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=250&auto=format&fit=crop',
    cover: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=2000&auto=format&fit=crop',
    bio: 'Searching for the perfect shot. Film student & sci-fi nerd. Always down for a Nolan rewatch.',
    location: 'Los Angeles, CA',
    joined: 'March 2023',
    stats: {
        watched: 342,
        reviews: 86,
        followers: '2.4k',
        following: 128
    },
    favoriteGenres: ['Sci-Fi', 'Thriller', 'Cyberpunk', 'Neo-Noir'],
};

// Mock post for activity tab
const MOCK_ACTIVITY_POST = {
    id: 'p1',
    user: {
        id: 'u1',
        name: USER_PROFILE.name,
        handle: USER_PROFILE.handle,
        avatar: USER_PROFILE.avatar
    },
    movie: {
        id: 6,
        title: 'Blade Runner 2049',
        poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&q=80',
        rating: 10,
        year: '2017'
    },
    content: "The cinematography in this film is an absolute masterclass by Roger Deakins. Every single frame is a painting. The neon lighting against the brutalist architecture creates such a profound sense of isolation.",
    likes: 456,
    comments: 32,
    timeAgo: '2 days ago',
    isLikedByMe: false
};

const MOCK_COMMUNITIES = [
    { id: 'c1', name: 'Sci-Fi Explorers', type: 'Genre', members: 12500, image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=500&auto=format&fit=crop' },
    { id: 'c2', name: 'Late Night Thrillers', type: 'Mood', members: 8300, image: 'https://images.unsplash.com/photo-1505322022379-7c3353ee6291?q=80&w=500&auto=format&fit=crop' },
];

export const Profile = () => {
    const [activeTab, setActiveTab] = useState<'saved' | 'activity' | 'communities'>('saved');
    const [savedMovies, setSavedMovies] = useState<Movie[]>(MOCK_MOVIES.slice(0, 4));
    const [suggestedFriends, setSuggestedFriends] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [data, friendsData] = await Promise.all([
                    tmdbService.getRecommendedMovies(),
                    dataService.getSuggestedFriends()
                ]);
                setSavedMovies(data.results.slice(0, 5));
                setSuggestedFriends(friendsData);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    return (
        <div className="min-h-screen bg-background pb-20 mt-[-64px]">

            {/* Cover Photo */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <img
                    src={USER_PROFILE.cover}
                    alt="Cover"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute inset-0 bg-black/20" />

                {/* Action icons top right */}
                <div className="absolute top-24 right-4 md:right-8 flex gap-3 z-10">
                    <Button variant="ghost" className="h-10 w-10 p-0 rounded-full glassmorphism text-white hover:bg-white/20">
                        <Share2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" className="h-10 w-10 p-0 rounded-full glassmorphism text-white hover:bg-white/20">
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 relative z-20">

                {/* Profile Header Block */}
                <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16 md:-mt-20 mb-10">
                    <div className="relative group">
                        <img
                            src={USER_PROFILE.avatar}
                            alt={USER_PROFILE.name}
                            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-background shadow-2xl"
                        />
                        <button className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity border-4 border-transparent">
                            <Edit3 className="w-6 h-6 text-white" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-3 pb-2">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-glow">{USER_PROFILE.name}</h1>
                            <p className="text-lg text-secondary-foreground font-medium">@{USER_PROFILE.handle}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {USER_PROFILE.location}</span>
                            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Joined {USER_PROFILE.joined}</span>
                        </div>

                        <p className="text-gray-200 max-w-2xl leading-relaxed">{USER_PROFILE.bio}</p>
                    </div>

                    <div className="pb-2 w-full md:w-auto flex flex-col gap-2">
                        <Button className="w-full md:w-auto gap-2 bg-white text-black hover:bg-gray-200 shadow-lg font-bold">
                            <Edit3 className="w-4 h-4" />
                            Edit Profile
                        </Button>
                        <Button variant="outline" className="w-full md:w-auto gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors">
                            <LogOut className="w-4 h-4" />
                            Log Out
                        </Button>
                    </div>
                </div>

                {/* Stats & Genres Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

                    <div className="lg:col-span-2 glassmorphism p-5 rounded-2xl border border-white/10 flex flex-wrap lg:flex-nowrap justify-between gap-6 shadow-lg">
                        <div className="flex-1 text-center border-r border-white/10 last:border-0 pr-4">
                            <p className="text-3xl font-bold tracking-tight text-white mb-1">{USER_PROFILE.stats.watched}</p>
                            <p className="text-xs uppercase tracking-wider text-secondary-foreground font-semibold">Watched</p>
                        </div>
                        <div className="flex-1 text-center border-r border-white/10 last:border-0 pr-4">
                            <p className="text-3xl font-bold tracking-tight text-white mb-1">{USER_PROFILE.stats.reviews}</p>
                            <p className="text-xs uppercase tracking-wider text-secondary-foreground font-semibold">Reviews</p>
                        </div>
                        <div className="flex-1 text-center border-r border-white/10 last:border-0 pr-4">
                            <p className="text-3xl font-bold tracking-tight text-white mb-1">{USER_PROFILE.stats.followers}</p>
                            <p className="text-xs uppercase tracking-wider text-secondary-foreground font-semibold">Followers</p>
                        </div>
                        <div className="flex-1 text-center">
                            <p className="text-3xl font-bold tracking-tight text-white mb-1">{USER_PROFILE.stats.following}</p>
                            <p className="text-xs uppercase tracking-wider text-secondary-foreground font-semibold">Following</p>
                        </div>
                    </div>

                    <div className="glassmorphism p-5 rounded-2xl border border-white/10 shadow-lg">
                        <h3 className="text-xs uppercase tracking-wider text-secondary-foreground font-bold mb-3 flex items-center gap-2">
                            <Star className="w-3.5 h-3.5 text-yellow-500" /> Top Genres
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {USER_PROFILE.favoriteGenres.map(genre => (
                                <span key={genre} className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 text-xs font-bold rounded-full">
                                    {genre}
                                </span>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Custom Tabs Navigation */}
                <div className="flex items-center gap-8 border-b border-white/10 mb-8">
                    <button
                        onClick={() => setActiveTab('saved')}
                        className={cn("pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2", activeTab === 'saved' ? "border-primary text-white" : "border-transparent text-secondary-foreground hover:text-white")}
                    >
                        <Bookmark className="w-4 h-4" />
                        Watchlist
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        className={cn("pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2", activeTab === 'activity' ? "border-primary text-white" : "border-transparent text-secondary-foreground hover:text-white")}
                    >
                        <Activity className="w-4 h-4" />
                        Activity
                    </button>
                    <button
                        onClick={() => setActiveTab('communities')}
                        className={cn("pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2", activeTab === 'communities' ? "border-primary text-white" : "border-transparent text-secondary-foreground hover:text-white")}
                    >
                        <Users className="w-4 h-4" />
                        Communities
                    </button>
                </div>

                {/* Tab Content Fields */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[400px]">

                    {/* WATCHLIST TAB */}
                    {activeTab === 'saved' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-lg">My Watchlist ({savedMovies.length})</h3>
                                <Button variant="ghost" size="sm" className="text-secondary-foreground hover:text-white">
                                    <Grid className="w-4 h-4 mr-2" /> Sort View
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                                {savedMovies.map(movie => (
                                    <MovieCard key={movie.id} movie={movie} className="w-full" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === 'activity' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
                                Recent Reviews
                            </h3>
                            <FeedPost post={MOCK_ACTIVITY_POST} />

                            <div className="text-center py-10">
                                <p className="text-secondary-foreground mb-4">You haven't posted any other reviews recently.</p>
                                <Button variant="outline" className="glassmorphism">Write a Review</Button>
                            </div>
                        </div>
                    )}

                    {/* COMMUNITIES TAB */}
                    {activeTab === 'communities' && (
                        <div className="space-y-12">
                            {/* Suggested Friends Section */}
                            <div className="-mx-4 md:-mx-8">
                                <UserRow
                                    title="Connect with Other Cinephiles"
                                    users={suggestedFriends}
                                    loading={loading}
                                />
                            </div>

                            {/* Joined Communities */}
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
                                    Joined Communities
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {MOCK_COMMUNITIES.map(comm => (
                                        <div key={comm.id} className="glassmorphism rounded-xl overflow-hidden border border-white/10 group flex align-center p-4 gap-4 hover:border-white/30 transition-colors cursor-pointer">
                                            <img src={comm.image} alt={comm.name} className="w-20 h-20 rounded-lg object-cover" />
                                            <div className="flex flex-col justify-center">
                                                <h4 className="font-bold text-white group-hover:text-primary transition-colors">{comm.name}</h4>
                                                <p className="text-xs text-secondary-foreground mb-2">{comm.type} • {(comm.members / 1000).toFixed(1)}k members</p>
                                                <span className="text-xs bg-white/10 font-bold text-gray-300 w-fit px-2 py-0.5 rounded-full">
                                                    Joined
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
};
