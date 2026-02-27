import { useState } from 'react';
import {
    Users, Search, Plus, UserPlus,
    MessageSquare, Film, Sparkles, MapPin,
    Check
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';

// --- MOCK DATA --- //
interface CommunityType {
    id: string;
    name: string;
    type: 'Genre' | 'Mood' | 'Language' | 'Local';
    members: number;
    image: string;
    isJoined?: boolean;
}

const DISCOVER_COMMUNITIES: CommunityType[] = [
    { id: 'c1', name: 'Sci-Fi Explorers', type: 'Genre', members: 12500, image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=500&auto=format&fit=crop' },
    { id: 'c2', name: 'Late Night Thrillers', type: 'Mood', members: 8300, image: 'https://images.unsplash.com/photo-1505322022379-7c3353ee6291?q=80&w=500&auto=format&fit=crop', isJoined: true },
    { id: 'c3', name: 'Cinémathèque Française', type: 'Language', members: 4200, image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=500&auto=format&fit=crop' },
    { id: 'c4', name: 'Cozy Rom-Coms', type: 'Mood', members: 15100, image: 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?q=80&w=500&auto=format&fit=crop', isJoined: true },
    { id: 'c5', name: 'Anime Enthusiasts', type: 'Genre', members: 22000, image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=500&auto=format&fit=crop' },
    { id: 'c6', name: 'Bollywood Classics', type: 'Language', members: 9800, image: 'https://images.unsplash.com/photo-1588693959600-b88307db1887?q=80&w=500&auto=format&fit=crop' },
];

interface Friend {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    similarity: number;
    topGenres: string[];
    isFollowing?: boolean;
}

const FRIEND_RECOMMENDATIONS: Friend[] = [
    { id: 'f1', name: 'Alex Wong', handle: 'alexw', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop', similarity: 94, topGenres: ['Sci-Fi', 'Thriller'] },
    { id: 'f2', name: 'Maria Garcia', handle: 'mariag_films', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop', similarity: 88, topGenres: ['Drama', 'Romance'], isFollowing: true },
    { id: 'f3', name: 'James Smith', handle: 'jsmith_movies', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop', similarity: 85, topGenres: ['Action', 'Sci-Fi'] },
    { id: 'f4', name: 'Emma Davis', handle: 'emma.d', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop', similarity: 79, topGenres: ['Comedy', 'Horror'] },
];

// --- COMPONENTS --- //

const CommunityCard = ({ comm }: { comm: CommunityType }) => {
    const [joined, setJoined] = useState(comm.isJoined || false);

    const getBadgeColor = (type: string) => {
        switch (type) {
            case 'Genre': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'Mood': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'Language': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'Genre': return <Film className="w-3 h-3" />;
            case 'Mood': return <Sparkles className="w-3 h-3" />;
            case 'Language': return <MapPin className="w-3 h-3" />;
            default: return null;
        }
    };

    return (
        <div className="glassmorphism rounded-xl overflow-hidden border border-white/10 group flex flex-col transition-all hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-primary/5">
            <div className="h-32 w-full relative overflow-hidden">
                <img src={comm.image} alt={comm.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className={cn("absolute top-3 left-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md px-2.5 py-1 rounded-full border shadow-sm", getBadgeColor(comm.type))}>
                    {getIcon(comm.type)}
                    {comm.type}
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-primary transition-colors">{comm.name}</h3>
                <p className="text-sm text-secondary-foreground mb-4 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {(comm.members / 1000).toFixed(1)}k members
                </p>
                <div className="mt-auto pt-2 grid grid-cols-2 gap-2">
                    <Button
                        variant={joined ? "secondary" : "primary"}
                        className={cn("w-full transition-all text-xs font-semibold h-9", joined && "bg-white/10 text-white")}
                        onClick={() => setJoined(!joined)}
                    >
                        {joined ? <><Check className="w-4 h-4 mr-1" /> Joined</> : 'Join'}
                    </Button>
                    <Button variant="outline" className="w-full text-xs font-semibold h-9 border-white/10 glassmorphism hover:bg-white/10 group/btn relative overflow-hidden">
                        <span className="relative z-10">Visit</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

const FriendCard = ({ friend }: { friend: Friend }) => {
    const [following, setFollowing] = useState(friend.isFollowing || false);

    return (
        <div className="flex items-center justify-between p-4 glassmorphism rounded-xl border border-white/10 hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <img src={friend.avatar} alt={friend.name} className="w-12 h-12 rounded-full object-cover border-2 border-transparent group-hover:border-primary transition-colors" />
                    <div className="absolute -bottom-1 -right-1 bg-green-500/20 backdrop-blur-md border border-green-500/50 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center shadow-sm">
                        {friend.similarity}%
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-white">{friend.name}</h4>
                    <p className="text-secondary-foreground text-xs mb-1">@{friend.handle}</p>
                    <div className="flex gap-1.5 hidden sm:flex">
                        {friend.topGenres.map(g => (
                            <span key={g} className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded-md border border-white/5">
                                {g}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-white glassmorphism border border-white/10 hidden sm:flex">
                    <MessageSquare className="w-4 h-4" />
                </Button>
                <Button
                    size="sm"
                    variant={following ? "secondary" : "primary"}
                    className={cn("text-xs font-semibold h-8 min-w-[90px]", following && "bg-white/10 text-white")}
                    onClick={() => setFollowing(!following)}
                >
                    {following ? 'Following' : 'Connect'}
                </Button>
            </div>
        </div>
    );
};

export const Communities = () => {
    const [activeTab, setActiveTab] = useState<'discover' | 'my-communities' | 'friends'>('discover');

    return (
        <div className="min-h-screen bg-background pb-24 pt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">

                {/* Header section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Communities & Friends</h1>
                        <p className="text-secondary-foreground">Connect with movie lovers who share your exact taste.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="glassmorphism border-white/10 gap-2 h-10 hover:bg-white/10 text-sm">
                            <UserPlus className="w-4 h-4" />
                            Invite
                        </Button>
                        <Button className="gap-2 shadow-lg shadow-primary/20 h-10 text-sm">
                            <Plus className="w-4 h-4" />
                            Create Community
                        </Button>
                    </div>
                </div>

                {/* Custom Tabs Navigation */}
                <div className="flex items-center gap-6 border-b border-white/10 mb-8 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setActiveTab('discover')}
                        className={cn("pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap", activeTab === 'discover' ? "border-primary text-white" : "border-transparent text-secondary-foreground hover:text-white")}
                    >
                        Discover Communities
                    </button>
                    <button
                        onClick={() => setActiveTab('my-communities')}
                        className={cn("pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap", activeTab === 'my-communities' ? "border-primary text-white" : "border-transparent text-secondary-foreground hover:text-white")}
                    >
                        My Communities
                    </button>
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={cn("pb-4 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2", activeTab === 'friends' ? "border-primary text-white" : "border-transparent text-secondary-foreground hover:text-white")}
                    >
                        Friends & Matches
                        <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">New</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* TAB 1 & 2: Communities */}
                    {(activeTab === 'discover' || activeTab === 'my-communities') && (
                        <div className="space-y-6">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search genres, moods, or languages..."
                                    className="w-full bg-secondary/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all glassmorphism"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {DISCOVER_COMMUNITIES
                                    .filter(c => activeTab === 'discover' ? true : c.isJoined)
                                    .map(comm => (
                                        <CommunityCard key={comm.id} comm={comm} />
                                    ))}
                            </div>

                            {activeTab === 'my-communities' && !DISCOVER_COMMUNITIES.some(c => c.isJoined) && (
                                <div className="text-center py-20 glassmorphism rounded-xl border border-white/10">
                                    <Film className="w-12 h-12 text-secondary-foreground mx-auto mb-4 opacity-50" />
                                    <h3 className="text-xl font-bold mb-2">No Communities Yet</h3>
                                    <p className="text-secondary-foreground max-w-sm mx-auto mb-6">You haven't joined any communities. Explore the discover tab to find your tribe.</p>
                                    <Button onClick={() => setActiveTab('discover')}>Find Communities</Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: Friends */}
                    {activeTab === 'friends' && (
                        <div className="flex flex-col lg:flex-row gap-8">

                            {/* Left col: List view */}
                            <div className="flex-1 space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-green-400" />
                                        Top Taste Matches
                                    </h2>
                                    <div className="space-y-3">
                                        {FRIEND_RECOMMENDATIONS.map(friend => (
                                            <FriendCard key={friend.id} friend={friend} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right col: CTA / Extras */}
                            <div className="w-full lg:w-80 space-y-6">
                                <div className="glassmorphism p-6 rounded-xl border border-white/10 text-center relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner relative z-10 border border-white/10 group-hover:bg-primary/20 transition-colors">
                                        <UserPlus className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                                    </div>
                                    <h3 className="font-bold text-lg mb-2 relative z-10">Invite Your Squad</h3>
                                    <p className="text-sm text-secondary-foreground mb-6 relative z-10">
                                        Watching movies is better with friends. Sync your watchlists today.
                                    </p>
                                    <Button className="w-full shadow-lg shadow-primary/20 relative z-10">Share Invite Link</Button>
                                </div>

                                <div className="glassmorphism p-5 rounded-xl border border-white/10">
                                    <h4 className="font-bold text-sm text-secondary-foreground uppercase tracking-wider mb-4">Your Social Stats</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>Community Activity</span>
                                                <span className="font-bold text-primary">Top 15%</span>
                                            </div>
                                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                                <div className="h-full bg-primary w-[85%] rounded-full" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>Taste Uniqueness</span>
                                                <span className="font-bold text-purple-400">High</span>
                                            </div>
                                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-500 w-[70%] rounded-full" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
