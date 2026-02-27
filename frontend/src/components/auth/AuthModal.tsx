import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { X, Mail, Lock, User, ArrowRight } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'signin' | 'signup';
    onSuccess: (mode: 'signin' | 'signup') => void;
}

export const AuthModal = ({ isOpen, onClose, initialMode = 'signin', onSuccess }: AuthModalProps) => {
    const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
            setName('');
            setEmail('');
            setPassword('');
            setError('');
            setSuccessMsg('');
        }
    }, [isOpen, initialMode]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsLoading(true);

        // Mock API Call
        setTimeout(() => {
            setIsLoading(false);
            if (mode === 'signin') {
                if (email === 'user@example.com' && password === 'password123') {
                    setSuccessMsg('Login successful! Welcome back, User ID: u1');
                    setTimeout(() => onSuccess(mode), 1500);
                } else {
                    setError('Invalid email or password. (Hint: user@example.com / password123)');
                }
            } else {
                setSuccessMsg('Account created successfully!');
                setTimeout(() => onSuccess(mode), 1500);
            }
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-secondary/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Glow effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 relative z-10">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold mb-2">
                            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-secondary-foreground text-sm">
                            {mode === 'signin'
                                ? 'Enter your details to access your account'
                                : 'Join CiniSphere and discover your next favorite movie'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm text-center animate-in fade-in">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-xl text-green-500 text-sm text-center animate-in fade-in font-medium">
                                {successMsg}
                            </div>
                        )}
                        {mode === 'signup' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-300 ml-1">Full Name</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full bg-background/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-300 ml-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full bg-background/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-semibold text-gray-300">Password</label>
                                {mode === 'signin' && (
                                    <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors">
                                        Forgot Password?
                                    </button>
                                )}
                            </div>

                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-background/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full py-6 text-base font-bold mt-6 shadow-lg shadow-primary/20 group"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <>
                                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-400">
                        {mode === 'signin' ? (
                            <p>
                                Don't have an account?{' '}
                                <button
                                    onClick={() => setMode('signup')}
                                    className="text-white font-semibold hover:text-primary transition-colors"
                                >
                                    Sign Up
                                </button>
                            </p>
                        ) : (
                            <p>
                                Already have an account?{' '}
                                <button
                                    onClick={() => setMode('signin')}
                                    className="text-white font-semibold hover:text-primary transition-colors"
                                >
                                    Sign In
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
