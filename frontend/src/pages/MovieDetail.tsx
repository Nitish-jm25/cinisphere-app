import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Heart, BookmarkPlus, Share2, Play,
    Clock, Calendar, Star, ArrowLeft
} from 'lucide-react';
import { tmdbService, type Movie, MOCK_GENRES } from '../services/tmdb';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { MovieRow } from '../components/movies/MovieRow';

export const MovieDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [movie, setMovie] = useState<Movie | null>(null);
    const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
        const fetchMovieData = async () => {
            setLoading(true);
            window.scrollTo(0, 0); // Reset scroll on navigation

            try {
                if (id) {
                    const fetchedMovie = await tmdbService.getMovieDetails(id);
                    setMovie(fetchedMovie);

                    // Get mock similar movies
                    const trending = await tmdbService.getTrendingMovies();
                    // Exclude current movie from similar
                    setSimilarMovies(trending.results.filter(m => m.id !== parseInt(id)));
                }
            } catch (error) {
                console.error("Failed to load details", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMovieData();
    }, [id]);

    if (loading || !movie) {
        return (
            <div className="min-h-screen pt-16 mt-[-64px]">
                <Skeleton variant="hero" className="h-[50vh] md:h-[70vh]" />
                <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-32 relative z-10 flex flex-col md:flex-row gap-8">
                    <Skeleton variant="poster" className="w-[200px] md:w-[300px]" />
                    <div className="flex-1 space-y-4 pt-4 md:pt-[100px]">
                        <Skeleton className="h-10 w-3/4" />
                        <Skeleton className="h-6 w-1/4" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    let bgImage = 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop';
    if (imageLoaded && movie.backdrop_path) {
        bgImage = movie.backdrop_path.startsWith('http')
            ? movie.backdrop_path
            : `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
    }

    const posterImage = movie.poster_path
        ? movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=500&auto=format&fit=crop';

    // Format runtime
    const hours = movie.runtime ? Math.floor(movie.runtime / 60) : 0;
    const minutes = movie.runtime ? movie.runtime % 60 : 0;

    return (
        <div className="min-h-screen bg-background pb-20 mt-[-64px]">

            {/* Hidden image to trigger load event early */}
            <img
                src={movie.backdrop_path ? (movie.backdrop_path.startsWith('http') ? movie.backdrop_path : `https://image.tmdb.org/t/p/original${movie.backdrop_path}`) : ''}
                className="hidden"
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop';
                    setImageLoaded(true);
                }}
                alt=""
            />

            {/* Hero Backdrop */}
            <div className="relative h-[50vh] md:h-[70vh] w-full">
                <div className="absolute inset-0">
                    <img
                        src={bgImage}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                    <div className="absolute inset-0 bg-black/30" />
                </div>

                {/* Back Button */}
                <div className="absolute top-24 left-4 md:left-8 z-30">
                    <Button
                        variant="ghost"
                        className="text-white hover:bg-white/10 glassmorphism p-2 rounded-full w-10 h-10 flex items-center justify-center p-0"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="relative z-20 max-w-7xl mx-auto px-4 md:px-8 -mt-24 md:-mt-48 flex flex-col md:flex-row gap-8">

                {/* Poster */}
                <div className="w-[180px] md:w-[300px] shrink-0 mx-auto md:mx-0 shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
                    <img
                        src={posterImage}
                        alt={movie.title}
                        className="w-full h-auto object-cover border border-white/10 rounded-xl"
                        onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=500&auto=format&fit=crop';
                        }}
                    />
                </div>

                {/* Info */}
                <div className="flex-1 space-y-6 md:pt-16 animate-in fade-in slide-in-from-right-10 duration-700">

                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
                            {movie.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                            <span className="flex items-center gap-1 font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-sm">
                                <Star className="w-4 h-4 fill-current" />
                                {movie.vote_average.toFixed(1)} Rating
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(movie.release_date).getFullYear()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {hours > 0 ? `${hours}h ` : ''}{minutes}m
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {movie.genre_ids.map(id => (
                            <span key={id} className="text-xs uppercase font-semibold tracking-wider border border-white/20 bg-white/5 backdrop-blur-sm px-3 py-1 rounded-full text-gray-300">
                                {MOCK_GENRES[id] || 'Unknown'}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 pt-2 pb-4">
                        <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-[#b0070f] text-white">
                            <Play className="w-5 h-5 fill-current" />
                            Watch Now
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className={`gap-2 glassmorphism hover:bg-white/10 border-white/10 ${isSaved ? 'text-primary border-primary/50 bg-primary/10' : 'text-white'}`}
                            onClick={() => setIsSaved(!isSaved)}
                        >
                            <BookmarkPlus className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                            <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className={`gap-2 glassmorphism hover:bg-white/10 border-white/10 ${isLiked ? 'text-red-500 border-red-500/50 bg-red-500/10' : 'text-white'}`}
                            onClick={() => setIsLiked(!isLiked)}
                        >
                            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                            <span className="hidden sm:inline">Like</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="gap-2 glassmorphism hover:bg-white/10 border-white/10 text-white w-12 sm:w-auto p-0 sm:px-4 flex justify-center"
                        >
                            <Share2 className="w-5 h-5" />
                            <span className="hidden sm:inline">Share</span>
                        </Button>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-2 text-white/90">Overview</h3>
                        <p className="text-gray-300 md:text-lg leading-relaxed font-light max-w-3xl">
                            {movie.overview}
                        </p>
                    </div>

                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 mt-16 space-y-16">

                {/* Media Section */}
                {(movie.videos?.results?.length || movie.images?.backdrops?.length) && (
                    <section className="animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
                        <h2 className="text-2xl font-bold mb-6 tracking-tight">Media</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* Dummy Trailer embed layout - Visual only for styling requirement */}
                            {movie.videos?.results?.slice(0, 1).map((vid, i) => (
                                <div key={i} className="aspect-video relative rounded-xl overflow-hidden glassmorphism group cursor-pointer border border-white/10 shadow-lg">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 opacity-30 mix-blend-overlay" />
                                    <img
                                        src={`https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1000&auto=format&fit=crop`}
                                        alt="Trailer Thumbnail"
                                        className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-primary/90 text-white flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                                            <Play className="w-8 h-8 fill-current ml-1" />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                        <p className="font-semibold text-sm truncate">{vid.type}: Official {vid.site}</p>
                                    </div>
                                </div>
                            ))}

                            {/* Dummy screenshots */}
                            {movie.images?.backdrops?.slice(0, 2).map((_, i) => (
                                <div key={i} className="aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-colors shadow-lg group">
                                    <img
                                        src={`https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1000&auto=format&fit=crop`}
                                        alt="Scene Thumbnail"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Similar Movies */}
                <section className="animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500 pb-12">
                    {similarMovies.length > 0 && (
                        <div className="-mx-4 md:-mx-8">
                            <MovieRow
                                title="People with similar taste liked this"
                                movies={similarMovies}
                                loading={loading}
                            />
                        </div>
                    )}
                </section>

            </div>

        </div>
    );
};
