import { socialApi } from './socialApi';

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  bio: string;
  followers: number;
  following: number;
  favoriteGenres: string[];
  isFriend: boolean;
}

export interface Community {
  id: string;
  name: string;
  imageUrl: string;
  memberCount: number;
  description: string;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';

const mapUser = (user: {
  id: number;
  username: string;
  bio: string;
  avatar_url: string | null;
}): User => ({
  id: String(user.id),
  username: user.username,
  avatarUrl: user.avatar_url || DEFAULT_AVATAR,
  bio: user.bio || 'Movie enthusiast',
  followers: 0,
  following: 0,
  favoriteGenres: [],
  isFriend: false,
});

export const dataService = {
  getSuggestedFriends: async (): Promise<User[]> => {
    try {
      const result = await socialApi.getSuggestedUsers(12);
      return result.users.map(mapUser);
    } catch {
      return [];
    }
  },

  searchUsers: async (query: string): Promise<User[]> => {
    if (!query.trim()) return [];
    try {
      const result = await socialApi.searchUsers(query);
      return result.users.map(mapUser);
    } catch {
      return [];
    }
  },

  searchCommunities: async (_query: string): Promise<Community[]> => {
    try {
      const response = await socialApi.listCommunities();
      const q = _query.trim().toLowerCase();
      const communities = response.communities
        .map((c) => ({
          id: String(c.id),
          name: c.name,
          imageUrl: c.image_url || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=150',
          memberCount: c.member_count,
          description: c.description,
        }))
        .filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
      return communities;
    } catch {
      return [];
    }
  },
};
