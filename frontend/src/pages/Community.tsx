
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Users, Send, Search, ArrowLeft } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { FeedPost, type Post } from '../components/community/FeedPost';
import { socialApi, type CommunityMember, type CommunityMessage, type CommunitySummary } from '../services/socialApi';
import { tmdbService } from '../services/tmdb';
import { resolvePostImages } from '../utils/postImages';

const displayName = (username: string) =>
  username
    .replace(/[_\.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

const timeAgo = (createdAt: string): string => {
  const date = new Date(createdAt).getTime();
  const now = Date.now();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

export const Community = () => {
    const { communityId } = useParams();
    const navigate = useNavigate();
    
    if (!communityId) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center pt-20">
                <div className="text-center max-w-md">
                    <h1 className="text-3xl font-bold mb-4 text-glow">No Community Selected</h1>
                    <p className="text-secondary-foreground mb-6">Please select a community or go back to explore communities.</p>
                    <Button onClick={() => navigate('/community')}>Browse Communities</Button>
                </div>
            </div>
        );
    }
    
    return <Communities communityId={Number(communityId)} />;
};

interface CommunitiesProps {
    communityId?: number;
}

const Communities = ({ communityId: initialCommunityId }: CommunitiesProps) => {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(initialCommunityId || null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatText, setChatText] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);

  const chatSocketRef = useRef<WebSocket | null>(null);
  const [chatLiveAvailable, setChatLiveAvailable] = useState(true);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedCommunityId) || null,
    [communities, selectedCommunityId]
  );

  const mapPost = (p: any): Post => {
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
    };
  };

  const toPosterUrl = (posterPath?: string | null) => {
    if (!posterPath) return '';
    return posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w780${posterPath}`;
  };

  const loadCommunities = async () => {
    setError('');
    try {
      const res = await socialApi.listCommunities();
      setCommunities(res.communities);
      if (!selectedCommunityId && res.communities.length > 0) {
        setSelectedCommunityId(res.communities[0].id);
      }
    } catch (e) {
      setError((e as Error).message || 'Failed to load communities');
    }
  };

  const loadCommunityDetail = async (communityId: number) => {
    try {
      const [membersRes, postRes, msgRes] = await Promise.all([
        socialApi.getCommunityMembers(communityId),
        socialApi.getCommunityPosts(communityId),
        socialApi.getCommunityMessages(communityId),
      ]);
      setMembers(membersRes.members);
      setPosts(postRes.map(mapPost));
      setMessages(msgRes);
    } catch (e) {
      console.error('Failed to load community detail:', e);
    }
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

  const handleJoinToggle = async (community: CommunitySummary) => {
    if (community.joined) {
      await socialApi.leaveCommunity(community.id);
    } else {
      await socialApi.joinCommunity(community.id);
    }
    await loadCommunities();
    if (selectedCommunityId) await loadCommunityDetail(selectedCommunityId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-20">
        <div className="text-gray-400">Loading community...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/community')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-glow">{selectedCommunity?.name || 'Community'}</h1>
        </div>
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <main className="lg:col-span-2 space-y-6">
            {/* Post Creation Section */}
            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h3 className="font-bold text-lg mb-3">Share Your Thoughts</h3>
              
              {/* Movie Search */}
              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-300 block mb-2">Search & Select Movie</label>
                <div className="flex gap-2 mb-2">
                  <input 
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" 
                    placeholder="Search movie..." 
                    value={movieQuery} 
                    onChange={(e) => setMovieQuery(e.target.value)} 
                  />
                  <Button size="sm" onClick={handleSearchMovie}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {selectedMovie && (
                  <div className="mb-3 flex items-center gap-2 p-2 bg-primary/10 border border-primary/30 rounded-lg">
                    <span className="text-sm flex-1">{selectedMovie.title}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedMovie(null); setMovieQuery(''); }}>Clear</Button>
                  </div>
                )}
                {movieResults.length > 0 && (
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    {movieResults.map((m) => (
                      <button 
                        key={m.id} 
                        className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm border-b border-white/5 last:border-b-0 transition-colors"
                        onClick={() => { 
                          setSelectedMovie(m); 
                          setMovieResults([]); 
                          setMovieQuery(m.title); 
                        }}
                      >
                        {m.title} {m.release_date && `(${new Date(m.release_date).getFullYear()})`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Post Caption */}
              <div>
                <label className="text-sm font-semibold text-gray-300 block mb-2">Your Comment</label>
                <textarea 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" 
                  rows={4} 
                  placeholder="What do you think about this movie..." 
                  value={postCaption} 
                  onChange={(e) => setPostCaption(e.target.value)} 
                />
              </div>

              <Button 
                className="mt-3 w-full" 
                onClick={handleCreateCommunityPost} 
                disabled={!selectedMovie || !postCaption.trim()}
              >
                Post Comment
              </Button>
            </section>

            {/* Community Posts Feed */}
            <section className="space-y-4">
              <h3 className="font-bold text-lg">Community Discussion</h3>
              {posts.length === 0 ? (
                <p className="text-sm text-secondary-foreground">No posts yet. Be the first to share!</p>
              ) : (
                posts.map((p) => (
                  <FeedPost 
                    key={p.id} 
                    post={p} 
                    onLikeToggle={handleLikeToggle} 
                    onAddComment={handleAddComment} 
                    onLoadComments={handleLoadComments} 
                  />
                ))
              )}
            </section>

            {/* Community Chat */}
            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Community Chat</h4>
              <div className="max-h-48 overflow-auto space-y-2 mb-3 bg-black/20 rounded-lg p-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-secondary-foreground">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="font-semibold text-primary mr-2">{m.username}</span>
                      <span className="text-gray-300">{m.message}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" 
                  placeholder="Message community..." 
                  value={chatText} 
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                />
                <Button onClick={handleSendChat} size="sm">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </section>
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-2 space-y-6">
            {/* Community Info */}
            {selectedCommunity && (
              <section className="glassmorphism border border-white/10 rounded-xl p-4">
                <h3 className="font-bold mb-2">About</h3>
                <p className="text-sm text-secondary-foreground mb-3">{selectedCommunity.description}</p>
                <div className="text-sm space-y-1 mb-4">
                  <p><span className="font-semibold">{selectedCommunity.member_count}</span> members</p>
                </div>
                <Button 
                  className="w-full" 
                  variant={selectedCommunity.joined ? 'secondary' : 'primary'}
                  onClick={() => handleJoinToggle(selectedCommunity)}
                >
                  {selectedCommunity.joined ? 'Leave Community' : 'Join Community'}
                </Button>
              </section>
            )}

            {/* Community Members */}
            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Members</h3>
              {members.length === 0 ? (
                <p className="text-sm text-secondary-foreground">No members yet.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {members.map((m) => (
                    <div 
                      key={m.id} 
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => navigate(`/profile/${m.username}`)}
                    >
                      <Avatar src={m.avatar_url || ''} name={m.username} className="w-8 h-8" textClassName="text-[10px]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{displayName(m.username)}</p>
                        <p className="text-xs text-secondary-foreground line-clamp-1">{m.bio}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Other Communities */}
            <section className="glassmorphism border border-white/10 rounded-xl p-4">
              <h3 className="font-bold mb-3">Other Communities</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {communities
                  .filter((c) => c.id !== selectedCommunityId)
                  .slice(0, 5)
                  .map((c) => (
                    <div key={c.id} className="p-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                      <button 
                        className="w-full text-left"
                        onClick={() => {
                          setSelectedCommunityId(c.id);
                          navigate(`/community/${c.id}`);
                        }}
                      >
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-secondary-foreground">{c.member_count} members</p>
                      </button>
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
