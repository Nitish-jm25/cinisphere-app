import { useEffect, useState } from 'react';
import { X, Clock, Star, Users, LayoutGrid } from 'lucide-react';
import { tmdbService } from '../../services/tmdb';
import type { Movie, MovieCredits } from '../../services/tmdb';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { MOCK_GENRES } from '../../services/tmdb';

interface MovieDetailsModalProps {
    movie: Movie;
    onClose: () => void;
}

export const MovieDetailsModal = ({ movie, onClose }: MovieDetailsModalProps) => {
    const [isMoreInfo, setIsMoreInfo] = useState(false);
    const [credits, setCredits] = useState<MovieCredits | null>(null);
    const [fullMovie, setFullMovie] = useState<Movie | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const [details, movieCredits] = await Promise.all([
                    tmdbService.getMovieDetails(movie.id.toString()),
                    tmdbService.getMovieCredits(movie.id)
                ]);
                setFullMovie(details);
                setCredits(movieCredits);
            } catch (error) {
                console.error("Failed to fetch detailed movie info", error);
            }
        };

        fetchDetails();
    }, [movie.id]);

    // Prevent body scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const displayMovie = fullMovie || movie;
    const backdrops = displayMovie.images?.backdrops?.slice(0, 6) || [];
    const cast = credits?.cast.slice(0, 10) || [];
    const directors = credits?.crew.filter(c => c.job === 'Director') || [];

    const bgImage = displayMovie.backdrop_path
        ? (displayMovie.backdrop_path.startsWith('http') ? displayMovie.backdrop_path : `https://image.tmdb.org/t/p/original${displayMovie.backdrop_path}`)
        : 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
            {/* Backdrop Blur overlay */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-5xl max-h-[90vh] bg-background border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Scrollable Container */}
                <div className="overflow-y-auto scrollbar-hide flex-1">

                    {/* Hero Section */}
                    <div className="relative h-[50vh] min-h-[400px] w-full flex items-end">
                        <div className="absolute inset-0">
                            <img src={bgImage} alt={displayMovie.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
                        </div>

                        <div className="relative z-10 p-8 md:p-12 w-full max-w-3xl">
                            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight drop-shadow-lg">
                                {displayMovie.title}
                            </h2>

                            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-300 mb-6">
                                <span className="flex items-center gap-1 text-yellow-500 font-bold">
                                    <Star className="w-4 h-4 fill-current" />
                                    {displayMovie.vote_average.toFixed(1)}
                                </span>
                                <span>{displayMovie.release_date?.split('-')[0]}</span>
                                {displayMovie.runtime && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {Math.floor(displayMovie.runtime / 60)}h {displayMovie.runtime % 60}m
                                    </span>
                                )}
                                <span className="border border-gray-600 px-1.5 py-0.5 text-xs rounded-sm">HD</span>
                            </div>

                            <p className="text-gray-200 text-base md:text-lg leading-relaxed line-clamp-3 mb-8">
                                {displayMovie.overview}
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <Button
                                    variant={isMoreInfo ? "primary" : "secondary"}
                                    size="lg"
                                    onClick={() => setIsMoreInfo(!isMoreInfo)}
                                    className="gap-2 backdrop-blur-md font-semibold"
                                >
                                    {isMoreInfo ? <LayoutGrid className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                                    {isMoreInfo ? "Hide Details" : "More Info"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Details Section (Toggled by More Info) */}
                    <div className={cn(
                        "grid transition-all duration-500 ease-in-out bg-black/40",
                        isMoreInfo ? "grid-rows-[1fr] opacity-100 p-8 md:p-12" : "grid-rows-[0fr] opacity-0"
                    )}>
                        <div className="overflow-hidden space-y-12">

                            {/* Metadata Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
                                <div>
                                    <span className="text-gray-500 block mb-1">Genres</span>
                                    <div className="flex flex-wrap gap-2 text-white">
                                        {displayMovie.genre_ids?.map(id => MOCK_GENRES[id] || 'Unknown').join(', ')}
                                    </div>
                                </div>
                                {directors.length > 0 && (
                                    <div>
                                        <span className="text-gray-500 block mb-1">Director</span>
                                        <div className="text-white">{directors.map(d => d.name).join(', ')}</div>
                                    </div>
                                )}
                            </div>

                            {/* Cast Section */}
                            {cast.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-primary" /> Top Cast
                                    </h3>
                                    <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
                                        {cast.map(actor => (
                                            <div key={actor.id} className="flex-shrink-0 w-28 snap-start group">
                                                <div className="w-28 h-28 mb-3 rounded-full overflow-hidden bg-gray-800 border-2 border-transparent group-hover:border-primary transition-colors">
                                                    {actor.profile_path ? (
                                                        <img
                                                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                                                            alt={actor.name}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                            <Users className="w-8 h-8" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-bold text-sm text-white truncate">{actor.name}</div>
                                                    <div className="text-xs text-gray-400 truncate mt-0.5">{actor.character}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Gallery Section */}
                            {backdrops.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <LayoutGrid className="w-5 h-5 text-primary" /> Gallery
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {backdrops.map((img, idx) => (
                                            <div key={idx} className="aspect-video rounded-xl overflow-hidden bg-gray-800 group relative">
                                                <img
                                                    src={img.file_path.startsWith('http') ? img.file_path : `https://image.tmdb.org/t/p/w500${img.file_path}`}
                                                    alt={`Gallery ${idx + 1}`}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
