import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, Loader2, Search, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { socialApi, type MovieListItem } from '../services/socialApi';
import { tmdbService, type Movie } from '../services/tmdb';
import { timeAgo } from '../utils/time';

const posterUrl = (path?: string | null, size = 'w300') => {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${size}${path}`;
};

export const MovieList = () => {
  const [activeTab, setActiveTab] = useState<'watchlist' | 'watched'>('watchlist');
  const [items, setItems] = useState<MovieListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [rating, setRating] = useState(4);
  const [notes, setNotes] = useState('');

  const loadItems = async () => {
    setLoading(true);
    try {
      const rows = await socialApi.getMovieList('all');
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await tmdbService.searchMovies(q);
        if (!cancelled) setResults(res.results.slice(0, 8));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const filtered = useMemo(() => items.filter((item) => item.status === activeTab), [items, activeTab]);
  const counts = useMemo(() => ({
    watchlist: items.filter((item) => item.status === 'watchlist').length,
    watched: items.filter((item) => item.status === 'watched').length,
  }), [items]);

  const saveSelected = async (status: 'watchlist' | 'watched') => {
    if (!selectedMovie) return;
    const saved = await socialApi.saveMovieListItem({
      movie_id: selectedMovie.id,
      title: selectedMovie.title,
      poster_path: selectedMovie.poster_path,
      release_date: selectedMovie.release_date,
      status,
      rating: status === 'watched' ? rating : null,
      notes,
    });
    setItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id && item.movie_id !== saved.movie_id)]);
    setSelectedMovie(null);
    setQuery('');
    setResults([]);
    setNotes('');
    setActiveTab(status);
  };

  const updateItem = async (item: MovieListItem, payload: { status?: 'watchlist' | 'watched'; rating?: number | null; notes?: string }) => {
    const updated = await socialApi.updateMovieListItem(item.id, payload);
    setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  };

  const deleteItem = async (item: MovieListItem) => {
    if (!window.confirm(`Remove "${item.title}" from your list?`)) return;
    await socialApi.deleteMovieListItem(item.id);
    setItems((prev) => prev.filter((row) => row.id !== item.id));
  };

  return (
    <div className="min-h-screen pt-24 pb-10 px-4 md:px-8 bg-background text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-sm text-primary font-semibold">Your cinema shelf</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">Watchlist and Movie Log</h1>
            <p className="text-gray-400 mt-2 max-w-2xl">Keep movies you plan to watch, mark what you finished, and rate the ones worth remembering.</p>
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 w-full md:w-auto">
            {(['watchlist', 'watched'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === tab ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {tab === 'watchlist' ? 'Watchlist' : 'Watched'} · {counts[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
          <section className="border border-white/10 bg-white/[0.03] rounded-xl p-4 h-fit">
            <label className="text-sm font-semibold text-gray-300">Find a movie</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title"
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-3 outline-none focus:border-primary"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
            </div>

            <div className="mt-3 space-y-2 max-h-72 overflow-auto">
              {results.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => setSelectedMovie(movie)}
                  className={`w-full flex gap-3 text-left p-2 rounded-lg border transition ${selectedMovie?.id === movie.id ? 'border-primary bg-primary/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
                >
                  {movie.poster_path ? <img src={posterUrl(movie.poster_path, 'w185')} alt="" className="w-10 h-14 rounded object-cover" /> : <div className="w-10 h-14 rounded bg-white/10" />}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{movie.title}</p>
                    <p className="text-xs text-gray-500">{movie.release_date?.slice(0, 4) || 'Unknown year'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedMovie && (
              <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                <div className="flex gap-3">
                  {selectedMovie.poster_path && <img src={posterUrl(selectedMovie.poster_path, 'w185')} alt="" className="w-14 h-20 rounded object-cover" />}
                  <div>
                    <p className="font-bold">{selectedMovie.title}</p>
                    <p className="text-xs text-gray-500">{selectedMovie.release_date?.slice(0, 4) || 'Unknown year'}</p>
                  </div>
                </div>
                <label className="block text-sm text-gray-300">Rating for watched</label>
                <input type="range" min="0" max="5" step="0.5" value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full accent-primary" />
                <p className="text-sm text-yellow-400 flex items-center gap-1"><Star className="w-4 h-4 fill-current" /> {rating.toFixed(1)} / 5</p>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private notes or quick thoughts" className="w-full min-h-24 bg-black/40 border border-white/10 rounded-lg p-3 outline-none focus:border-primary" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => saveSelected('watchlist')} className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 font-semibold">
                    <Bookmark className="w-4 h-4" /> Plan
                  </button>
                  <button onClick={() => saveSelected('watched')} className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 font-semibold">
                    <Check className="w-4 h-4" /> Log
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="min-h-[360px]">
            {loading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="border border-white/10 rounded-xl bg-white/[0.03] p-10 text-center">
                <p className="text-lg font-semibold">No movies here yet</p>
                <p className="text-gray-500 mt-2">Search for a title and add it to start building your list.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((item) => (
                  <article key={item.id} className="border border-white/10 bg-white/[0.03] rounded-xl overflow-hidden">
                    <Link to={`/movie/${item.movie_id}`} className="block aspect-[16/10] bg-black/30 overflow-hidden">
                      {item.poster_path ? <img src={posterUrl(item.poster_path, 'w500')} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600">No poster</div>}
                    </Link>
                    <div className="p-4 space-y-3">
                      <div>
                        <h2 className="font-bold leading-tight">{item.title}</h2>
                        <p className="text-xs text-gray-500">{item.release_date?.slice(0, 4) || 'Unknown year'} · updated {timeAgo(item.updated_at)}</p>
                      </div>
                      {item.status === 'watched' && (
                        <p className="text-sm text-yellow-400 flex items-center gap-1"><Star className="w-4 h-4 fill-current" /> {item.rating?.toFixed(1) || 'Not rated'}</p>
                      )}
                      {item.notes && <p className="text-sm text-gray-300 line-clamp-3">{item.notes}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateItem(item, { status: item.status === 'watched' ? 'watchlist' : 'watched', rating: item.rating ?? 4 })}
                          className="flex-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold"
                        >
                          {item.status === 'watched' ? 'Move to plan' : 'Mark watched'}
                        </button>
                        <button onClick={() => deleteItem(item)} className="w-10 h-10 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
