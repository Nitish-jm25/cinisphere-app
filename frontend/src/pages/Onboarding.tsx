import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { cn } from '../utils/cn';
import {
    Swords, Heart, Smile, Ghost, Tv, Compass,
    Globe, Languages, Frown, Zap, Flame,
    Coffee, PartyPopper, Lightbulb, Check, ChevronRight, ChevronLeft
} from 'lucide-react';

const GENRES = [
    { id: 'action', label: 'Action', icon: Swords },
    { id: 'comedy', label: 'Comedy', icon: Smile },
    { id: 'romance', label: 'Romance', icon: Heart },
    { id: 'horror', label: 'Horror', icon: Ghost },
    { id: 'drama', label: 'Drama', icon: Tv },
    { id: 'scifi', label: 'Sci-Fi', icon: Compass },
];

const LANGUAGES = [
    { id: 'en', label: 'English', icon: Globe },
    { id: 'es', label: 'Spanish', icon: Languages },
    { id: 'fr', label: 'French', icon: Languages },
    { id: 'ja', label: 'Japanese', icon: Languages },
    { id: 'ko', label: 'Korean', icon: Languages },
    { id: 'hi', label: 'Hindi', icon: Languages },
];

const MOODS = [
    { id: 'happy', label: 'Happy', icon: Smile },
    { id: 'sad', label: 'Sad', icon: Frown },
    { id: 'stressed', label: 'Stressed', icon: Zap },
    { id: 'romantic', label: 'Romantic', icon: Heart },
    { id: 'excited', label: 'Excited', icon: Flame },
];

const PURPOSES = [
    { id: 'relax', label: 'Relax', icon: Coffee },
    { id: 'fun', label: 'Have Fun', icon: PartyPopper },
    { id: 'inspiration', label: 'Inspiration', icon: Lightbulb },
];

