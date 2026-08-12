import { TMDB_IMAGE_BASE, TMDB_POSTER_SIZES } from '../constants/tmdb.js';

export function tmdbPosterUrl(
  path: string | null | undefined,
  size: keyof typeof TMDB_POSTER_SIZES = 'deck',
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZES[size]}${path}`;
}

export function tmdbBackdropUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/w1280${path}`;
}
