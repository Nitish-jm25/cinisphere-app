import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import type { Movie } from '../../services/tmdb';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { MovieDetailsModal } from './MovieDetailsModal';

interface HeroBannerProps {
    movie?: Movie;
    loading?: boolean;
}

export const HeroBanner = ({ movie, loading }: HeroBannerProps) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (movie?.backdrop_path) {
            const img = new Image();
            // Prefer high quality for hero
            img.src = movie.backdrop_path.startsWith('http')
                ? movie.backdrop_path
                : `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;

            img.onload = () => setImageLoaded(true);
            // Fallback
            img.onerror = () => {
                setImageLoaded(false);
            };
        }
    }, [movie]);

    if (loading || !movie) {
        return (
            <div className="relative h-[85vh] w-full pt-16">
                <Skeleton variant="hero" className="h-full" />
            </div>
        );
    }

    let bgImage = 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop';

    if (imageLoaded && movie?.backdrop_path) {
        bgImage = movie.backdrop_path.startsWith('http')
            ? movie.backdrop_path
            : `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
    }

    return (
        <div className="relative h-[85vh] w-full flex items-end pb-24 pt-16">
            {/* Background Image with multiple subtle gradients for cinematic feel */}
            <div className="absolute inset-0 animate-in fade-in duration-1000" key={`bg-${movie.id}`}>
                <img
                    src={bgImage}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/20 to-transparent" />
                <div className="absolute inset-0 bg-black/30" /> {/* Subtle darkening */}
            </div>

            {/* Content */}
            <div className="relative z-10 px-4 md:px-8 max-w-7xl mx-auto w-full">
                <div key={`content-${movie.id}`} className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <h1 className="text-4xl md:text-6xl font-bold text-glow tracking-tight leading-tight">
                        {movie.title}
                    </h1>

                    <div className="flex items-center gap-4 text-sm font-medium text-gray-300">
                        <span className="text-green-400 font-bold">{Math.round(movie.vote_average * 10)}% Match</span>
                        <span>{new Date(movie.release_date).getFullYear()}</span>
                        <span className="border border-gray-600 px-1 hover:border-white transition-colors cursor-default">HD</span>
                    </div>

                    <p className="text-base md:text-lg text-gray-200 line-clamp-3 md:line-clamp-4 leading-relaxed font-light">
                        {movie.overview}
                    </p>

                    <div className="flex items-center gap-4 pt-4">
                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => setIsModalOpen(true)}
                            className="gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/10 text-white font-semibold"
                        >
                            <Info className="w-5 h-5" />
                            More Info
                        </Button>
                    </div>
                </div>
            </div>

            {isModalOpen && movie && (
                <MovieDetailsModal
                    movie={movie}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};
