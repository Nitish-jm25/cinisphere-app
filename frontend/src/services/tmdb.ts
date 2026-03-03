export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');

export interface Movie {
    id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    vote_average: number;
    release_date: string;
    genre_ids: number[];
    overview: string;
    runtime?: number;
    videos?: { results: { key: string; type: string; site: string }[] };
    images?: { backdrops: { file_path: string }[] };
}

export interface CastBadge {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
}

export interface CrewBadge {
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
}

export interface MovieCredits {
    id: number;
    cast: CastBadge[];
    crew: CrewBadge[];
}

// Mock Data targeting high quality public domain/stock imagery concepts
const COMMON_VIDEOS = {
    results: [
        { key: 'dQw4w9WgXcQ', type: 'Trailer', site: 'YouTube' },
        { key: 'tY1jZ7u6kEo', type: 'Teaser', site: 'YouTube' }
    ]
};

const COMMON_IMAGES = {
    backdrops: [
        { file_path: '/placeholder.jpg' },
        { file_path: '/placeholder.jpg' },
        { file_path: '/placeholder.jpg' }
    ]
};

export const MOCK_MOVIES: Movie[] = [
    { id: 1, title: 'Inception', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 8.8, release_date: '2010-07-15', genre_ids: [28, 878], overview: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', runtime: 148, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
    { id: 2, title: 'Interstellar', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 8.6, release_date: '2014-11-05', genre_ids: [12, 18, 878], overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.', runtime: 169, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
    { id: 3, title: 'The Dark Knight', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 9.0, release_date: '2008-07-16', genre_ids: [28, 80, 18], overview: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', runtime: 152, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
    { id: 4, title: 'Dune: Part Two', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 8.3, release_date: '2024-02-27', genre_ids: [878, 12], overview: 'Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.', runtime: 166, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
    { id: 5, title: 'Oppenheimer', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 8.1, release_date: '2023-07-19', genre_ids: [18, 36], overview: 'The story of J. Robert Oppenheimer\'s role in the development of the atomic bomb during World War II.', runtime: 180, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
    { id: 6, title: 'Blade Runner 2049', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 8.0, release_date: '2017-10-04', genre_ids: [878, 18], overview: 'Young Blade Runner K\'s discovery of a long-buried secret leads him to track down former Blade Runner Rick Deckard, who\'s been missing for thirty years.', runtime: 164, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
    { id: 7, title: 'Spider-Man: Across the Spider-Verse', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 8.4, release_date: '2023-05-31', genre_ids: [16, 28, 12], overview: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.', runtime: 140, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
    { id: 8, title: 'Parasite', poster_path: '/placeholder.jpg', backdrop_path: '/placeholder.jpg', vote_average: 8.5, release_date: '2019-05-30', genre_ids: [35, 53, 18], overview: 'All unemployed, Ki-taek\'s family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.', runtime: 132, videos: COMMON_VIDEOS, images: COMMON_IMAGES },
];

export const MOCK_GENRES: Record<number, string> = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
};

export const tmdbService = {
    getConfig: async () => {
        const response = await fetch(`${API_BASE_URL}/tmdb/configuration`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getTrendingMovies: async (): Promise<{ results: Movie[] }> => {
        const response = await fetch(`${API_BASE_URL}/tmdb/trending`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getRecommendedMovies: async (): Promise<{ results: Movie[] }> => {
        const response = await fetch(`${API_BASE_URL}/tmdb/top-rated`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getUpcomingMovies: async (): Promise<{ results: Movie[] }> => {
        const response = await fetch(`${API_BASE_URL}/tmdb/upcoming`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getMoodPicks: async (): Promise<{ results: Movie[] }> => {
        // Fetch popular movies as a proxy for mood picks for now
        const response = await fetch(`${API_BASE_URL}/tmdb/popular`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getTamilMovies: async (): Promise<{ results: Movie[] }> => {
        const response = await fetch(`${API_BASE_URL}/tmdb/discover/tamil`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getMovieDetails: async (id: string): Promise<Movie> => {
        const response = await fetch(`${API_BASE_URL}/tmdb/movie/${id}`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    searchMovies: async (query: string): Promise<{ results: Movie[] }> => {
        const response = await fetch(`${API_BASE_URL}/tmdb/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getMovieCredits: async (id: number): Promise<MovieCredits> => {
        const response = await fetch(`${API_BASE_URL}/tmdb/movie/${id}/credits`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    }
};