export const Onboarding = () => {
    const navigate = useNavigate();
    const { onboardingData, setOnboardingData } = useAppContext();
    const [step, setStep] = useState(1);
    const totalSteps = 4;

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(prev => prev + 1);
        } else {
            // Finish onboarding
            navigate('/home');
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(prev => prev - 1);
        }
    };

    const toggleSelection = (field: 'genres' | 'languages', id: string) => {
        const current = onboardingData[field];
        const updated = current.includes(id)
            ? current.filter(item => item !== id)
            : [...current, id];
        setOnboardingData({ ...onboardingData, [field]: updated });
    };

    const setSingleSelection = (field: 'mood' | 'purpose', id: string) => {
        setOnboardingData({ ...onboardingData, [field]: id });
    };

    // Check if current step is valid to proceed
    const isStepValid = () => {
        switch (step) {
            case 1: return onboardingData.genres.length > 0;
            case 2: return onboardingData.languages.length > 0;
            case 3: return onboardingData.mood !== null;
            case 4: return onboardingData.purpose !== null;
            default: return true;
        }
    };

    const renderProgress = () => {
        return (
            <div className="flex gap-2 w-full max-w-xs mx-auto mb-8">
                {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-1.5 flex-1 rounded-full transition-all duration-300",
                            i + 1 <= step ? "bg-primary" : "bg-border"
                        )}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 cinematic-gradient">

            <div className="w-full max-w-xl">
                {renderProgress()}

                <div className="relative overflow-hidden">
                    {/* Step 1: Genres */}
                    <div className={cn(
                        "transition-all duration-500 transform",
                        step === 1 ? "opacity-100 translate-x-0 relative" : "opacity-0 absolute inset-0 translate-x-full pointer-events-none"
                    )}>
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold mb-2 text-glow">What do you love?</h1>
                            <p className="text-secondary-foreground">Select your favorite genres.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {GENRES.map(genre => {
                                const Icon = genre.icon;
                                const isSelected = onboardingData.genres.includes(genre.id);
                                return (
                                    <Card
                                        key={genre.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-300 hover:scale-105 border-2",
                                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-white/20"
                                        )}
                                        onClick={() => toggleSelection('genres', genre.id)}
                                    >
                                        <div className="p-6 flex flex-col items-center gap-3 relative">
                                            {isSelected && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                                            <Icon className={cn("w-8 h-8", isSelected ? "text-primary" : "text-gray-400")} />
                                            <span className="font-medium text-sm">{genre.label}</span>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 2: Languages */}
                    <div className={cn(
                        "transition-all duration-500 transform",
                        step === 2 ? "opacity-100 translate-x-0 relative" : step < 2 ? "opacity-0 absolute inset-0 -translate-x-full pointer-events-none" : "opacity-0 absolute inset-0 translate-x-full pointer-events-none"
                    )}>
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold mb-2 text-glow">Preferred Languages</h1>
                            <p className="text-secondary-foreground">What languages do you want to watch in?</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {LANGUAGES.map(lang => {
                                const Icon = lang.icon;
                                const isSelected = onboardingData.languages.includes(lang.id);
                                return (
                                    <Card
                                        key={lang.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-300 hover:scale-105 border-2",
                                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-white/20"
                                        )}
                                        onClick={() => toggleSelection('languages', lang.id)}
                                    >
                                        <div className="p-6 flex flex-col items-center gap-3 relative">
                                            {isSelected && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                                            <Icon className={cn("w-8 h-8", isSelected ? "text-primary" : "text-gray-400")} />
                                            <span className="font-medium text-sm">{lang.label}</span>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 3: Mood */}
                    <div className={cn(
                        "transition-all duration-500 transform",
                        step === 3 ? "opacity-100 translate-x-0 relative" : step < 3 ? "opacity-0 absolute inset-0 -translate-x-full pointer-events-none" : "opacity-0 absolute inset-0 translate-x-full pointer-events-none"
                    )}>
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold mb-2 text-glow">How are you feeling?</h1>
                            <p className="text-secondary-foreground">We'll find the perfect match for your mood.</p>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 justify-center">
                            {MOODS.map(mood => {
                                const Icon = mood.icon;
                                const isSelected = onboardingData.mood === mood.id;
                                return (
                                    <Card
                                        key={mood.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-300 hover:scale-105 border-2",
                                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-white/20"
                                        )}
                                        onClick={() => setSingleSelection('mood', mood.id)}
                                    >
                                        <div className="p-6 flex flex-col items-center gap-3 relative">
                                            {isSelected && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                                            <Icon className={cn("w-8 h-8", isSelected ? "text-primary" : "text-gray-400")} />
                                            <span className="font-medium text-sm">{mood.label}</span>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 4: Purpose */}
                    <div className={cn(
                        "transition-all duration-500 transform",
                        step === 4 ? "opacity-100 translate-x-0" : step < 4 ? "opacity-0 absolute inset-0 -translate-x-full pointer-events-none" : "opacity-0 absolute inset-0 translate-x-full pointer-events-none"
                    )}>
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold mb-2 text-glow">Why are you watching?</h1>
                            <p className="text-secondary-foreground">Let's set your intention.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {PURPOSES.map(purpose => {
                                const Icon = purpose.icon;
                                const isSelected = onboardingData.purpose === purpose.id;
                                return (
                                    <Card
                                        key={purpose.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-300 hover:scale-105 border-2",
                                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-white/20"
                                        )}
                                        onClick={() => setSingleSelection('purpose', purpose.id)}
                                    >
                                        <div className="p-6 flex flex-col items-center gap-3 relative">
                                            {isSelected && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                                            <Icon className={cn("w-8 h-8", isSelected ? "text-primary" : "text-gray-400")} />
                                            <span className="font-medium text-sm">{purpose.label}</span>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Navigation Controls */}
                <div className="mt-10 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        className={cn("gap-2", step === 1 && "invisible")}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </Button>

                    <Button
                        onClick={handleNext}
                        disabled={!isStepValid()}
                        className="gap-2 min-w-[120px]"
                    >
                        {step === totalSteps ? 'Complete' : 'Continue'}
                        {step < totalSteps && <ChevronRight className="w-4 h-4" />}
                    </Button>
                </div>

            </div>
        </div>
    );
};
