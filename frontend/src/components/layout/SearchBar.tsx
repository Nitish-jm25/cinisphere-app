import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Film, Users, LayoutGrid } from 'lucide-react';

import { tmdbService } from '../../services/tmdb';
import type { Movie } from '../../services/tmdb';
import { dataService } from '../../services/mockData';
import type { User, Community } from '../../services/mockData';
import { cn } from '../../utils/cn';
import { useDebounce } from '../../hooks/useDebounce';

export const SearchBar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const [movies, setMovies] = useState<Movie[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [communities, setCommunities] = useState<Community[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);
    const debouncedQuery = useDebounce(query, 500);
    const isDiscoverPage = location.pathname === '/discover';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim()) {
                setMovies([]);
                setUsers([]);
                setCommunities([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const movieResults = await tmdbService.searchMovies(debouncedQuery);
                const normalizedQuery = debouncedQuery.trim().toLowerCase();
                const prefixMatches = movieResults.results
                    .filter(movie => movie.title.toLowerCase().startsWith(normalizedQuery))
                    .slice(0, 8);
                setMovies(prefixMatches);

                if (isDiscoverPage) {
                    setUsers([]);
                    setCommunities([]);
                } else {
                    const [matchingUsers, matchingComms] = await Promise.all([
                        dataService.searchUsers(debouncedQuery),
                        dataService.searchCommunities(debouncedQuery)
                    ]);
                    setUsers(matchingUsers.slice(0, 3));
                    setCommunities(matchingComms.slice(0, 3));
                }

            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setIsSearching(false);
            }
        };

        performSearch();
    }, [debouncedQuery, isDiscoverPage]);

    const hasResults = movies.length > 0 || users.length > 0 || communities.length > 0;

    return (
        <div className="relative w-full max-w-sm ml-4 md:ml-8" ref={containerRef}>
            <div className={cn(
                'relative flex items-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full overflow-hidden transition-all duration-300',
                isOpen && 'bg-black/80 border-primary shadow-[0_0_15px_rgba(239,68,68,0.2)]',
                'focus-within:bg-black/80 focus-within:border-primary focus-within:shadow-[0_0_15px_rgba(239,68,68,0.2)]'
            )}>
                <Search className={cn('w-4 h-4 ml-4 transition-colors', isOpen || query ? 'text-primary' : 'text-gray-400')} />
                <input
                    type="text"
                    placeholder={isDiscoverPage ? "Search movies..." : "Search movies, people..."}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="w-full bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 py-2 px-3 placeholder:text-gray-500"
                />

                {query && (
                    <button onClick={() => { setQuery(''); setIsOpen(false); }} className="mr-3 p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            {isOpen && query.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">

                    {isSearching ? (
                        <div className="flex items-center justify-center p-8 text-gray-400">
                            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                            Searching...
                        </div>
                    ) : !hasResults ? (
                        <div className="p-8 text-center text-gray-400">
                            No results found for "{query}"
                        </div>
                    ) : (
                        <div className="py-2">
                            {movies.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-2 bg-white/5">
                                        <Film className="w-3.5 h-3.5" /> Movies
                                    </h4>
                                    <div className="px-2">
                                        {movies.map(movie => (
                                            <div key={movie.id} className="flex gap-3 p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-colors" onClick={() => { navigate(`/movie/${movie.id}`); setIsOpen(false); setQuery(''); }}>
                                                <div className="w-10 h-14 bg-gray-800 rounded object-cover overflow-hidden flex-shrink-0">
                                                    {movie.poster_path && (
                                                        <img src={movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w200${movie.poster_path}`} alt={movie.title} className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col justify-center">
                                                    <span className="font-bold text-sm text-white line-clamp-1">{movie.title}</span>
                                                    <span className="text-xs text-gray-400">{movie.release_date.split('-')[0]}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!isDiscoverPage && users.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-2 bg-white/5">
                                        <Users className="w-3.5 h-3.5" /> People
                                    </h4>
                                    <div className="px-2">
                                        {users.map(user => (
                                            <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-colors" onClick={() => { navigate(`/profile/${user.username}`); setIsOpen(false); setQuery(''); }}>
                                                <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-white">@{user.username}</span>
                                                    <span className="text-xs text-gray-400 truncate max-w-[200px]">{user.bio}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!isDiscoverPage && communities.length > 0 && (
                                <div>
                                    <h4 className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-2 bg-white/5">
                                        <LayoutGrid className="w-3.5 h-3.5" /> Communities
                                    </h4>
                                    <div className="px-2">
                                        {communities.map(comm => (
                                            <div key={comm.id} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
                                                <img src={comm.imageUrl} alt={comm.name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-white">{comm.name}</span>
                                                    <span className="text-xs text-gray-400">{(comm.memberCount / 1000).toFixed(1)}k members</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
