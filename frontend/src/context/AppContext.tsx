import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface OnboardingData {
    genres: string[];
    languages: string[];
    mood: string | null;
    purpose: string | null;
}

interface AppContextType {
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    userPrefs: {
        adultContent: boolean;
        language: string;
    };
    setUserPrefs: (prefs: { adultContent: boolean; language: string }) => void;
    onboardingData: OnboardingData;
    setOnboardingData: (data: OnboardingData) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [userPrefs, setUserPrefs] = useState({
        adultContent: false,
        language: 'en-US'
    });
    const [onboardingData, setOnboardingData] = useState<OnboardingData>({
        genres: [],
        languages: [],
        mood: null,
        purpose: null,
    });

    return (
        <AppContext.Provider value={{
            theme, setTheme,
            userPrefs, setUserPrefs,
            onboardingData, setOnboardingData
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
