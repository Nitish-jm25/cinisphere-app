import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Users, Send, UserPlus, RefreshCcw, Search, Loader2, Trash2, Share2, Pencil } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { FeedPost, type Post } from '../components/community/FeedPost';
import { socialApi, type CommunityMember, type CommunityMessage, type CommunitySummary, type SocialPost, type SocialUser } from '../services/socialApi';
import { tmdbService } from '../services/tmdb';
import { resolvePostImages } from '../utils/postImages';
import { timeAgo } from '../utils/time';
import { useDebounce } from '../hooks/useDebounce';

const COMMUNITY_TOPICS: Record<string, string[]> = {
  Movies: ['Reviews', 'Watchlists', 'Recommendations'],
  WebSeries: ['Streaming', 'Episodes', 'Binge'],
  Anime: ['Anime', 'Visuals', 'Soundtracks'],
  Underrated: ['Hidden Gems', 'Cult', 'Underrated'],
  IndieCinema: ['Indie', 'Festival', 'Directors'],
  MovieTheory: ['Symbolism', 'Screenwriting', 'Editing'],
  CinePhiles: ['General', 'Watchlist', 'Debate'],
};
const displayName = (username: string) =>
  username
    .replace(/[_\.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

const mapPost = (p: SocialPost): Post => {
  const images = resolvePostImages(p.id, p.image_url, p.image_urls);
  return {
    id: String(p.id),
    user: {
      id: String(p.author.id),
      name: displayName(p.author.username),
      handle: p.author.username,
      avatar: p.author.avatar_url || '',
    },
    imageUrl: images[0],
    imageUrls: images,
    content: p.caption,
    likes: p.likes_count,
    comments: p.comments_count,
    timeAgo: timeAgo(p.created_at),
    isLikedByMe: p.is_liked,
    isSavedByMe: p.is_saved,
  };
};

const toPosterUrl = (posterPath?: string | null) => {
  if (!posterPath) return '';
  return posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w780${posterPath}`;
};

export const Communities = () => {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);

  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [whoToFollow, setWhoToFollow] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [communitySearch, setCommunitySearch] = useState('');
  const [followBusyId, setFollowBusyId] = useState<number | null>(null);
  const [chatLiveAvailable, setChatLiveAvailable] = useState(true);

  const [chatText, setChatText] = useState('');
  const chatSocketRef = useRef<WebSocket | null>(null);
  const [postCaption, setPostCaption] = useState('');
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
  const [isSearchingMovie, setIsSearchingMovie] = useState(false);
  const debouncedMovieQuery = useDebounce(movieQuery, 500);

  const [isCreatingCommunity, setIsCreatingCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [createCommunityLoading, setCreateCommunityLoading] = useState(false);
  const currentUserId = localStorage.getItem('current_user_id');
  const [isEditingCommunity, setIsEditingCommunity] = useState(false);
  const [editCommunityName, setEditCommunityName] = useState('');
  const [editCommunityDesc, setEditCommunityDesc] = useState('');
  const [editCommunityLoading, setEditCommunityLoading] = useState(false);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedCommunityId) || null,
    [communities, selectedCommunityId]
  );
  const filteredCommunities = useMemo(() => {
    const q = communitySearch.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [communities, communitySearch]);

  const loadCommunities = async () => {
    setError('');
    try {
      const [communityRes, usersRes] = await Promise.all([
        socialApi.listCommunities(),
        socialApi.getDiscoverUsers(20),
      ]);
      setCommunities(communityRes.communities);
      if (communityId) {
        setSelectedCommunityId(Number(communityId));
      } else if (!selectedCommunityId && communityRes.communities.length > 0) {
        setSelectedCommunityId(communityRes.communities[0].id);
      }
      setWhoToFollow(usersRes.users);
    } catch (e) {
      setError((e as Error).message || 'Failed to load communities');
    }
  };

  const loadCommunityDetail = async (communityId: number) => {
    const [membersRes, postRes, msgRes] = await Promise.all([
      socialApi.getCommunityMembers(communityId),
      socialApi.getCommunityPosts(communityId),
      socialApi.getCommunityMessages(communityId),
    ]);
    setMembers(membersRes.members);
    setPosts(postRes.map(mapPost));
    setMessages(msgRes);
  };

  useEffect(() => {
    setLoading(true);
    loadCommunities().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCommunityId) return;
    loadCommunityDetail(selectedCommunityId).catch(console.error);
  }, [selectedCommunityId]);

  useEffect(() => {
    if (!selectedCommunityId) return;
    setChatLiveAvailable(true);
    const socket = socialApi.connectCommunityChat(selectedCommunityId, {
      onMessage: (message) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      onError: () => {
        setChatLiveAvailable(false);
      },
    });
    chatSocketRef.current = socket;
    return () => {
      socket.close();
      if (chatSocketRef.current === socket) chatSocketRef.current = null;
    };
  }, [selectedCommunityId]);

  useEffect(() => {
    if (!selectedCommunityId || chatLiveAvailable) return;
    const timer = window.setInterval(async () => {
      try {
        const rows = await socialApi.getCommunityMessages(selectedCommunityId);
        setMessages(rows);
      } catch {
        // Keep fallback polling silent.
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [selectedCommunityId, chatLiveAvailable]);

  const handleJoinToggle = async (community: CommunitySummary) => {
    if (community.joined) {
      await socialApi.leaveCommunity(community.id);
    } else {
      await socialApi.joinCommunity(community.id);
    }
    await loadCommunities();
    if (selectedCommunityId) await loadCommunityDetail(selectedCommunityId);
  };

  const handleFollow = async (userId: number) => {
    setFollowBusyId(userId);
    try {
      await socialApi.followUser(userId);
      setWhoToFollow((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setFollowBusyId(null);
    }
  };

  const handleSendChat = async () => {
    if (!selectedCommunityId || !chatText.trim()) return;
    const message = chatText.trim();
    const ws = chatSocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ message }));
      setChatText('');
      return;
    }
    const row = await socialApi.sendCommunityMessage(selectedCommunityId, message);
    setMessages((prev) => [...prev, row]);
    setChatText('');
  };

  const handleSearchMovie = async () => {
    const q = movieQuery.trim();
    if (!q) {
      setMovieResults([]);
      return;
    }
    setIsSearchingMovie(true);
    try {
      const res = await tmdbService.searchMovies(q);
      setMovieResults(res.results.slice(0, 6));
    } catch (e) {
      console.error('Movie search error:', e);
    } finally {
      setIsSearchingMovie(false);
    }
  };

  useEffect(() => {
    if (debouncedMovieQuery.trim()) {
      handleSearchMovie();
    } else {
      setMovieResults([]);
    }
  }, [debouncedMovieQuery]);

  const handleCreateCommunityPost = async () => {
    if (!selectedCommunityId || !postCaption.trim()) return;
    const poster = toPosterUrl(selectedMovie?.poster_path);
    if (!poster) return;

    const created = await socialApi.createCommunityPost(selectedCommunityId, {
      caption: postCaption.trim(),
      image_url: poster,
      movie_title: selectedMovie?.title,
    });

    setPosts((prev) => [mapPost(created), ...prev]);
    setPostCaption('');
    setSelectedMovie(null);
    setMovieQuery('');
    setMovieResults([]);
  };

  const handleLikeToggle = async (postId: string, currentlyLiked: boolean) => {
    if (currentlyLiked) await socialApi.unlikePost(Number(postId));
    else await socialApi.likePost(Number(postId));
  };

  const handleAddComment = async (postId: string, content: string) => {
    await socialApi.addComment(Number(postId), content);
  };

  const handleLoadComments = async (postId: string) => {
    const rows = await socialApi.getComments(Number(postId));
    return rows.map((c) => ({ id: String(c.id), username: c.author.username, text: c.content }));
  };

  const handleDeletePost = async (postId: string) => {
    await socialApi.deletePost(Number(postId));
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleEditPost = async (postId: string, caption: string) => {
    const updated = await socialApi.updatePost(Number(postId), caption);
    setPosts((prev) => prev.map((p) => (p.id === postId ? mapPost(updated) : p)));
  };

  const handleSaveToggle = async (postId: string, currentlySaved: boolean) => {
    if (currentlySaved) await socialApi.unsavePost(Number(postId));
    else await socialApi.savePost(Number(postId));
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSavedByMe: !currentlySaved } : p)));
  };

  const handleDeleteCommunity = async () => {
    if (!selectedCommunity) return;
    const confirmed = window.confirm(`Delete "${selectedCommunity.name}"? Community chat and links will be removed.`);
    if (!confirmed) return;
    await socialApi.deleteCommunity(selectedCommunity.id);
    setCommunities((prev) => prev.filter((c) => c.id !== selectedCommunity.id));
    setSelectedCommunityId(null);
    setMembers([]);
    setPosts([]);
    setMessages([]);
    navigate('/community');
  };

  const handleShareCommunity = async () => {
    if (!selectedCommunity) return;
    const url = `${window.location.origin}/community/${selectedCommunity.id}`;
    await navigator.clipboard?.writeText(url);
    alert('Community link copied');
  };

  const openEditCommunity = () => {
    if (!selectedCommunity) return;
    setEditCommunityName(selectedCommunity.name);
    setEditCommunityDesc(selectedCommunity.description || '');
    setIsEditingCommunity(true);
  };

  const handleUpdateCommunity = async () => {
    if (!selectedCommunity || !editCommunityName.trim()) return;
    setEditCommunityLoading(true);
    try {
      const updated = await socialApi.updateCommunity(selectedCommunity.id, {
        name: editCommunityName.trim(),
        description: editCommunityDesc.trim(),
      });
      setCommunities((prev) => prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)));
      setIsEditingCommunity(false);
      navigate(`/community/${updated.id}`);
    } catch (error) {
      alert((error as Error).message || 'Failed to update community');
    } finally {
      setEditCommunityLoading(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await loadCommunities();
      if (selectedCommunityId) await loadCommunityDetail(selectedCommunityId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateCommunity = async () => {
    if (!newCommunityName.trim()) return;
    setCreateCommunityLoading(true);
    try {
      const created = await socialApi.createCommunity({ name: newCommunityName, description: newCommunityDesc });
      setCommunities((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCommunityId(created.id);
      setIsCreatingCommunity(false);
      setNewCommunityName('');
      setNewCommunityDesc('');
      navigate(`/community/${created.id}`);
    } catch (e: any) {
      alert(e.message || 'Failed to create community');
    } finally {
      setCreateCommunityLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Communities</h2>
              <Button size="sm" variant="outline" className="border-white/20" onClick={refreshAll} disabled={refreshing}>
                <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 mr-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm"
                  placeholder="Search communities"
                  value={communitySearch}
                  onChange={(e) => setCommunitySearch(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={() => setIsCreatingCommunity(true)}>
                <UserPlus className="w-4 h-4 mr-1" /> Create
              </Button>
            </div>
            {loading && <p className="text-sm text-gray-400">Loading communities...</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {filteredCommunities.map((c) => (
              <div key={c.id} className={`glassmorphism border rounded-xl p-3 ${selectedCommunityId === c.id ? 'border-primary/60' : 'border-white/10'}`}>
                <button className="w-full text-left" onClick={() => { setSelectedCommunityId(c.id); navigate(`/community/${c.id}`); }}>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-secondary-foreground">{c.member_count} members</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(COMMUNITY_TOPICS[c.name] || ['Movies']).slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-gray-300 bg-white/5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
                <Button size="sm" className="mt-2 w-full" variant={c.joined ? 'secondary' : 'primary'} onClick={() => handleJoinToggle(c)}>
                  {c.joined ? 'Leave' : 'Join'}
                </Button>
              </div>
            ))}
          </aside>

          <main className="lg:col-span-2 space-y-6">
            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h3 className="font-bold text-lg">{selectedCommunity?.name || 'Community'}</h3>
              <p className="text-sm text-secondary-foreground mb-3">{selectedCommunity?.description}</p>
              {selectedCommunity && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {(COMMUNITY_TOPICS[selectedCommunity.name] || ['Movies']).map((tag) => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-gray-100">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {selectedCommunity && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="border-white/20" onClick={handleShareCommunity}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                  {selectedCommunity.can_manage && (
                    <Button variant="outline" size="sm" className="border-white/20" onClick={openEditCommunity}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {selectedCommunity.can_manage && (
                    <Button variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={handleDeleteCommunity}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Community
                    </Button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="relative mb-2">
                    <input className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-10" placeholder="Search movie" value={movieQuery} onChange={(e) => setMovieQuery(e.target.value)} />
                    {isSearchingMovie && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <Button size="sm" onClick={handleSearchMovie} disabled={isSearchingMovie}>Search Movie</Button>
                  {movieResults.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-auto border border-white/10 rounded">
                      {movieResults.map((m) => (
                        <button key={m.id} className="w-full text-left px-2 py-1 hover:bg-white/10 text-sm" onClick={() => { setSelectedMovie(m); setMovieResults([]); setMovieQuery(m.title); }}>
                          {m.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <textarea className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2" rows={4} placeholder="Write community post" value={postCaption} onChange={(e) => setPostCaption(e.target.value)} />
                </div>
              </div>

              <Button className="mt-3" onClick={handleCreateCommunityPost} disabled={!selectedMovie || !postCaption.trim()}>
                Post in Community
              </Button>
            </section>

            <section className="space-y-4">
              {posts.map((p) => (
                <FeedPost
                  key={p.id}
                  post={p}
                  onLikeToggle={handleLikeToggle}
                  onAddComment={handleAddComment}
                  onLoadComments={handleLoadComments}
                  canDelete={currentUserId === p.user.id}
                  canEdit={currentUserId === p.user.id}
                  onDeletePost={handleDeletePost}
                  onEditPost={handleEditPost}
                  onSaveToggle={handleSaveToggle}
                />
              ))}
              {posts.length === 0 && <p className="text-sm text-secondary-foreground">No community posts yet.</p>}
            </section>

            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Community Chat</h4>
              <div className="max-h-48 overflow-auto space-y-2 mb-3">
                {messages.map((m) => (
                  <div key={m.id} className="text-sm"><span className="font-semibold mr-2">{m.username}</span><span className="text-gray-300">{m.message}</span></div>
                ))}
                {messages.length === 0 && <p className="text-xs text-secondary-foreground">No messages yet.</p>}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2" placeholder="Type a message" value={chatText} onChange={(e) => setChatText(e.target.value)} />
                <Button onClick={handleSendChat}><Send className="w-4 h-4" /></Button>
              </div>
            </section>
          </main>

          <aside className="lg:col-span-1 space-y-6">
            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Members</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <button type="button" onClick={() => navigate(`/profile/${m.username}`)}>
                      <Avatar src={m.avatar_url || ''} name={m.username} className="w-8 h-8" textClassName="text-[10px]" />
                    </button>
                    <button type="button" className="text-left" onClick={() => navigate(`/profile/${m.username}`)}>
                      <p className="text-sm font-medium">{displayName(m.username)}</p>
                      <p className="text-xs text-secondary-foreground line-clamp-1">{m.bio}</p>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Who to Follow</h3>
              <div className="space-y-2 max-h-80 overflow-auto">
                {whoToFollow.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2">
                    <button type="button" className="flex items-center gap-2" onClick={() => navigate(`/profile/${u.username}`)}>
                      <Avatar src={u.avatar_url || ''} name={u.username} className="w-8 h-8" textClassName="text-[10px]" />
                      <p className="text-sm">{displayName(u.username)}</p>
                    </button>
                    <Button size="sm" onClick={() => handleFollow(u.id)} disabled={followBusyId === u.id}>
                      {followBusyId === u.id ? '...' : 'Follow'}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {isCreatingCommunity && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsCreatingCommunity(false)} />
          <div className="relative w-full max-w-md bg-secondary/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-300">
            <h3 className="text-xl font-bold mb-4">Create a Community</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-300 block mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Scifi Lovers"
                  className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-300 block mb-1">Description</label>
                <textarea
                  placeholder="What is this community about?"
                  className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={3}
                  value={newCommunityDesc}
                  onChange={(e) => setNewCommunityDesc(e.target.value)}
                  maxLength={300}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setIsCreatingCommunity(false)}>Cancel</Button>
                <Button onClick={handleCreateCommunity} disabled={!newCommunityName.trim() || createCommunityLoading}>
                  {createCommunityLoading ? 'Creating...' : 'Create Community'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isEditingCommunity && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsEditingCommunity(false)} />
          <div className="relative w-full max-w-md bg-secondary/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-300">
            <h3 className="text-xl font-bold mb-4">Edit Community</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-300 block mb-1">Name</label>
                <input
                  type="text"
                  className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={editCommunityName}
                  onChange={(e) => setEditCommunityName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-300 block mb-1">Description</label>
                <textarea
                  className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={3}
                  value={editCommunityDesc}
                  onChange={(e) => setEditCommunityDesc(e.target.value)}
                  maxLength={300}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setIsEditingCommunity(false)}>Cancel</Button>
                <Button onClick={handleUpdateCommunity} disabled={!editCommunityName.trim() || editCommunityLoading}>
                  {editCommunityLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
