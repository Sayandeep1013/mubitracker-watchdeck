import type { Classification, MediaFormat, ReviewStatus, WatchStatus } from './enums.js';

export interface MediaSummary {
  id: string;
  format: MediaFormat;
  classification: Classification;
  title: string;
  originalTitle: string;
  overview: string;
  year: number | null;
  originalLanguage: string;
  posterPath: string | null;
  backdropPath: string | null;
  runtime: number | null;
  displayType: string;
}

export interface DeckItem extends MediaSummary {
  userStatus?: WatchStatus;
  userReviewStatus?: ReviewStatus;
}

export interface NormalizedMedia {
  provider: 'tmdb';
  providerId: string;
  format: MediaFormat;
  classification: Classification;
  title: string;
  originalTitle: string;
  overview: string;
  releaseDate: string | null;
  year: number | null;
  originalLanguage: string;
  posterPath: string | null;
  backdropPath: string | null;
  runtime: number | null;
  genreIds: number[];
  popularity: number;
  adult: boolean;
  voteCount: number;
}

export interface ExternalId {
  provider: string;
  externalId: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface DiscoverFilters {
  format?: MediaFormat[];
  classification?: Classification[];
  genreIds?: number[];
  language?: string[];
  yearFrom?: number;
  yearTo?: number;
  sort?: string;
  page?: number;
}

export function getDisplayType(format: MediaFormat, classification: Classification): string {
  if (classification === 'anime' && format === 'movie') return 'Anime Movie';
  if (classification === 'anime') return 'Anime';
  if (classification === 'documentary') return 'Documentary';
  if (format === 'movie') return 'Movie';
  return 'Series';
}
