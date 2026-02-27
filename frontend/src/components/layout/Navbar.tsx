import { Film, User, Compass, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { SearchBar } from './SearchBar';

export const Navbar = () => {
    const location = useLocation();

    const navItems = [
        { label: 'Home', path: '/home', icon: <Compass className="w-5 h-5" /> },
        { label: 'Feed', path: '/feed', icon: <Film className="w-5 h-5" /> },
        { label: 'Community', path: '/community', icon: <Users className="w-5 h-5" /> },
        { label: 'Profile', path: '/profile', icon: <User className="w-5 h-5" /> },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glassmorphism border-b-0 border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center gap-2">
                        <Film className="w-8 h-8 text-primary" />
                        <span className="hidden sm:inline-block text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-red-800">
                            MovieSphere
                        </span>
                    </Link>

                    <div className="flex-1 flex justify-center md:justify-start px-2 md:px-6">
                        <SearchBar />
                    </div>

                    <div className="hidden md:flex items-center gap-6">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={cn(
                                        'group relative flex items-center gap-2 text-sm font-medium transition-colors hover:text-white py-2',
                                        isActive ? 'text-white' : 'text-gray-400'
                                    )}
                                >
                                    {item.icon}
                                    {item.label}
                                    <span
                                        className={cn(
                                            "absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full transition-transform duration-300 ease-out origin-left",
                                            isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                                        )}
                                    />
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </div>
        </nav>
    );
};
