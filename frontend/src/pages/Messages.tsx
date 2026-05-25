import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, Search, Send } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { socialApi, type DirectConversation, type DirectMessage, type SocialUser } from '../services/socialApi';
import { timeAgo } from '../utils/time';

type ChatUser = {
  id: number;
  username: string;
  avatar_url: string | null;
};

export const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);

  const loadConversations = async () => {
    const rows = await socialApi.getDirectConversations();
    setConversations(rows);
    if (!selectedUser && rows[0]) setSelectedUser(rows[0].user);
  };

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = Number(searchParams.get('user'));
    const username = searchParams.get('username');
    const avatar = searchParams.get('avatar');
    if (id && username) {
      setSelectedUser({ id, username, avatar_url: avatar || null });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }
    setThreadLoading(true);
    socialApi.getDirectMessages(selectedUser.id)
      .then(setMessages)
      .finally(() => setThreadLoading(false));
  }, [selectedUser?.id]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await socialApi.searchUsers(q);
      if (!cancelled) setResults(res.users.filter((row) => row.id !== user?.id).slice(0, 6));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, user?.id]);

  const conversationUsers = useMemo(() => conversations.map((row) => row.user.id), [conversations]);

  const sendMessage = async () => {
    if (!selectedUser || !text.trim()) return;
    const message = text.trim();
    setText('');
    const saved = await socialApi.sendDirectMessage(selectedUser.id, message);
    setMessages((prev) => [...prev, saved]);
    loadConversations().catch(() => null);
  };

  const chooseUser = (nextUser: ChatUser) => {
    setSelectedUser(nextUser);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="min-h-screen pt-24 pb-10 px-4 md:px-8 bg-background text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-primary font-semibold">Private cinema notes</p>
            <h1 className="text-3xl md:text-4xl font-bold">Messages</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-[340px_1fr] border border-white/10 rounded-xl overflow-hidden bg-white/[0.03] min-h-[620px]">
          <aside className="border-b lg:border-b-0 lg:border-r border-white/10">
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users"
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-3 outline-none focus:border-primary"
                />
              </div>
              {results.length > 0 && (
                <div className="mt-2 space-y-1">
                  {results.map((result) => (
                    <button key={result.id} onClick={() => chooseUser(result)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {result.avatar_url ? <img src={result.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{result.username.slice(0, 2).toUpperCase()}</span>}
                      </div>
                      <span className="font-semibold">@{result.username}</span>
                      {!conversationUsers.includes(result.id) && <span className="ml-auto text-xs text-primary">new</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                Start a private conversation by searching for a user.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {conversations.map((conversation) => {
                  const active = selectedUser?.id === conversation.user.id;
                  return (
                    <button
                      key={conversation.user.id}
                      onClick={() => chooseUser(conversation.user)}
                      className={`w-full flex gap-3 p-4 text-left transition ${active ? 'bg-primary/15' : 'hover:bg-white/5'}`}
                    >
                      <div className="w-11 h-11 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                        {conversation.user.avatar_url ? <img src={conversation.user.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold">{conversation.user.username.slice(0, 2).toUpperCase()}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate">@{conversation.user.username}</p>
                          {conversation.unread_count > 0 && <span className="text-[10px] bg-primary rounded-full px-2 py-0.5">{conversation.unread_count}</span>}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{conversation.last_message.message}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <main className="flex flex-col min-h-[620px]">
            {selectedUser ? (
              <>
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <Link to={`/profile/${selectedUser.username}`} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                      {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold">{selectedUser.username.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div>
                      <p className="font-bold">@{selectedUser.username}</p>
                      <p className="text-xs text-gray-500">Private messages</p>
                    </div>
                  </Link>
                </div>

                <div className="flex-1 p-4 overflow-auto space-y-3">
                  {threadLoading ? (
                    <div className="h-full flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">No messages yet.</div>
                  ) : (
                    messages.map((message) => {
                      const mine = message.sender_id === user?.id;
                      return (
                        <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${mine ? 'bg-primary text-white rounded-br-sm' : 'bg-white/10 text-gray-100 rounded-bl-sm'}`}>
                            <p className="whitespace-pre-wrap break-words">{message.message}</p>
                            <p className={`text-[11px] mt-1 ${mine ? 'text-white/70' : 'text-gray-500'}`}>{timeAgo(message.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendMessage();
                      }}
                      placeholder="Write a message"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-primary"
                    />
                    <button onClick={sendMessage} disabled={!text.trim()} className="w-12 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-gray-500 p-8">
                <div>
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                  <p className="font-semibold text-gray-300">Choose someone to message</p>
                  <p className="text-sm mt-1">Search for a user or open an existing conversation.</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
