import type { Classification, DeckSort, MediaFormat, ReviewStatus, WatchStatus } from './enums.js';

export interface DeckFilters {
  format?: MediaFormat[];
  classification?: Classification[];
  genres?: string[];
  language?: string[];
  yearFrom?: number;
  yearTo?: number;
  status?: WatchStatus[];
  reviewStatus?: ReviewStatus[];
  sort?: DeckSort;
  friendId?: string;
  friendMode?: 'watched' | 'reviewed' | 'watched_not_me';
}

export interface EraRange {
  label: string;
  yearFrom: number | null;
  yearTo: number | null;
}

export const RELEASE_ERAS: EraRange[] = [
  { label: 'Before 1980', yearFrom: null, yearTo: 1979 },
  { label: '1980s', yearFrom: 1980, yearTo: 1989 },
  { label: '1990s', yearFrom: 1990, yearTo: 1999 },
  { label: '2000s', yearFrom: 2000, yearTo: 2009 },
  { label: '2010s', yearFrom: 2010, yearTo: 2019 },
  { label: '2020s', yearFrom: 2020, yearTo: null },
];

export const FILTER_TYPE_OPTIONS = [
  { id: 'movies', label: 'Movies', format: 'movie' as MediaFormat, classification: undefined },
  { id: 'series', label: 'Series', format: 'series' as MediaFormat, classification: undefined },
  { id: 'anime', label: 'Anime', format: undefined, classification: 'anime' as Classification },
  {
    id: 'anime_movies',
    label: 'Anime Movies',
    format: 'movie' as MediaFormat,
    classification: 'anime' as Classification,
  },
  {
    id: 'documentaries',
    label: 'Documentaries',
    format: undefined,
    classification: 'documentary' as Classification,
  },
];

export function filtersFromSearchParams(searchParams: URLSearchParams): DeckFilters {
  const parseList = (key: string) => {
    const v = searchParams.get(key);
    return v ? v.split(',').filter(Boolean) : undefined;
  };

  const yearFrom = searchParams.get('year_from');
  const yearTo = searchParams.get('year_to');

  return {
    format: parseList('format') as DeckFilters['format'],
    classification: parseList('classification') as DeckFilters['classification'],
    genres: parseList('genres'),
    language: parseList('language'),
    yearFrom: yearFrom ? parseInt(yearFrom, 10) : undefined,
    yearTo: yearTo ? parseInt(yearTo, 10) : undefined,
    status: parseList('status') as DeckFilters['status'],
    reviewStatus: parseList('review_status') as DeckFilters['reviewStatus'],
    sort: (searchParams.get('sort') as DeckFilters['sort']) ?? undefined,
    friendId: searchParams.get('friend_id') ?? undefined,
    friendMode: (searchParams.get('friend_mode') as DeckFilters['friendMode']) ?? undefined,
  };
}

export function deckFiltersToSearchParams(filters: DeckFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.format?.length) params.set('format', filters.format.join(','));
  if (filters.classification?.length)
    params.set('classification', filters.classification.join(','));
  if (filters.genres?.length) params.set('genres', filters.genres.join(','));
  if (filters.language?.length) params.set('language', filters.language.join(','));
  if (filters.yearFrom != null) params.set('year_from', String(filters.yearFrom));
  if (filters.yearTo != null) params.set('year_to', String(filters.yearTo));
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.reviewStatus?.length) params.set('review_status', filters.reviewStatus.join(','));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.friendId) params.set('friend_id', filters.friendId);
  if (filters.friendMode) params.set('friend_mode', filters.friendMode);
  return params;
}
