import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Smile, 
    Frown, 
    Zap, 
    Coffee, 
    Heart, 
    ChevronDown, 
    Sparkles, 
    Film, 
    Search,
    RefreshCcw
} from 'lucide-react';
import { cn } from '../utils/cn';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');

type Mood = 'Happy' | 'Sad' | 'Excited' | 'Relaxed' | 'Romantic';

interface SurveyData {
    mood: Mood | null;
    language: string;
    movieType: string;
}

interface MovieRecommendation {
    movie_id: number;
    title: string;
    overview?: string;
    poster_path?: string | null;
    release_date?: string;
    genres?: string[];
}

interface SimilarUser {
    user_id: string;
    similarity: number;
    name?: string;
}

interface TailorFitResult {
    recommendations: MovieRecommendation[];
    similar_users: SimilarUser[];
}

const moods: { type: Mood; icon: any; color: string }[] = [
    { type: 'Happy', icon: <Smile className="w-6 h-6" />, color: 'hover:text-yellow-400 hover:bg-yellow-400/10' },
    { type: 'Sad', icon: <Frown className="w-6 h-6" />, color: 'hover:text-blue-400 hover:bg-blue-400/10' },
    { type: 'Excited', icon: <Zap className="w-6 h-6" />, color: 'hover:text-orange-400 hover:bg-orange-400/10' },
    { type: 'Relaxed', icon: <Coffee className="w-6 h-6" />, color: 'hover:text-green-400 hover:bg-green-400/10' },
    { type: 'Romantic', icon: <Heart className="w-6 h-6" />, color: 'hover:text-pink-400 hover:bg-pink-400/10' },
];

const languages = ['English', 'Tamil', 'Hindi', 'Japanese'];
const movieTypes = ['Action', 'Romance', 'Comedy', 'Thriller', 'Sci-Fi'];

