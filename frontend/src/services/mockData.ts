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

export const MOCK_USERS: User[] = [
    {
        id: 'u1',
        username: 'cinephile99',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        bio: 'I watch too many movies.',
        followers: 1420,
        following: 340,
        favoriteGenres: ['Sci-Fi', 'Thriller'],
        isFriend: false
    },
    {
        id: 'u2',
        username: 'sarah_watches',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        bio: 'Horror & Romance enthusiast.',
        followers: 890,
        following: 120,
        favoriteGenres: ['Horror', 'Romance'],
        isFriend: true
    },
    {
        id: 'u3',
        username: 'movie_buff_dan',
        avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150',
        bio: 'Action movies all day.',
        followers: 432,
        following: 55,
        favoriteGenres: ['Action', 'Adventure'],
        isFriend: false
    },
    {
        id: 'u4',
        username: 'indie_lover',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
        bio: 'Support independent cinema!',
        followers: 2100,
        following: 400,
        favoriteGenres: ['Drama', 'Documentary'],
        isFriend: false
    },
    {
        id: 'u5',
        username: 'classic_film_fan',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        bio: 'Black and white is better.',
        followers: 340,
        following: 20,
        favoriteGenres: ['Classic', 'Drama'],
        isFriend: false
    },
    {
        id: 'u6',
        username: 'alex_reviews',
        avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150',
        bio: 'Honest movie reviews.',
        followers: 5600,
        following: 1200,
        favoriteGenres: ['Thriller', 'Mystery'],
        isFriend: false
    }
];

export const MOCK_COMMUNITIES: Community[] = [
    {
        id: 'c1',
        name: 'Sci-Fi Geeks',
        imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150',
        memberCount: 15400,
        description: 'For lovers of science fiction and space.'
    },
    {
        id: 'c2',
        name: 'Horror Hounds',
        imageUrl: 'https://images.unsplash.com/photo-1505635552518-3448ff116af3?w=150',
        memberCount: 8200,
        description: 'Scary movies only.'
    },
    {
        id: 'c3',
        name: 'A24 Fans',
        imageUrl: 'https://images.unsplash.com/photo-1485603759714-2c744c8b0b5d?w=150',
        memberCount: 22000,
        description: 'Discussing the best of A24 films.'
    },
    {
        id: 'c4',
        name: 'Classic Cinema',
        imageUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=150',
        memberCount: 5600,
        description: 'Appreciating the golden age of cinema.'
    }
];

export const dataService = {
    getSuggestedFriends: async (): Promise<User[]> => {
        // Simulate network delay
        return new Promise((resolve) => {
            setTimeout(() => {
                // Return non-friends as suggestions
                resolve(MOCK_USERS.filter(u => !u.isFriend));
            }, 600);
        });
    },

    searchUsers: async (query: string): Promise<User[]> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const q = query.toLowerCase();
                resolve(MOCK_USERS.filter(u =>
                    u.username.toLowerCase().includes(q) ||
                    u.bio.toLowerCase().includes(q)
                ));
            }, 400);
        });
    },

    searchCommunities: async (query: string): Promise<Community[]> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const q = query.toLowerCase();
                resolve(MOCK_COMMUNITIES.filter(c =>
                    c.name.toLowerCase().includes(q) ||
                    c.description.toLowerCase().includes(q)
                ));
            }, 400);
        });
    }
};
