import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { User } from '../../services/mockData';
import { UserCard } from './UserCard';

interface UserRowProps {
    title: string;
    users: User[];
    loading?: boolean;
}

export const UserRow = ({ title, users, loading }: UserRowProps) => {
    const rowRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (rowRef.current) {
            const { scrollLeft, clientWidth } = rowRef.current;
            const scrollTo = direction === 'left'
                ? scrollLeft - clientWidth * 0.75
                : scrollLeft + clientWidth * 0.75;

            rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    if (users.length === 0 && !loading) return null;

    return (
        <section className="py-6 relative group">
            <div className="px-4 md:px-8 mb-4 flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
            </div>

            <div className="relative">
                <div
                    className="flex gap-4 md:gap-6 overflow-x-auto px-4 md:px-8 pb-8 pt-4 snap-x snap-mandatory scrollbar-hide no-scrollbar"
                    ref={rowRef}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {users.map(user => (
                        <div key={user.id} className="snap-start flex-shrink-0">
                            <UserCard user={user} />
                        </div>
                    ))}
                </div>

                <button
                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md p-2 rounded-r-lg opacity-0 group-hover:opacity-100 transition-opacity hidden md:block hover:bg-primary z-10"
                    onClick={() => scroll('left')}
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>

                <button
                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md p-2 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity hidden md:block hover:bg-primary z-10"
                    onClick={() => scroll('right')}
                >
                    <ChevronRight className="w-8 h-8" />
                </button>
            </div>
        </section>
    );
};
