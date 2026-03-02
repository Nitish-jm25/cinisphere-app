import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Smile, Frown, Meh, Zap, Coffee, BookOpen, Plane, Laugh, Swords } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

interface MoodSurveyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MOODS = [
    { id: 'happy', label: 'Happy', icon: <Smile className="w-5 h-5" /> },
    { id: 'sad', label: 'Sad', icon: <Frown className="w-5 h-5" /> },
    { id: 'okay', label: 'Okay', icon: <Meh className="w-5 h-5" /> },
    { id: 'energetic', label: 'Energetic', icon: <Zap className="w-5 h-5" /> },
    { id: 'tired', label: 'Tired', icon: <Coffee className="w-5 h-5" /> },
];

const MINDSETS = [
    { id: 'learn', label: 'Want to Learn', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'escape', label: 'Want to Escape', icon: <Plane className="w-5 h-5" /> },
    { id: 'laugh', label: 'Want to Laugh', icon: <Laugh className="w-5 h-5" /> },
    { id: 'action', label: 'Craving Action', icon: <Swords className="w-5 h-5" /> },
];

export const MoodSurveyModal: React.FC<MoodSurveyModalProps> = ({ isOpen, onClose }) => {
    const { onboardingData, setOnboardingData } = useAppContext();
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [selectedMindset, setSelectedMindset] = useState<string | null>(null);

    const handleSubmit = () => {
        if (selectedMood) {
            // Update app context so the "Mood-based Picks" row updates
            setOnboardingData({
                ...onboardingData,
                mood: MOODS.find(m => m.id === selectedMood)?.label || 'Good'
            });
        }

        // Save to session storage so we don't ask again this session
        sessionStorage.setItem('hasCompletedMoodSurvey', 'true');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="How are you feeling today?">
            <div className="space-y-6">
                <p className="text-gray-400 text-sm">
                    Tell us your current mood and mindset so we can recommend the perfect content for you right now.
                </p>

                <div className="space-y-3">
                    <h3 className="text-white font-medium">Your Mood</h3>
                    <div className="flex flex-wrap gap-2">
                        {MOODS.map((mood) => (
                            <button
                                key={mood.id}
                                onClick={() => setSelectedMood(mood.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${selectedMood === mood.id
                                    ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                                    }`}
                            >
                                {mood.icon}
                                {mood.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-white font-medium">Your Mindset</h3>
                    <div className="flex flex-wrap gap-2">
                        {MINDSETS.map((mindset) => (
                            <button
                                key={mindset.id}
                                onClick={() => setSelectedMindset(mindset.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${selectedMindset === mindset.id
                                    ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                                    }`}
                            >
                                {mindset.icon}
                                {mindset.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                        sessionStorage.setItem('hasCompletedMoodSurvey', 'true');
                        onClose();
                    }}>
                        Skip for now
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedMood && !selectedMindset}
                        className="bg-primary hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    >
                        Save & Discover
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
