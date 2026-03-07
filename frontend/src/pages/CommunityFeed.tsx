import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeedPost, type Post } from '../components/community/FeedPost';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { PenSquare, Users, UserPlus, X, Upload } from 'lucide-react';

import { dataService, type User } from '../services/mockData';
import { socialApi, type SocialPost } from '../services/socialApi';
import { tmdbService, type Movie } from '../services/tmdb';
import { resolvePostImages } from '../utils/postImages';
import { useAuth } from '../context/AuthContext';

const MOCK_COMMUNITIES = [
    { id: 'c1', name: 'Sci-Fi Explorers', members: 12500, image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=500&auto=format&fit=crop' },
    { id: 'c2', name: 'Late Night Thrillers', members: 8300, image: 'https://images.unsplash.com/photo-1505322022379-7c3353ee6291?q=80&w=500&auto=format&fit=crop' },
    { id: 'c3', name: 'Anime Enthusiasts', members: 22000, image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=500&auto=format&fit=crop' }
];

const fallbackAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop';

const timeAgo = (createdAt: string): string => {
    const date = new Date(createdAt).getTime();
    const now = Date.now();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
};

const toPosterUrl = (posterPath?: string | null) => {
    if (!posterPath) return '';
    return posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w780${posterPath}`;
};

const mapPost = (p: SocialPost): Post => {
    const images = resolvePostImages(p.id, p.image_url, p.image_urls);
    return {
        id: String(p.id),
        user: {
            id: String(p.author.id),
            name: p.author.username,
            handle: p.author.username,
            avatar: p.author.avatar_url || fallbackAvatar,
        },
        imageUrl: images[0],
        imageUrls: images,
        content: p.caption,
        likes: p.likes_count,
        comments: p.comments_count,
        timeAgo: timeAgo(p.created_at),
        isLikedByMe: p.is_liked,
    };
};

export const CommunityFeed = () => {
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [composerOpen, setComposerOpen] = useState(false);
    const [movieQuery, setMovieQuery] = useState('');
    const [movieResults, setMovieResults] = useState<Movie[]>([]);
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
    const [caption, setCaption] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const loadFeed = async () => {
        setLoading(true);
        try {
            const [usersData, feedData] = await Promise.all([
                dataService.getSuggestedFriends(),
                socialApi.getFeed(30, 0),
            ]);
            setPosts(feedData.map(mapPost));
            setSuggestedUsers(usersData.slice(0, 4));
        } catch (error) {
            console.error('Failed to load feed', error);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFeed();
    }, []);

    const searchMovies = async () => {
        if (!movieQuery.trim()) {
            setMovieResults([]);
            return;
        }
        try {
            const response = await tmdbService.searchMovies(movieQuery.trim());
            setMovieResults(response.results.slice(0, 8));
        } catch {
            setMovieResults([]);
        }
    };

    const handleFilesSelected = (files: FileList | null) => {
        if (!files) return;
        const accepted: File[] = [];
        Array.from(files).forEach((f) => {
            if (f.type.startsWith('image/')) accepted.push(f);
        });
        setSelectedFiles((prev) => [...prev, ...accepted].slice(0, 8));
    };

    const removeFileAt = (idx: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleCreatePost = async () => {
        if (!caption.trim()) {
            alert('Please add your review/description.');
            return;
        }

        const moviePoster = toPosterUrl(selectedMovie?.poster_path);
        const hasUpload = selectedFiles.length > 0;
        if (!hasUpload && !moviePoster) {
            alert('Select a movie or upload at least one image.');
            return;
        }

        setSubmitting(true);
        try {
            const created = await socialApi.createPostWithUpload({
                caption: caption.trim(),
                movie_title: selectedMovie?.title,
                image_url: !hasUpload ? moviePoster : undefined,
                image_files: hasUpload ? selectedFiles : undefined,
            });
            setPosts((prev) => [mapPost(created), ...prev]);
            setComposerOpen(false);
            setMovieQuery('');
            setMovieResults([]);
            setSelectedMovie(null);
            setCaption('');
            setSelectedFiles([]);
        } catch (error) {
            alert((error as Error).message || 'Failed to create post');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLikeToggle = async (postId: string, currentlyLiked: boolean) => {
        if (currentlyLiked) {
            await socialApi.unlikePost(Number(postId));
        } else {
            await socialApi.likePost(Number(postId));
        }
    };

    const handleAddComment = async (postId: string, content: string) => {
        await socialApi.addComment(Number(postId), content.trim());
    };

    const handleLoadComments = async (postId: string) => {
        const comments = await socialApi.getComments(Number(postId));
        return comments.map((c) => ({
            id: String(c.id),
            username: c.author.username,
            text: c.content,
        }));
    };

    const handleDeletePost = async (postId: string) => {
        await socialApi.deletePost(Number(postId));
        setPosts((prev) => prev.filter((p) => p.id !== postId));
    };

    return (
        <div className="min-h-screen bg-background pt-20 pb-24">
            {composerOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setComposerOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-[#121212] border border-white/10 rounded-2xl p-5 space-y-4">
                        <button className="absolute top-3 right-3 text-gray-300" onClick={() => setComposerOpen(false)}>
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-semibold">Create Post</h2>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-300">Select movie (poster auto-used if no upload)</label>
                            <div className="flex gap-2">
                                <input value={movieQuery} onChange={(e) => setMovieQuery(e.target.value)} placeholder="Search movie title" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
                                <Button onClick={searchMovies}>Search</Button>
                            </div>
                            {selectedMovie && (
                                <div className="text-xs text-green-400 flex items-center gap-2">
                                    <span>Selected: {selectedMovie.title}</span>
                                    {selectedMovie.poster_path && <img src={toPosterUrl(selectedMovie.poster_path)} className="w-8 h-10 object-cover rounded" alt={selectedMovie.title} />}
                                </div>
                            )}
                            {movieResults.length > 0 && (
                                <div className="max-h-40 overflow-auto border border-white/10 rounded-lg">
                                    {movieResults.map((m) => (
                                        <button key={m.id} onClick={() => { setSelectedMovie(m); setMovieResults([]); setMovieQuery(m.title); }} className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm">
                                            {m.title} ({(m.release_date || '').slice(0, 4)})
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-300">Your review/description</label>
                            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} maxLength={2200} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-300">Upload images (Instagram style)</label>
                            <label
                                className="block border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/70"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleFilesSelected(e.dataTransfer.files); }}
                            >
                                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm text-gray-300">Drag & drop images or click to browse</p>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
                            </label>

                            {selectedFiles.length > 0 && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {selectedFiles.map((file, idx) => (
                                        <div key={`${file.name}-${idx}`} className="relative group">
                                            <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-20 object-cover rounded" />
                                            <button className="absolute top-1 right-1 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100" onClick={() => removeFileAt(idx)}>
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleCreatePost} disabled={submitting}>{submitting ? 'Posting...' : 'Post'}</Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 relative">
                        <div className="flex items-center justify-between mb-8 sticky top-[72px] bg-background/80 backdrop-blur-xl z-10 py-4 -mx-4 px-4 sm:mx-0 sm:px-0 border-b lg:border-none border-white/10">
                            <h1 className="text-2xl font-bold tracking-tight">Community Feed</h1>
                            <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => setComposerOpen(true)}>
                                <PenSquare className="w-4 h-4" />
                                <span className="hidden sm:inline">Create Post</span>
                                <span className="sm:hidden">Post</span>
                            </Button>
                        </div>

                        <div className="space-y-6">
                            {loading ? (
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
                                posts.map((post, idx) => (
                                    <FeedPost
                                        key={post.id}
                                        post={post}
                                        onLikeToggle={handleLikeToggle}
                                        onAddComment={handleAddComment}
                                        onLoadComments={handleLoadComments}
                                        canDelete={authUser?.username === post.user.handle}
                                        onDeletePost={handleDeletePost}
                                        className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                                        style={{ animationDelay: `${idx * 100}ms` }}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="hidden lg:block lg:col-span-1">
                        <div className="sticky top-[100px] space-y-8">
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
                            </div>

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
                                                <button type="button" className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer text-left" onClick={() => navigate(`/profile/${user.username}`)}>
                                                    <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-white group-hover:underline truncate">{user.username}</p>
                                                        <p className="text-xs text-secondary-foreground truncate">@{user.username}</p>
                                                    </div>
                                                </button>
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
