import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Users, Send, UserPlus } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { FeedPost, type Post } from '../components/community/FeedPost';
import { socialApi, type CommunityMember, type CommunityMessage, type CommunitySummary, type SocialPost, type SocialUser } from '../services/socialApi';
import { tmdbService } from '../services/tmdb';
import { resolvePostImages } from '../utils/postImages';

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

  const [chatText, setChatText] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedCommunityId) || null,
    [communities, selectedCommunityId]
  );

  const loadCommunities = async () => {
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
    loadCommunities().catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedCommunityId) return;
    loadCommunityDetail(selectedCommunityId).catch(console.error);
  }, [selectedCommunityId]);

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
    await socialApi.followUser(userId);
    setWhoToFollow((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleSendChat = async () => {
    if (!selectedCommunityId || !chatText.trim()) return;
    const row = await socialApi.sendCommunityMessage(selectedCommunityId, chatText.trim());
    setMessages((prev) => [...prev, row]);
    setChatText('');
  };

  const handleSearchMovie = async () => {
    if (!movieQuery.trim()) {
      setMovieResults([]);
      return;
    }
    const res = await tmdbService.searchMovies(movieQuery.trim());
    setMovieResults(res.results.slice(0, 6));
  };

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

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-3">
            <h2 className="text-xl font-bold">Communities</h2>
            {communities.map((c) => (
              <div key={c.id} className={`glassmorphism border rounded-xl p-3 ${selectedCommunityId === c.id ? 'border-primary/60' : 'border-white/10'}`}>
                <button className="w-full text-left" onClick={() => { setSelectedCommunityId(c.id); navigate(`/community/${c.id}`); }}>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-secondary-foreground">{c.member_count} members</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <input className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 mb-2" placeholder="Search movie" value={movieQuery} onChange={(e) => setMovieQuery(e.target.value)} />
                  <Button size="sm" onClick={handleSearchMovie}>Search Movie</Button>
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
                <FeedPost key={p.id} post={p} onLikeToggle={handleLikeToggle} onAddComment={handleAddComment} onLoadComments={handleLoadComments} />
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
                      <img src={m.avatar_url || fallbackAvatar} className="w-8 h-8 rounded-full object-cover" />
                    </button>
                    <button type="button" className="text-left" onClick={() => navigate(`/profile/${m.username}`)}>
                      <p className="text-sm font-medium">{m.username}</p>
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
                      <img src={u.avatar_url || fallbackAvatar} className="w-8 h-8 rounded-full object-cover" />
                      <p className="text-sm">{u.username}</p>
                    </button>
                    <Button size="sm" onClick={() => handleFollow(u.id)}>Follow</Button>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};
