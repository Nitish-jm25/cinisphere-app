import { Film, User, Compass, Users, Sparkles, LogOut, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { cn } from '../../utils/cn';
import { SearchBar } from './SearchBar';
import { useAuth } from '../../context/AuthContext';
import { socialApi, type NotificationItem } from '../../services/socialApi';

export const Navbar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifOpen, setNotifOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        socialApi.listNotifications(10, 0).then((res) => {
            setNotifications(res.notifications);
            setUnreadCount(res.unread_count);
        }).catch(() => null);
    }, [user]);

    const toggleNotif = async () => {
        const nextOpen = !notifOpen;
        setNotifOpen(nextOpen);
        if (!nextOpen) return;
        try {
            const res = await socialApi.listNotifications(20, 0);
            setNotifications(res.notifications);
            setUnreadCount(res.unread_count);
            if (res.unread_count > 0) {
                await socialApi.markNotificationsRead([]);
                setUnreadCount(0);
            }
        } catch {
            // ignore panel load errors
        }
    };

    const navItems = [
        { label: 'Discover', path: '/discover', icon: <Compass className="w-5 h-5" /> },
        { label: 'Home', path: '/home', icon: <Compass className="w-5 h-5" /> },
        { label: 'Tailor Fit', path: '/tailor-fit', icon: <Sparkles className="w-5 h-5" /> },
        { label: 'Feed', path: '/feed', icon: <Film className="w-5 h-5" /> },
        { label: 'Community', path: '/community', icon: <Users className="w-5 h-5" /> },
        { label: 'Profile', path: user?.username ? `/profile/${user.username}` : '/profile', icon: <User className="w-5 h-5" /> },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glassmorphism border-b-0 border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/home" className="flex items-center gap-2">
                        <Film className="w-8 h-8 text-primary" />
                        <span className="hidden sm:inline-block text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-red-800">CineSphere</span>
                    </Link>

                    <div className="flex-1 flex justify-center md:justify-start px-2 md:px-6">
                        <SearchBar />
                    </div>

                    <div className="hidden md:flex items-center gap-6">
                        {navItems.map((item) => {
                            const isActive = item.label === 'Profile'
                                ? location.pathname === '/profile' || location.pathname.startsWith('/profile/')
                                : item.label === 'Community'
                                    ? location.pathname === '/community' || location.pathname.startsWith('/community/')
                                    : location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={cn('group relative flex items-center gap-2 text-sm font-medium transition-colors hover:text-white py-2', isActive ? 'text-white' : 'text-gray-400')}
                                >
                                    {item.icon}
                                    {item.label}
                                    <span className={cn('absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full transition-transform duration-300 ease-out origin-left', isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100')} />
                                </Link>
                            )
                        })}

                        {user && (
                            <>
                                <div className="relative">
                                    <button onClick={toggleNotif} className="relative text-gray-300 hover:text-white">
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-2 -right-2 text-[10px] min-w-4 h-4 px-1 rounded-full bg-red-600 text-white flex items-center justify-center">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    {notifOpen && (
                                        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-xl border border-white/10 bg-black/95 p-2 shadow-xl">
                                            <p className="text-xs text-gray-400 px-2 py-1">Notifications</p>
                                            {notifications.length === 0 && <p className="text-sm text-gray-400 px-2 py-3">No notifications yet.</p>}
                                            {notifications.map((n) => (
                                                <div key={n.id} className="px-2 py-2 border-b border-white/10 last:border-b-0">
                                                    <p className="text-sm text-white">{n.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        logout();
                                        navigate('/');
                                    }}
                                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign out
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};
