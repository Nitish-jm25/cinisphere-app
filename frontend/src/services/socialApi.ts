export const SOCIAL_API_BASE_URL = (import.meta.env.VITE_SOCIAL_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const SOCIAL_API_BASE_URL_ALT = SOCIAL_API_BASE_URL.endsWith('/api')
  ? SOCIAL_API_BASE_URL.slice(0, -4)
  : `${SOCIAL_API_BASE_URL}/api`;

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  username: string;
  email: string;
}

export interface SocialUser {
  id: number;
  username: string;
  email: string;
  bio: string;
  avatar_url: string | null;
  is_email_verified?: boolean;
  created_at: string;
  is_following?: boolean;
}

export interface UserProfileResponse {
  user: SocialUser;
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

export interface SocialPost {
  id: number;
  user_id: number;
  image_url: string;
  caption: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  author: {
    id: number;
    username: string;
    avatar_url: string | null;
  };
  image_urls: string[];
}

export interface SocialComment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  author: {
    id: number;
    username: string;
    avatar_url: string | null;
  };
}

export interface PostCommentItem {
  id: number;
  content: string;
  created_at: string;
  author: {
    id: number;
    username: string;
    avatar_url: string | null;
  };
}

export interface CommunitySummary {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  member_count: number;
  joined: boolean;
}

export interface CommunityMember {
  id: number;
  username: string;
  avatar_url: string | null;
  bio: string;
}

export interface CommunityMessage {
  id: number;
  community_id: number;
  created_at: string;
  username: string;
  avatar_url: string | null;
  message: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  actor_id: number | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  resource_id: number | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const saveAuthSession = (data: AuthResponse) => {
  localStorage.setItem('auth_token', data.access_token);
  localStorage.setItem('current_user_id', String(data.user_id));
  localStorage.setItem('current_user_name', data.username || '');
  localStorage.setItem('current_user_email', data.email || '');
};

export const clearAuthSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user_id');
  localStorage.removeItem('current_user_name');
  localStorage.removeItem('current_user_email');
};

const getToken = () => localStorage.getItem('auth_token');

const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const call = async (base: string) =>
    fetch(`${base}${path}`, {
      ...init,
      headers,
    });

  let response = await call(SOCIAL_API_BASE_URL);
  if (response.status === 404) {
    response = await call(SOCIAL_API_BASE_URL_ALT);
  }

  if (response.status === 401) {
    clearAuthSession();
  }

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json();
      message = body?.detail || message;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
};

