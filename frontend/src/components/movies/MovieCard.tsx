import { useState } from 'react';
import { Star } from 'lucide-react';
import { MOCK_GENRES } from '../../services/tmdb';
import type { Movie } from '../../services/tmdb';
import { cn } from '../../utils/cn';
import { MovieDetailsModal } from './MovieDetailsModal';

interface MovieCardProps {
    movie: Movie;
    className?: string;
}

export const MovieCard = ({ movie, className }: MovieCardProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // The TMDB API returns paths starting with '/', so we append it to the base image URL.
    // If it's already a full URL (from our mocks), we use it directly.
    const posterUrl = movie.poster_path
        ? movie.poster_path.startsWith('http')
            ? movie.poster_path
            : `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=500&auto=format&fit=crop';

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={cn("text-left group flex flex-col gap-3 shrink-0 w-[160px] md:w-[220px] transition-all duration-300 hover:-translate-y-2", className)}
            >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary w-full border border-border shadow-lg">
                    {/* Placeholder gradient for missing images */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 opacity-50 mix-blend-overlay" />

                    <img
                        src={posterUrl}
                        alt={movie.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => {
                            // Fallback strategy if mock images fail
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=500&auto=format&fit=crop';
                        }}
                    />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <p className="text-xs text-secondary-foreground line-clamp-3 mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            {movie.overview}
                        </p>
                        <div className="flex flex-wrap gap-1 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                            {movie.genre_ids.slice(0, 2).map(id => (
                                <span key={id} className="text-[10px] uppercase font-semibold tracking-wider bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-sm">
                                    {MOCK_GENRES[id] || 'Genre'}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-2 right-2 glassmorphism px-2 py-1 rounded-md flex items-center gap-1 shadow-md">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-bold">{movie.vote_average.toFixed(1)}</span>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold text-sm md:text-base line-clamp-1 group-hover:text-primary transition-colors">{movie.title}</h3>
                    <p className="text-xs text-secondary-foreground mb-1">
                        {new Date(movie.release_date).getFullYear()}
                    </p>
                    <p className="text-xs text-gray-400 line-clamp-1">
                        {movie.genre_ids.map(id => MOCK_GENRES[id] || '').filter(Boolean).join(', ')}
                    </p>
                </div>
            </button>

            {isModalOpen && (
                <MovieDetailsModal
                    movie={movie}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    );
};
