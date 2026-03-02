import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AuthModal } from '../components/auth/AuthModal';
import { Sparkles, Film, ArrowRight, X, Check } from 'lucide-react';
import { cn } from '../utils/cn';

// --- MOCK SURVEY DATA ---
const MOODS = [
    { id: 'm1', label: 'Thrilling & Intense', icon: '🔥' },
    { id: 'm2', label: 'Light & Breezy', icon: '☀️' },
    { id: 'm3', label: 'Deep & Thoughtful', icon: '🧠' },
    { id: 'm4', label: 'Laugh Out Loud', icon: '😂' },
    { id: 'm5', label: 'Scares & Chills', icon: '👻' },
    { id: 'm6', label: 'Romantic', icon: '❤️' },
];

const GENRES = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
    'Documentary', 'Drama', 'Family', 'Fantasy', 'History',
    'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction',
    'TV Movie', 'Thriller', 'War', 'Western'
];

export const Landing = () => {
    const navigate = useNavigate();
    const [showSurvey, setShowSurvey] = useState(false);
    const [surveyStep, setSurveyStep] = useState(1);
    const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

    // Remove auto-showing survey, we only show it on signup success
    useEffect(() => {
        // Cleanup if needed
        return () => { };
    }, []);

    const toggleMood = (id: string) => {
        setSelectedMoods(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const toggleGenre = (genre: string) => {
        setSelectedGenres(prev =>
            prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
        );
    };

    const finishSurvey = () => {
        setShowSurvey(false);
        navigate('/discover');
    };

    const handleAuthSuccess = (mode: 'signin' | 'signup') => {
        setAuthModalOpen(false);
        if (mode === 'signup') {
            setShowSurvey(true);
        } else {
            navigate('/discover');
        }
    };

    const openAuthModal = (mode: 'signin' | 'signup') => {
        setAuthMode(mode);
        setAuthModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col">

            {/* --- HERO BACKGROUND --- */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
                <img
                    src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2000&auto=format&fit=crop"
                    alt="Cinematic Background"
                    className="w-full h-full object-cover opacity-60"
                />
            </div>

            {/* --- TOP NAV --- */}
            <nav className="relative z-20 py-6 px-8 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate('/')}>
                    <div className="bg-primary/20 p-2 rounded-xl backdrop-blur-md border border-primary/30 group-hover:bg-primary/30 transition-colors">
                        <Film className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        CiniSphere
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="text-sm font-semibold hover:bg-white/10 hidden sm:flex" onClick={() => openAuthModal('signin')}>
                        Sign In
                    </Button>
                    <Button className="text-sm font-bold shadow-lg shadow-primary/20" onClick={() => openAuthModal('signup')}>
                        Sign Up
                    </Button>
                </div>
            </nav>

            {/* --- MAIN CONTENT --- */}
            <main className="relative z-20 flex-1 flex flex-col justify-center max-w-7xl mx-auto px-8 w-full w-full pb-20">
                <div className="max-w-2xl animate-in slide-in-from-left-8 fade-in duration-1000">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 text-xs font-semibold text-primary">
                        <Sparkles className="w-3 h-3" />
                        <span>The Future of Movie Discovery</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
                        Find your next <br />
                        <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                            cinematic obsession.
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-secondary-foreground mb-10 max-w-xl leading-relaxed">
                        Join millions of movie lovers. Get AI-powered recommendations, connect with friends, and build your ultimate watchlist.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <Button size="lg" className="w-full sm:w-auto text-base font-bold shadow-xl shadow-primary/30 group px-8" onClick={() => openAuthModal('signup')}>
                            Get Started
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>

                    <div className="mt-12 flex items-center gap-4 text-sm text-secondary-foreground">
                        <div className="flex -space-x-3">
                            <img src="https://i.pravatar.cc/100?img=1" alt="User" className="w-8 h-8 rounded-full border-2 border-background" />
                            <img src="https://i.pravatar.cc/100?img=2" alt="User" className="w-8 h-8 rounded-full border-2 border-background" />
                            <img src="https://i.pravatar.cc/100?img=3" alt="User" className="w-8 h-8 rounded-full border-2 border-background" />
                            <div className="w-8 h-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[10px] font-bold text-white">+2M</div>
                        </div>
                        <p>Trusted by cinephiles worldwide</p>
                    </div>
                </div>
            </main>

            {/* --- SURVEY MODAL --- */}
            {showSurvey && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSurvey(false)} />

                    <div className="relative w-full max-w-2xl bg-secondary/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-10 shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                        <button
                            onClick={() => setShowSurvey(false)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-primary" />
                                <h2 className="text-2xl font-bold">Personalize Your Experience</h2>
                            </div>
                            <p className="text-secondary-foreground">Tell us what you like, and we'll handle the rest.</p>

                            {/* Progress bar */}
                            <div className="w-full h-1.5 bg-white/10 rounded-full mt-6 overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${(surveyStep / 2) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Step 1: Moods */}
                        {surveyStep === 1 && (
                            <div className="animate-in slide-in-from-right-4 fade-in">
                                <h3 className="text-lg font-semibold mb-4">What's your usual movie mood?</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                                    {MOODS.map(mood => {
                                        const isSelected = selectedMoods.includes(mood.id);
                                        return (
                                            <button
                                                key={mood.id}
                                                onClick={() => toggleMood(mood.id)}
                                                className={cn(
                                                    "relative p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all group hover:scale-105",
                                                    isSelected
                                                        ? "border-primary bg-primary/20 shadow-lg shadow-primary/10"
                                                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                                                )}
                                            >
                                                <span className="text-3xl mb-1">{mood.icon}</span>
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center animate-in zoom-in">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        className="px-8 shadow-lg shadow-primary/20"
                                        disabled={selectedMoods.length === 0}
                                        onClick={() => setSurveyStep(2)}
                                    >
                                        Next Step
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Genres */}
                        {surveyStep === 2 && (
                            <div className="animate-in slide-in-from-right-4 fade-in">
                                <h3 className="text-lg font-semibold mb-4">Pick a few favorite genres</h3>
                                <div className="flex flex-wrap gap-2 mb-8 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    {GENRES.map(genre => {
                                        const isSelected = selectedGenres.includes(genre);
                                        return (
                                            <button
                                                key={genre}
                                                onClick={() => toggleGenre(genre)}
                                                className={cn(
                                                    "px-4 py-2 rounded-full border text-sm font-medium transition-all transition-short",
                                                    isSelected
                                                        ? "border-primary bg-primary text-white shadow-md shadow-primary/20 scale-105"
                                                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-gray-300"
                                                )}
                                            >
                                                {genre}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-between items-center">
                                    <Button variant="ghost" onClick={() => setSurveyStep(1)} className="text-gray-400 hover:text-white">
                                        Back
                                    </Button>
                                    <Button
                                        className="px-8 shadow-lg shadow-primary/20"
                                        disabled={selectedGenres.length === 0}
                                        onClick={finishSurvey}
                                    >
                                        Complete Setup
                                        <Sparkles className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
            {/* --- AUTH MODAL --- */}
            <AuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
                initialMode={authMode}
                onSuccess={handleAuthSuccess}
            />
        </div>
    );
};