export const socialApi = {
  async register(payload: { username: string; email: string; password: string }) {
    return apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(payload: { email: string; password: string }) {
    return apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async requestEmailVerification(email: string) {
    return apiFetch<{ success: boolean }>('/auth/verify-email/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async confirmEmailVerification(token: string) {
    return apiFetch<{ success: boolean }>('/auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async requestPasswordReset(email: string) {
    return apiFetch<{ success: boolean; reset_url?: string | null }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async confirmPasswordReset(token: string, newPassword: string) {
    return apiFetch<{ success: boolean }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },

  async me() {
    return apiFetch<SocialUser>('/users/me');
  },

  async getUserProfile(username: string) {
    return apiFetch<UserProfileResponse>(`/users/${encodeURIComponent(username)}`);
  },

  async getUserFollowers(username: string) {
    return apiFetch<{ users: SocialUser[] }>(`/users/${encodeURIComponent(username)}/followers`);
  },

  async getUserFollowing(username: string) {
    return apiFetch<{ users: SocialUser[] }>(`/users/${encodeURIComponent(username)}/following`);
  },

  async updateProfile(payload: { bio?: string; avatar_url?: string }) {
    return apiFetch<SocialUser>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async uploadProfileAvatar(avatarFile: File) {
    const token = getToken();
    const formData = new FormData();
    formData.append('avatar_file', avatarFile);

    const call = async (base: string) =>
      fetch(`${base}/users/profile/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

    let response = await call(SOCIAL_API_BASE_URL);
    if (response.status === 404) {
      response = await call(SOCIAL_API_BASE_URL_ALT);
    }
    if (response.status === 401) {
      clearAuthSession();
    }
    if (!response.ok) {
      let message = 'Avatar upload failed';
      try {
        const body = await response.json();
        message = body?.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return response.json() as Promise<SocialUser>;
  },

  async followUser(userId: number) {
    return apiFetch<{ success: boolean; message: string }>(`/users/${userId}/follow`, {
      method: 'POST',
    });
  },

  async unfollowUser(userId: number) {
    return apiFetch<{ success: boolean; message: string }>(`/users/${userId}/follow`, {
      method: 'DELETE',
    });
  },

  async searchUsers(query: string) {
    return apiFetch<{ users: SocialUser[] }>(`/users/search?q=${encodeURIComponent(query)}`);
  },

  async getSuggestedUsers(limit = 10) {
    return apiFetch<{ users: SocialUser[] }>(`/users/suggestions?limit=${limit}`);
  },

  async getDiscoverUsers(limit = 20) {
    return apiFetch<{ users: SocialUser[] }>(`/users/discover?limit=${limit}`);
  },

  async createPost(payload: { image_url: string; caption: string; movie_title?: string }) {
    return apiFetch<SocialPost>('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createPostWithUpload(payload: {
    caption: string;
    movie_title?: string;
    image_url?: string;
    image_file?: File;
    image_files?: File[];
  }) {
    const token = getToken();
    const formData = new FormData();
    formData.append('caption', payload.caption || '');
    if (payload.movie_title) formData.append('movie_title', payload.movie_title);
    if (payload.image_url) formData.append('image_url', payload.image_url);
    if (payload.image_file) formData.append('image_file', payload.image_file);
    if (payload.image_files?.length) {
      payload.image_files.forEach((file) => formData.append('image_files', file));
    }

    const call = async (base: string) =>
      fetch(`${base}/posts/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

    let response = await call(SOCIAL_API_BASE_URL);
    if (response.status === 404) {
      response = await call(SOCIAL_API_BASE_URL_ALT);
    }
    if (response.status === 401) {
      clearAuthSession();
    }
    if (!response.ok) {
      let message = 'Request failed';
      try {
        const body = await response.json();
        message = body?.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return response.json() as Promise<SocialPost>;
  },

  async deletePost(postId: number) {
    return apiFetch<{ success: boolean }>(`/posts/${postId}`, {
      method: 'DELETE',
    });
  },

  async getFeed(limit = 20, offset = 0) {
    return apiFetch<SocialPost[]>(`/posts/feed?limit=${limit}&offset=${offset}`);
  },

  async getUserPosts(userId: number, limit = 20, offset = 0) {
    return apiFetch<SocialPost[]>(`/posts/user/${userId}?limit=${limit}&offset=${offset}`);
  },

  async likePost(postId: number) {
    return apiFetch<{ success: boolean; message: string }>(`/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  async unlikePost(postId: number) {
    return apiFetch<{ success: boolean; message: string }>(`/posts/${postId}/like`, {
      method: 'DELETE',
    });
  },

  async addComment(postId: number, content: string) {
    return apiFetch<SocialComment>(`/posts/${postId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async getComments(postId: number) {
    return apiFetch<PostCommentItem[]>(`/posts/${postId}/comments`);
  },

  async listCommunities() {
    return apiFetch<{ communities: CommunitySummary[] }>('/communities');
  },

  async joinCommunity(communityId: number) {
    return apiFetch<{ success: boolean; message: string }>(`/communities/${communityId}/join`, {
      method: 'POST',
    });
  },

  async leaveCommunity(communityId: number) {
    return apiFetch<{ success: boolean; message: string }>(`/communities/${communityId}/leave`, {
      method: 'DELETE',
    });
  },

  async getCommunityMembers(communityId: number) {
    return apiFetch<{ members: CommunityMember[] }>(`/communities/${communityId}/members`);
  },

  async getCommunityPosts(communityId: number) {
    return apiFetch<SocialPost[]>(`/communities/${communityId}/posts`);
  },

  async createCommunityPost(communityId: number, payload: { caption: string; image_url: string; movie_title?: string }) {
    return apiFetch<SocialPost>(`/communities/${communityId}/posts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCommunityMessages(communityId: number) {
    return apiFetch<CommunityMessage[]>(`/chat/communities/${communityId}/messages`);
  },

  async sendCommunityMessage(communityId: number, message: string) {
    return apiFetch<CommunityMessage>(`/chat/communities/${communityId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async deleteComment(commentId: number) {
    return apiFetch<{ success: boolean }>(`/comments/${commentId}`, {
      method: 'DELETE',
    });
  },

  connectCommunityChat(communityId: number, handlers: {
    onMessage: (message: CommunityMessage) => void;
    onError?: (message: string) => void;
  }) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    const base = SOCIAL_API_BASE_URL.endsWith('/api') ? SOCIAL_API_BASE_URL.slice(0, -4) : SOCIAL_API_BASE_URL;
    const wsBase = base.replace(/^http/i, 'ws');
    const ws = new WebSocket(`${wsBase}/chat/ws/communities/${communityId}?token=${encodeURIComponent(token)}`);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'error') {
          handlers.onError?.(payload.detail || 'Chat error');
          return;
        }
        if (payload?.type === 'message') {
          handlers.onMessage(payload as CommunityMessage);
        }
      } catch {
        // ignore malformed payloads
      }
    };
    ws.onerror = () => {
      handlers.onError?.('Chat connection failed');
    };
    return ws;
  },

  async listNotifications(limit = 30, offset = 0) {
    return apiFetch<{ notifications: NotificationItem[]; unread_count: number }>(
      `/notifications?limit=${limit}&offset=${offset}`
    );
  },

  async markNotificationsRead(ids: number[] = []) {
    return apiFetch<{ success: boolean; updated: number }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async blockUser(userId: number) {
    return apiFetch<{ success: boolean; message: string }>('/moderation/block', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  async unblockUser(userId: number) {
    return apiFetch<{ success: boolean; message: string }>(`/moderation/block/${userId}`, {
      method: 'DELETE',
    });
  },

  async report(payload: { target_user_id?: number; target_post_id?: number; reason: string; details?: string }) {
    return apiFetch<{ success: boolean; report_id: number }>('/moderation/report', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
