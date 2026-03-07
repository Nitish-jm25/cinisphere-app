import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { socialApi, clearAuthSession, saveAuthSession } from '../services/socialApi';

interface AuthUser {
    id: number;
    username: string;
    email: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (payload: { email: string; password: string }) => Promise<void>;
    register: (payload: { username: string; email: string; password: string }) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const bootstrap = async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const me = await socialApi.me();
                setUser({ id: me.id, username: me.username, email: me.email });
            } catch {
                clearAuthSession();
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        bootstrap();
    }, []);

    const login = async (payload: { email: string; password: string }) => {
        const result = await socialApi.login(payload);
        saveAuthSession(result);
        setUser({ id: result.user_id, username: result.username, email: result.email });
    };

    const register = async (payload: { username: string; email: string; password: string }) => {
        const result = await socialApi.register(payload);
        saveAuthSession(result);
        setUser({ id: result.user_id, username: result.username, email: result.email });
    };

    const logout = () => {
        clearAuthSession();
        setUser(null);
    };

    const value = useMemo(
        () => ({ user, isAuthenticated: !!user, isLoading, login, register, logout }),
        [user, isLoading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
