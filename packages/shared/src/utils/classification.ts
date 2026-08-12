import type { Classification } from '../types/enums.js';
import { TMDB_GENRE_ANIMATION, TMDB_GENRE_DOCUMENTARY } from '../constants/tmdb.js';

export function classifyMedia(
  genreIds: number[],
  originalLanguage: string,
): Classification {
  if (genreIds.includes(TMDB_GENRE_DOCUMENTARY)) {
    return 'documentary';
  }
  if (genreIds.includes(TMDB_GENRE_ANIMATION) && originalLanguage === 'ja') {
    return 'anime';
  }
  if (genreIds.includes(TMDB_GENRE_ANIMATION)) {
    return 'animation';
  }
  return 'live_action';
}
