import { UserPlus, Check } from 'lucide-react';
import type { User } from '../../services/mockData';
import { Button } from '../ui/Button';
import { useState } from 'react';

interface UserCardProps {
    user: User;
}

export const UserCard = ({ user }: UserCardProps) => {
    const [isAdded, setIsAdded] = useState(user.isFriend);

    return (
        <div className="group relative w-[200px] md:w-[240px] flex flex-col items-center bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 hover:border-white/20 select-none">

            {/* Avatar with Glow */}
            <div className="relative mb-4">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="relative w-24 h-24 rounded-full object-cover border-2 border-white/20 group-hover:border-primary transition-colors"
                    loading="lazy"
                />
            </div>

            {/* Info */}
            <h3 className="text-lg font-bold text-white mb-1 truncate w-full text-center">
                @{user.username}
            </h3>
            <p className="text-sm text-gray-400 mb-4 line-clamp-2 text-center h-10">
                {user.bio}
            </p>

            {/* Stats */}
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

            {/* Action */}
            <Button
                variant={isAdded ? "secondary" : "primary"}
                className={`w-full gap-2 transition-all ${isAdded ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30' : ''}`}
                onClick={(e) => {
                    e.preventDefault();
                    setIsAdded(!isAdded);
                }}
            >
                {isAdded ? (
                    <>
                        <Check className="w-4 h-4" />
                        Added
                    </>
                ) : (
                    <>
                        <UserPlus className="w-4 h-4" />
                        Add Friend
                    </>
                )}
            </Button>
        </div>
    );
};