export const TailorFit = () => {
    const [survey, setSurvey] = useState<SurveyData>({
        mood: null,
        language: '',
        movieType: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<TailorFitResult | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!survey.mood || !survey.language || !survey.movieType) return;

        const userId = localStorage.getItem('current_user_id');
        if (!userId) {
            setError('Please sign in first to use Tailor Fit.');
            return;
        }

        setError('');
        setIsSubmitting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/tailor-fit/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    survey: {
                        mood: survey.mood,
                        language: survey.language,
                        movie_type: survey.movieType,
                        release_pref: 'any',
                    },
                    top_k: 10,
                    similar_users_k: 5,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || 'Failed to fetch recommendations');
            }
            setResult(data);
        } catch (err: any) {
            setError(err?.message || 'Failed to fetch recommendations');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetSurvey = () => {
        setResult(null);
        setSurvey({ mood: null, language: '', movieType: '' });
        setError('');
    };

    const topMovie = result?.recommendations?.[0];
    const posterUrl = topMovie?.poster_path
        ? `https://image.tmdb.org/t/p/w500${topMovie.poster_path}`
        : null;

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#0a0a0a] flex items-center justify-center p-6 sm:p-12">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-600/10 blur-[120px] rounded-full" />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-2xl"
            >
                {/* Header */}
                <div className="text-center mb-10">
                    <motion.h1 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-5xl sm:text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-400 to-gray-600"
                    >
                        Tailor Fit
                    </motion.h1>
                    <p className="text-gray-400 text-lg">Curating the perfect cinematic experience for your current vibe.</p>
                </div>

                <AnimatePresence mode="wait">
                    {!result ? (
                        <motion.form 
                            key="survey"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            onSubmit={handleSubmit}
                            className="glassmorphism p-8 sm:p-10 rounded-[2rem] border border-white/10 shadow-2xl space-y-10"
                        >
                            {/* Mood Selection */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    What's your mood right now?
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {moods.map((m) => (
                                        <button
                                            key={m.type}
                                            type="button"
                                            onClick={() => setSurvey({ ...survey, mood: m.type })}
                                            className={cn(
                                                "group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-300",
                                                survey.mood === m.type 
                                                    ? "bg-white/10 border-white/20 text-white scale-105 shadow-lg shadow-white/5" 
                                                    : "bg-white/5 border-white/5 text-gray-500 hover:border-white/10 hover:scale-105",
                                                m.color
                                            )}
                                        >
                                            <div className="transition-transform duration-300 group-hover:scale-110">
                                                {m.icon}
                                            </div>
                                            <span className="text-xs font-semibold">{m.type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Language & Movie Type */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                        <Film className="w-4 h-4" />
                                        Preferred Language
                                    </label>
                                    <div className="relative group">
                                        <select 
                                            value={survey.language}
                                            onChange={(e) => setSurvey({ ...survey, language: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-white/20 transition-all hover:bg-white/10"
                                        >
                                            <option value="" disabled className="bg-[#0a0a0a]">Select Language</option>
                                            {languages.map(lang => (
                                                <option key={lang} value={lang} className="bg-[#0a0a0a]">{lang}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none group-hover:text-white transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                        <Search className="w-4 h-4" />
                                        Pick a Movie Type
                                    </label>
                                    <div className="relative group">
                                        <select 
                                            value={survey.movieType}
                                            onChange={(e) => setSurvey({ ...survey, movieType: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-white/20 transition-all hover:bg-white/10"
                                        >
                                            <option value="" disabled className="bg-[#0a0a0a]">Select Genre</option>
                                            {movieTypes.map(type => (
                                                <option key={type} value={type} className="bg-[#0a0a0a]">{type}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={!survey.mood || !survey.language || !survey.movieType || isSubmitting}
                                className={cn(
                                    "w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-xl flex items-center justify-center gap-3",
                                    (!survey.mood || !survey.language || !survey.movieType) 
                                        ? "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50" 
                                        : "bg-gradient-to-r from-red-600 to-red-800 text-white hover:shadow-red-900/20"
                                )}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Analyzing Vibe...
                                    </div>
                                ) : (
                                    <>
                                        Find My Movie
                                        <Sparkles className="w-5 h-5" />
                                    </>
                                )}
                            </motion.button>

                            {error && (
                                <p className="text-sm text-red-400 text-center">{error}</p>
                            )}
                        </motion.form>
                    ) : (
                        <motion.div 
                            key="result"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="glassmorphism p-8 sm:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Film className="w-32 h-32" />
                            </div>

                            <div className="space-y-8 relative z-10">
                                <div className="space-y-2">
                                    <h3 className="text-gray-400 font-medium uppercase tracking-widest text-sm">Your Recommendation</h3>
                                    <h2 className="text-4xl font-black text-white">{topMovie?.title || 'No Match Found'}</h2>
                                </div>

                                {posterUrl && (
                                    <div className="w-full max-w-xs">
                                        <img
                                            src={posterUrl}
                                            alt={topMovie?.title || 'Recommended movie'}
                                            className="w-full h-auto rounded-2xl border border-white/10 shadow-xl"
                                        />
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3">
                                    <div className="bg-white/10 border border-white/10 px-4 py-2 rounded-full text-sm text-gray-300 backdrop-blur-md">
                                        {survey.mood}
                                    </div>
                                    <div className="bg-white/10 border border-white/10 px-4 py-2 rounded-full text-sm text-gray-300 backdrop-blur-md">
                                        {survey.language}
                                    </div>
                                    <div className="bg-white/10 border border-white/10 px-4 py-2 rounded-full text-sm text-gray-300 backdrop-blur-md">
                                        {survey.movieType}
                                    </div>
                                </div>

                                <p className="text-gray-400 text-lg leading-relaxed max-w-lg">
                                    {topMovie?.overview || 'No overview available for this recommendation.'}
                                </p>

                                {result.similar_users?.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm uppercase tracking-widest text-gray-400">Users With Similar Taste</p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.similar_users.slice(0, 3).map((u) => (
                                                <span key={u.user_id} className="bg-white/10 border border-white/10 px-3 py-1 rounded-full text-xs text-gray-200">
                                                    {u.name || u.user_id.slice(0, 8)} ({u.similarity.toFixed(2)})
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 flex gap-4">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => topMovie?.movie_id && window.open(`https://www.themoviedb.org/movie/${topMovie.movie_id}`, '_blank')}
                                        className="flex-1 bg-white text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-white/10"
                                    >
                                        Watch Now
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={resetSurvey}
                                        className="w-14 h-14 bg-white/5 border border-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/10 transition-colors"
                                    >
                                        <RefreshCcw className="w-6 h-6" />
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default TailorFit;
