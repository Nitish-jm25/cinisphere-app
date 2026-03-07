import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Settings, Edit3, Activity,
    Users, Bookmark, Calendar,
    MapPin, Share2, LogOut
} from 'lucide-react';

import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import { FeedPost, type Post } from '../components/community/FeedPost';
import { UserRow } from '../components/community/UserRow';
import type { User } from '../services/mockData';
import { socialApi, type CommunitySummary, type SocialUser } from '../services/socialApi';
import { useAuth } from '../context/AuthContext';
import { resolvePostImages } from '../utils/postImages';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=2000&auto=format&fit=crop';
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=250&auto=format&fit=crop';
const DEFAULT_COMMUNITY_IMAGE = 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=500&auto=format&fit=crop';

const timeAgo = (createdAt: string): string => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
};

const mapToUserRow = (u: SocialUser): User => ({
    id: String(u.id),
    username: u.username,
    avatarUrl: u.avatar_url || DEFAULT_AVATAR,
    bio: u.bio || 'Movie enthusiast',
    followers: 0,
    following: 0,
    favoriteGenres: [],
    isFriend: false,
});

export const Profile = () => {
    const { user: authUser, logout } = useAuth();
    const { username: routeUsername } = useParams();
    const [activeTab, setActiveTab] = useState<'saved' | 'activity' | 'communities'>('saved');
    const [suggestedFriends, setSuggestedFriends] = useState<User[]>([]);
    const [communities, setCommunities] = useState<CommunitySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [bioDraft, setBioDraft] = useState('');
    const avatarInputRef = useRef<HTMLInputElement | null>(null);

    const [profile, setProfile] = useState<any>(null);
    const [activityPosts, setActivityPosts] = useState<Post[]>([]);

    const currentUsername = authUser?.username || '';
    const usernameToLoad = routeUsername || currentUsername;
    const isOwnProfile = usernameToLoad === currentUsername;

    const galleryImages = activityPosts
        .flatMap((post) => (post.imageUrls?.length ? post.imageUrls : [post.imageUrl]))
        .filter((img): img is string => Boolean(img));

    useEffect(() => {
        const loadData = async () => {
            if (!usernameToLoad) return;
            setLoading(true);
            try {
                const [discoverData, communitiesData, profileData] = await Promise.all([
                    socialApi.getDiscoverUsers(12),
                    socialApi.listCommunities(),
                    socialApi.getUserProfile(usernameToLoad),
                ]);

                const posts = await socialApi.getUserPosts(profileData.user.id, 20, 0);

                setSuggestedFriends(discoverData.users.map(mapToUserRow));
                setCommunities(communitiesData.communities);
                setProfile(profileData);
                setActivityPosts(
                    posts.map((p) => {
                        const images = resolvePostImages(p.id, p.image_url, p.image_urls);
                        return {
                            id: String(p.id),
                            user: {
                                id: String(p.author.id),
                                name: p.author.username,
                                handle: p.author.username,
                                avatar: p.author.avatar_url || DEFAULT_AVATAR,
                            },
                            imageUrl: images[0],
                            imageUrls: images,
                            content: p.caption,
                            likes: p.likes_count,
                            comments: p.comments_count,
                            timeAgo: timeAgo(p.created_at),
                            isLikedByMe: p.is_liked,
                        };
                    })
                );
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [usernameToLoad]);

    const handleFollowToggle = async () => {
        if (!profile || isOwnProfile) return;
        if (profile.is_following) {
            await socialApi.unfollowUser(profile.user.id);
            setProfile((prev: any) => ({ ...prev, is_following: false, followers_count: Math.max(0, prev.followers_count - 1) }));
        } else {
            await socialApi.followUser(profile.user.id);
            setProfile((prev: any) => ({ ...prev, is_following: true, followers_count: prev.followers_count + 1 }));
        }
    };

    const openEditProfileModal = () => {
        setBioDraft(profile?.user?.bio || '');
        setEditModalOpen(true);
    };

    const handleSaveProfile = async () => {
        setProfileSaving(true);
        try {
            const updated = await socialApi.updateProfile({
                bio: bioDraft,
            });
            setProfile((prev: any) => ({ ...prev, user: { ...prev.user, ...updated } }));
            setEditModalOpen(false);
        } catch (error) {
            alert((error as Error).message || 'Failed to update profile');
        } finally {
            setProfileSaving(false);
        }
    };

    const handleAvatarUpload = async (file: File | null) => {
        if (!file) return;
        setAvatarUploading(true);
        try {
            const updated = await socialApi.uploadProfileAvatar(file);
            setProfile((prev: any) => ({ ...prev, user: { ...prev.user, ...updated } }));
        } catch (error) {
            alert((error as Error).message || 'Failed to upload avatar');
        } finally {
            setAvatarUploading(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
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
        if (!content || !content.trim()) return;
        await socialApi.addComment(Number(postId), content.trim());
        setActivityPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: p.comments + 1 } : p)));
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
        setActivityPosts((prev) => prev.filter((p) => p.id !== postId));
    };

    if (!profile) {
        return <div className="min-h-screen pt-24 text-center text-secondary-foreground">{loading ? 'Loading profile...' : 'Profile not found'}</div>;
    }

    return (
        <div className="min-h-screen bg-background pb-20 mt-[-64px]">
            {isOwnProfile && editModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setEditModalOpen(false)} />
                    <div className="relative w-full max-w-xl bg-[#121212] border border-white/10 rounded-2xl p-5 space-y-4">
                        <h2 className="text-xl font-semibold">Edit Profile</h2>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-300">Bio</label>
                            <textarea
                                value={bioDraft}
                                onChange={(e) => setBioDraft(e.target.value)}
                                rows={4}
                                maxLength={500}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-300">Profile Picture</label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-white/20 text-white hover:bg-white/10"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={avatarUploading}
                            >
                                {avatarUploading ? 'Uploading...' : 'Upload Profile Pic'}
                            </Button>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={profileSaving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveProfile} disabled={profileSaving}>
                                {profileSaving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <img src={DEFAULT_COVER} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute inset-0 bg-black/20" />

                <div className="absolute top-24 right-4 md:right-8 flex gap-3 z-10">
                    <Button variant="ghost" className="h-10 w-10 p-0 rounded-full glassmorphism text-white hover:bg-white/20"><Share2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" className="h-10 w-10 p-0 rounded-full glassmorphism text-white hover:bg-white/20"><Settings className="w-4 h-4" /></Button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 relative z-20">
                <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16 md:-mt-20 mb-10">
                    <div className="relative group">
                        <img src={profile.user.avatar_url || DEFAULT_AVATAR} alt={profile.user.username} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-background shadow-2xl" />
                        {isOwnProfile && (
                            <button className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity border-4 border-transparent" onClick={openEditProfileModal}>
                                <Edit3 className="w-6 h-6 text-white" />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 space-y-3 pb-2">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-glow">{profile.user.username}</h1>
                            <p className="text-lg text-secondary-foreground font-medium">@{profile.user.username}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Filmverse</span>
                            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Joined {new Date(profile.user.created_at).toLocaleDateString()}</span>
                        </div>

                        <p className="text-gray-200 max-w-2xl leading-relaxed">{profile.user.bio || 'No bio yet.'}</p>
                    </div>

                    <div className="pb-2 w-full md:w-auto flex flex-col gap-2">
                        {isOwnProfile ? (
                            <>
                                <Button className="w-full md:w-auto gap-2 bg-white text-black hover:bg-gray-200 shadow-lg font-bold" onClick={openEditProfileModal}>
                                    <Edit3 className="w-4 h-4" /> Edit Profile
                                </Button>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)}
                                />
                                <Button
                                    variant="outline"
                                    className="w-full md:w-auto gap-2 border-white/20 text-white hover:bg-white/10"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={avatarUploading}
                                >
                                    {avatarUploading ? 'Uploading...' : 'Upload Profile Pic'}
                                </Button>
                                <Button variant="outline" className="w-full md:w-auto gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors" onClick={() => { logout(); window.location.href = '/'; }}>
                                    <LogOut className="w-4 h-4" /> Log Out
                                </Button>
                            </>
                        ) : (
                            <Button className="w-full md:w-auto gap-2" onClick={handleFollowToggle}>
                                {profile.is_following ? 'Unfollow' : 'Follow'}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <div className="lg:col-span-2 glassmorphism p-5 rounded-2xl border border-white/10 flex flex-wrap lg:flex-nowrap justify-between gap-6 shadow-lg">
                        <div className="flex-1 text-center border-r border-white/10 last:border-0 pr-4">
                            <p className="text-3xl font-bold tracking-tight text-white mb-1">{activityPosts.length}</p>
                            <p className="text-xs uppercase tracking-wider text-secondary-foreground font-semibold">Posts</p>
                        </div>
                        <div className="flex-1 text-center border-r border-white/10 last:border-0 pr-4">
                            <p className="text-3xl font-bold tracking-tight text-white mb-1">{profile.followers_count}</p>
                            <p className="text-xs uppercase tracking-wider text-secondary-foreground font-semibold">Followers</p>
                        </div>
                        <div className="flex-1 text-center">
                            <p className="text-3xl font-bold tracking-tight text-white mb-1">{profile.following_count}</p>
                            <p className="text-xs uppercase tracking-wider text-secondary-foreground font-semibold">Following</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8 border-b border-white/10 mb-8">
                    <button onClick={() => setActiveTab('saved')} className={cn('pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2', activeTab === 'saved' ? 'border-primary text-white' : 'border-transparent text-secondary-foreground hover:text-white')}><Bookmark className="w-4 h-4" /> Gallery</button>
                    <button onClick={() => setActiveTab('activity')} className={cn('pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2', activeTab === 'activity' ? 'border-primary text-white' : 'border-transparent text-secondary-foreground hover:text-white')}><Activity className="w-4 h-4" /> Activity</button>
                    <button onClick={() => setActiveTab('communities')} className={cn('pb-4 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2', activeTab === 'communities' ? 'border-primary text-white' : 'border-transparent text-secondary-foreground hover:text-white')}><Users className="w-4 h-4" /> Communities</button>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[400px]">
                    {activeTab === 'saved' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-lg">Recent Images ({galleryImages.length})</h3>
                            </div>
                            {galleryImages.length === 0 ? (
                                <p className="text-secondary-foreground">No images yet.</p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                    {galleryImages.map((img, idx) => (
                                        <img key={`${img}-${idx}`} src={img} alt={`post-${idx}`} className="w-full aspect-[3/4] object-cover rounded-lg border border-white/10" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h3 className="font-bold text-lg flex items-center gap-2 mb-6">Recent Posts</h3>
                            {activityPosts.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-secondary-foreground mb-4">No posts yet.</p>
                                </div>
                            ) : (
                                activityPosts.map((p) => (
                                    <FeedPost
                                        key={p.id}
                                        post={p}
                                        onLikeToggle={handleLikeToggle}
                                        onAddComment={handleAddComment}
                                        onLoadComments={handleLoadComments}
                                        canDelete={isOwnProfile}
                                        onDeletePost={handleDeletePost}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'communities' && (
                        <div className="space-y-12">
                            <div className="-mx-4 md:-mx-8">
                                <UserRow title="Connect with Other Cinephiles" users={suggestedFriends} loading={loading} />
                            </div>

                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-6">Communities</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {communities.length === 0 && <p className="text-secondary-foreground">No communities available.</p>}
                                    {communities.map((comm) => (
                                        <div key={comm.id} className="glassmorphism rounded-xl overflow-hidden border border-white/10 group flex align-center p-4 gap-4 hover:border-white/30 transition-colors cursor-pointer">
                                            <img src={comm.image_url || DEFAULT_COMMUNITY_IMAGE} alt={comm.name} className="w-20 h-20 rounded-lg object-cover" />
                                            <div className="flex flex-col justify-center">
                                                <h4 className="font-bold text-white group-hover:text-primary transition-colors">{comm.name}</h4>
                                                <p className="text-xs text-secondary-foreground mb-2 line-clamp-2">{comm.description}</p>
                                                <span className="text-xs bg-white/10 font-bold text-gray-300 w-fit px-2 py-0.5 rounded-full">
                                                    {comm.member_count} members {comm.joined ? '• Joined' : ''}
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
