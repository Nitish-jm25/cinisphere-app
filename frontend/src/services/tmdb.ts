export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');

export interface Movie {
    id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    imdb_id?: string | null;
    vote_average: number;
    vote_count?: number;
    popularity?: number;
    release_date: string;
    genre_ids: number[];
    genres?: { id: number; name: string }[];
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

const fetchWithTimeout = async (url: string, timeoutMs = 15000): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const safeResults = (payload: any): { results: Movie[] } => {
    if (payload && Array.isArray(payload.results)) {
        return { results: payload.results };
    }
    return { results: [] };
};

export const tmdbService = {
    getConfig: async () => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/configuration`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    },

    getTrendingMovies: async (): Promise<{ results: Movie[] }> => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/trending`);
            if (!response.ok) throw new Error('Network error');
            return safeResults(await response.json());
        } catch (error) {
            console.error('Failed to fetch trending movies', error);
            return { results: [] };
        }
    },

    getRecommendedMovies: async (): Promise<{ results: Movie[] }> => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/top-rated`);
            if (!response.ok) throw new Error('Network error');
            return safeResults(await response.json());
        } catch (error) {
            console.error('Failed to fetch recommended movies', error);
            return { results: [] };
        }
    },

    getUpcomingMovies: async (): Promise<{ results: Movie[] }> => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/upcoming`);
            if (!response.ok) throw new Error('Network error');
            return safeResults(await response.json());
        } catch (error) {
            console.error('Failed to fetch upcoming movies', error);
            return { results: [] };
        }
    },

    getMoodPicks: async (params?: { mood?: string | null; language?: string | null; genres?: string[]; mindset?: string | null }): Promise<{ results: Movie[] }> => {
        try {
            const q = new URLSearchParams();
            if (params?.mood) q.set('mood', params.mood);
            if (params?.mindset) q.set('mindset', params.mindset);
            if (params?.language) q.set('language', params.language);
            if (params?.genres?.length) q.set('genres', params.genres.join(','));
            const suffix = q.toString() ? `?${q.toString()}` : '';
            const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/mood-picks${suffix}`);
            if (!response.ok) throw new Error('Network error');
            return safeResults(await response.json());
        } catch (error) {
            console.error('Failed to fetch mood picks', error);
            return { results: [] };
        }
    },

    getTamilMovies: async (): Promise<{ results: Movie[] }> => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/discover/tamil`);
            if (!response.ok) throw new Error('Network error');
            return safeResults(await response.json());
        } catch (error) {
            console.error('Failed to fetch Tamil movies', error);
            return { results: [] };
        }
    },

    getMovieDetails: async (id: string): Promise<Movie> => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/movie/${id}`);
        if (!response.ok) throw new Error('Network error');
        const movie = await response.json();
        const normalizedGenreIds = Array.isArray(movie.genre_ids)
            ? movie.genre_ids
            : Array.isArray(movie.genres)
                ? movie.genres.map((g: { id: number }) => g.id)
                : [];
        return { ...movie, genre_ids: normalizedGenreIds };
    },

    searchMovies: async (query: string): Promise<{ results: Movie[] }> => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Network error');
            return safeResults(await response.json());
        } catch (error) {
            console.error('Failed to search movies', error);
            return { results: [] };
        }
    },

    getMovieCredits: async (id: number): Promise<MovieCredits> => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/tmdb/movie/${id}/credits`);
        if (!response.ok) throw new Error('Network error');
        return response.json();
    }
};
