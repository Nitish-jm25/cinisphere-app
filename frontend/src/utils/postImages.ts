const FALLBACK_MOVIE_IMAGES = [
  'https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
  'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  'https://image.tmdb.org/t/p/w780/8UlWHLMpgZm9bx6QYh0NFoq67TZ.jpg',
  'https://image.tmdb.org/t/p/w780/w7PJ7fBEYOuaAMKfYa4zmw45v3N.jpg',
  'https://image.tmdb.org/t/p/w780/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
  'https://image.tmdb.org/t/p/w780/6ELJEzQJ3Y45HczvreC3dg0GV5R.jpg',
  'https://image.tmdb.org/t/p/w780/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg',
  'https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
];

const pickFallback = (seed: number) => {
  const index = Math.abs(seed) % FALLBACK_MOVIE_IMAGES.length;
  return FALLBACK_MOVIE_IMAGES[index];
};

export const resolvePostImages = (
  postId: number | string,
  imageUrl?: string | null,
  imageUrls?: string[] | null
): string[] => {
  const cleaned = (imageUrls || []).filter((img) => typeof img === 'string' && img.trim().length > 0);
  if (cleaned.length > 0) return cleaned;

  if (imageUrl && imageUrl.trim().length > 0) return [imageUrl];

  const numericSeed = typeof postId === 'number' ? postId : Number.parseInt(String(postId), 10) || 1;
  return [pickFallback(numericSeed)];
};
