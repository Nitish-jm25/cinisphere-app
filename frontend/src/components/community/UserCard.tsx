import { UserPlus, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { User } from '../../services/mockData';
import { socialApi } from '../../services/socialApi';

interface UserCardProps {
    user: User;
}

export const UserCard = ({ user }: UserCardProps) => {
    const navigate = useNavigate();
    const [isAdded, setIsAdded] = useState(user.isFriend);
    const [busy, setBusy] = useState(false);

    const onToggleFollow = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);

        try {
            const userId = Number(user.id);
            if (!Number.isFinite(userId)) return;

            if (isAdded) {
                await socialApi.unfollowUser(userId);
                setIsAdded(false);
            } else {
                await socialApi.followUser(userId);
                setIsAdded(true);
            }
        } catch {
            // keep current state on error
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="group relative w-[200px] md:w-[240px] flex flex-col items-center bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 hover:border-white/20 select-none">
            <button type="button" className="relative mb-4" onClick={() => navigate(`/profile/${user.username}`)}>
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="relative w-24 h-24 rounded-full object-cover border-2 border-white/20 group-hover:border-primary transition-colors"
                    loading="lazy"
                />
            </button>

            <button type="button" className="text-lg font-bold text-white mb-1 truncate w-full text-center hover:underline" onClick={() => navigate(`/profile/${user.username}`)}>
                @{user.username}
            </button>
            <p className="text-sm text-gray-400 mb-4 line-clamp-2 text-center h-10">
                {user.bio}
            </p>

            <div className="flex gap-4 text-xs text-gray-400 mb-6">
                <div className="text-center">
                    <span className="block font-bold text-white">{user.followers}</span>
                    Followers
                </div>
                <div className="text-center">
                    <span className="block font-bold text-white">{user.following}</span>
                    Following
                </div>
            </div>

            <Button
                variant={isAdded ? 'secondary' : 'primary'}
                className={`w-full gap-2 transition-all ${isAdded ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30' : ''}`}
                onClick={onToggleFollow}
                disabled={busy}
            >
                {isAdded ? (
                    <>
                        <Check className="w-4 h-4" />
                        Following
                    </>
                ) : (
                    <>
                        <UserPlus className="w-4 h-4" />
                        Follow
                    </>
                )}
            </Button>
        </div>
    );
};
