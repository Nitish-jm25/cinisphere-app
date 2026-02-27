import { useState, useEffect } from 'react';
import { FeedPost, type Post } from '../components/community/FeedPost';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { PenSquare, Users, UserPlus } from 'lucide-react';
import { dataService, type User } from '../services/mockData';

const MOCK_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=150&auto=format&fit=crop',
];

const MOCK_COMMUNITIES = [
    { id: 'c1', name: 'Sci-Fi Explorers', members: 12500, image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=500&auto=format&fit=crop' },
    { id: 'c2', name: 'Late Night Thrillers', members: 8300, image: 'https://images.unsplash.com/photo-1505322022379-7c3353ee6291?q=80&w=500&auto=format&fit=crop' },
    { id: 'c3', name: 'Anime Enthusiasts', members: 22000, image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=500&auto=format&fit=crop' }
];


const MOCK_POSTS: Post[] = [
    {
        id: 'post_1',
        user: { id: 'u1', name: 'Elena Rodriguez', handle: 'elenawatchs', avatar: MOCK_AVATARS[0] },
        movie: { id: 2, title: 'Interstellar', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&q=80', rating: 10, year: '2014' },
        content: "Just rewatched this masterpiece. The docking scene still gives me chills every single time. Hans Zimmer's score is unmatched. 🌌 What's everyone's favorite Nolan film?",
        likes: 342,
        comments: 56,
        timeAgo: '2h',
        isLikedByMe: true
    },
    {
        id: 'post_2',
        user: { id: 'u2', name: 'Marcus Chen', handle: 'marcus_cine', avatar: MOCK_AVATARS[1] },
        movie: { id: 7, title: 'Spider-Man: Across the Spider-Verse', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&q=80', rating: 9.5, year: '2023' },
        content: "The animation style here is literally pushing the boundaries of the medium. Every frame belongs in a museum. Gwen's universe color palette was stunning!",
        likes: 890,
        comments: 112,
        timeAgo: '5h'
    },
    {
        id: 'post_3',
        user: { id: 'u3', name: 'Sarah Jenkins', handle: 'sarah.films', avatar: MOCK_AVATARS[2] },
        movie: { id: 8, title: 'Parasite', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&q=80', rating: 10, year: '2019' },
        content: "Bong Joon-ho is a genius. The way he handles class disparity wrapped in a thriller is flawless. That rainstorm sequence is perfectly directed.",
        likes: 215,
        comments: 34,
        timeAgo: '1d',
        isSavedByMe: true
    },
    {
        id: 'post_4',
        user: { id: 'u4', name: 'David Kim', handle: 'dk_reviews', avatar: MOCK_AVATARS[3] },
        movie: { id: 4, title: 'Dune: Part Two', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&q=80', rating: 9.0, year: '2024' },
        content: "Long live the fighters! The scale of this movie is ridiculous. Austin Butler was terrifying as Feyd-Rautha. Need to see it in IMAX again.",
        likes: 1240,
        comments: 89,
        timeAgo: '2d'
    }
];

export const CommunityFeed = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFeed = async () => {
            setLoading(true);
            const [usersData] = await Promise.all([
                dataService.getSuggestedFriends(),
                new Promise(resolve => setTimeout(resolve, 1200)) // simulate feed delay
            ]);
            setPosts(MOCK_POSTS);
            setSuggestedUsers(usersData.slice(0, 4));
            setLoading(false);
        };
        loadFeed();
    }, []);

    return (
        <div className="min-h-screen bg-background pt-20 pb-24">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN: Main Feed */}
                    <div className="lg:col-span-2 relative">
                        {/* Header / Create Post Action */}
                        <div className="flex items-center justify-between mb-8 sticky top-[72px] bg-background/80 backdrop-blur-xl z-10 py-4 -mx-4 px-4 sm:mx-0 sm:px-0 border-b lg:border-none border-white/10">
                            <h1 className="text-2xl font-bold tracking-tight">Community Feed</h1>
                            <Button className="gap-2 shadow-lg shadow-primary/20">
                                <PenSquare className="w-4 h-4" />
                                <span className="hidden sm:inline">Write Review</span>
                                <span className="sm:hidden">Write</span>
                            </Button>
                        </div>

                        {/* Feed Content */}
                        <div className="space-y-6">
                            {loading ? (
                                // Skeleton Loader for Feed
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="glassmorphism rounded-xl p-4 space-y-4 border border-white/5">
                                        <div className="flex gap-3 items-center">
                                            <Skeleton className="w-10 h-10 rounded-full" variant="card" />
                                            <div className="space-y-2">
                                                <Skeleton className="w-32 h-4" />
                                                <Skeleton className="w-20 h-3" />
                                            </div>
                                        </div>
                                        <Skeleton className="w-full h-24 rounded-lg" variant="card" />
                                        <Skeleton className="w-full h-16" />
                                    </div>
                                ))
                            ) : (
                                posts.map(post => (
                                    <FeedPost
                                        key={post.id}
                                        post={post}
                                        className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                                        style={{ animationDelay: `${posts.indexOf(post) * 100}ms` }}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Sidebar Suggestions */}
                    <div className="hidden lg:block lg:col-span-1">
                        <div className="sticky top-[100px] space-y-8">

                            {/* Suggested Communities */}
                            <div className="glassmorphism p-5 rounded-2xl border border-white/10 shadow-lg">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Communities for you
                                </h3>
                                <div className="space-y-4">
                                    {MOCK_COMMUNITIES.map(comm => (
                                        <div key={comm.id} className="flex gap-3 items-center group cursor-pointer transition-colors hover:bg-white/5 p-2 -mx-2 rounded-lg">
                                            <img src={comm.image} alt={comm.name} className="w-12 h-12 rounded-lg object-cover" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">{comm.name}</p>
                                                <p className="text-xs text-secondary-foreground">{(comm.members / 1000).toFixed(1)}k members</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="ghost" className="w-full mt-4 text-sm text-secondary-foreground hover:text-white border border-white/10 glassmorphism">
                                    See all
                                </Button>
                            </div>

                            {/* Suggested Friends */}
                            <div className="glassmorphism p-5 rounded-2xl border border-white/10 shadow-lg">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-blue-400" />
                                    Who to follow
                                </h3>
                                <div className="space-y-4">
                                    {loading ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="flex gap-3 items-center">
                                                <Skeleton className="w-10 h-10 rounded-full" variant="card" />
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="w-24 h-3" />
                                                    <Skeleton className="w-16 h-2" />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        suggestedUsers.map(user => (
                                            <div key={user.id} className="flex items-center justify-between gap-3 group">
                                                <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                                                    <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-white group-hover:underline truncate">{user.username}</p>
                                                        <p className="text-xs text-secondary-foreground truncate">@{user.username}</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="outline" className="h-8 px-3 text-xs glassmorphism hover:bg-white/10 border-white/20">
                                                    Follow
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};
