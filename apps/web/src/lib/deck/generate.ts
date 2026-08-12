import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DECK_BATCH_SIZE,
  genreIdsToTmdbParam,
  genreNamesToIds,
  MAX_TMDB_PAGES_FILTERED,
  MAX_TMDB_PAGES_PER_REQUEST,
  TMDB_GENRE_ANIMATION,
  TMDB_GENRE_DOCUMENTARY,
  type Classification,
  type DeckItem,
  type DeckSort,
  type MediaFormat,
  type ReviewStatus,
  type WatchStatus,
} from '@mubitracker/shared';
import { tmdbDiscover } from '@/lib/tmdb/provider';
import { upsertMediaBatch } from '@/lib/media/repository';

export interface ParsedDeckFilters {
  format?: MediaFormat[];
  classification?: Classification[];
  genreNames?: string[];
  language?: string[];
  yearFrom?: number;
  yearTo?: number;
  status?: WatchStatus[];
  reviewStatus?: ReviewStatus[];
  sort?: DeckSort;
  friendId?: string;
  friendMode?: string;
}

export function parseDeckFilters(searchParams: URLSearchParams): ParsedDeckFilters {
  const parseList = (key: string) => {
    const v = searchParams.get(key);
    return v ? v.split(',').filter(Boolean) : undefined;
  };

  return {
    format: parseList('format') as MediaFormat[] | undefined,
    classification: parseList('classification') as Classification[] | undefined,
    genreNames: parseList('genres'),
    language: parseList('language'),
    yearFrom: searchParams.get('year_from')
      ? parseInt(searchParams.get('year_from')!, 10)
      : undefined,
    yearTo: searchParams.get('year_to') ? parseInt(searchParams.get('year_to')!, 10) : undefined,
    status: parseList('status') as WatchStatus[] | undefined,
    reviewStatus: parseList('review_status') as ReviewStatus[] | undefined,
    sort: (searchParams.get('sort') as DeckSort) ?? 'random',
    friendId: searchParams.get('friend_id') ?? undefined,
    friendMode: searchParams.get('friend_mode') ?? undefined,
  };
}

function hasClassification(filters: ParsedDeckFilters, value: Classification): boolean {
  return Boolean(filters.classification?.includes(value));
}

/** Map Mubitracker filters → TMDB discover query (format-aware for dates/genres). */
export function buildTmdbParams(
  filters: ParsedDeckFilters,
  format: MediaFormat,
): Record<string, string> {
  const params: Record<string, string> = {};

  const wantsAnime = hasClassification(filters, 'anime');
  const wantsDoc = hasClassification(filters, 'documentary');
  const wantsAnimation = hasClassification(filters, 'animation');
  const userGenres = genreNamesToIds(filters.genreNames ?? [], format);

  if (wantsAnime || wantsAnimation) {
    const extras = userGenres.filter((id) => id !== TMDB_GENRE_ANIMATION);
    params.with_genres = extras.length
      ? `${TMDB_GENRE_ANIMATION},${genreIdsToTmdbParam(extras, 'or')}`
      : String(TMDB_GENRE_ANIMATION);
  } else if (wantsDoc) {
    const extras = userGenres.filter((id) => id !== TMDB_GENRE_DOCUMENTARY);
    params.with_genres = extras.length
      ? `${TMDB_GENRE_DOCUMENTARY},${genreIdsToTmdbParam(extras, 'or')}`
      : String(TMDB_GENRE_DOCUMENTARY);
  } else if (userGenres.length) {
    params.with_genres = genreIdsToTmdbParam(userGenres, 'or');
  }

  // Anime implies Japanese. Non-ja language chips are ignored for anime decks
  // so we don't discover English animation and then drop it in post-filter.
  if (wantsAnime) {
    params.with_original_language = 'ja';
  } else if (filters.language?.length === 1) {
    params.with_original_language = filters.language[0];
  }

  const gte = filters.yearFrom != null ? `${filters.yearFrom}-01-01` : undefined;
  const lte = filters.yearTo != null ? `${filters.yearTo}-12-31` : undefined;
  if (format === 'movie') {
    if (gte) params['primary_release_date.gte'] = gte;
    if (lte) params['primary_release_date.lte'] = lte;
  } else {
    if (gte) params['first_air_date.gte'] = gte;
    if (lte) params['first_air_date.lte'] = lte;
  }

  if (filters.sort === 'newest') {
    params.sort_by = format === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
  } else if (filters.sort === 'oldest') {
    params.sort_by = format === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc';
  } else {
    params.sort_by = 'popularity.desc';
  }

  return params;
}

function matchesClassification(
  classification: Classification,
  filters?: Classification[],
): boolean {
  if (!filters?.length) return true;
  return filters.includes(classification);
}

function matchesFormat(format: MediaFormat, filters?: MediaFormat[]): boolean {
  if (!filters?.length) return true;
  return filters.includes(format);
}

async function getExcludedMediaIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('user_media')
    .select('media_id')
    .eq('user_id', userId)
    .in('status', ['watched', 'watch_later']);
  return new Set((data ?? []).map((r) => r.media_id));
}

async function getFriendWatchedIds(
  supabase: SupabaseClient,
  friendId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('user_media')
    .select('media_id')
    .eq('user_id', friendId)
    .eq('status', 'watched');
  return new Set((data ?? []).map((r) => r.media_id));
}

async function getUserMediaStatusMap(
  supabase: SupabaseClient,
  userId: string,
  mediaIds: string[],
): Promise<Map<string, { status: WatchStatus; reviewStatus: ReviewStatus }>> {
  if (!mediaIds.length) return new Map();

  const { data } = await supabase
    .from('user_media')
    .select('media_id, status, review_status')
    .eq('user_id', userId)
    .in('media_id', mediaIds);

  return new Map(
    (data ?? []).map((r) => [
      r.media_id,
      { status: r.status as WatchStatus, reviewStatus: r.review_status as ReviewStatus },
    ]),
  );
}

function filterByUserStatus(
  mediaIds: string[],
  statusMap: Map<string, { status: WatchStatus; reviewStatus: ReviewStatus }>,
  filters: ParsedDeckFilters,
): string[] {
  const wantsWatched = filters.status?.includes('watched') ?? false;
  const wantsUnwatched = filters.status?.includes('unwatched') ?? false;

  return mediaIds.filter((id) => {
    const um = statusMap.get(id);
    const isWatched = um?.status === 'watched';

    // Both chips selected → status is not a filtering criterion (union, not AND).
    if (wantsWatched && wantsUnwatched) {
      // no-op
    } else if (wantsUnwatched && isWatched) {
      return false;
    } else if (wantsWatched && !isWatched) {
      return false;
    } else if (!wantsWatched && !wantsUnwatched && isWatched) {
      return false;
    }

    if (filters.reviewStatus?.includes('pending') && um?.reviewStatus !== 'pending') return false;

    return true;
  });
}

export interface DeckCursor {
  page: number;
  format: MediaFormat;
  sessionId: string;
}

export function encodeCursor(cursor: DeckCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string | null): DeckCursor | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString()) as DeckCursor;
  } catch {
    return null;
  }
}

export async function generateDeck(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedDeckFilters,
  limit: number,
  cursorRaw: string | null,
  sessionId?: string,
): Promise<{ items: DeckItem[]; cursor: string | null; sessionId: string; message?: string }> {
  const watchedIds = await getExcludedMediaIds(supabase, userId);
  let friendWatchedIds: Set<string> | null = null;

  if (filters.friendId) {
    friendWatchedIds = await getFriendWatchedIds(supabase, filters.friendId);
  }

  let session = sessionId;
  if (!session) {
    const { data } = await supabase
      .from('deck_sessions')
      .insert({ user_id: userId, filter_config: filters as unknown as Record<string, unknown> })
      .select('id')
      .single();
    session = data?.id ?? crypto.randomUUID();
  }

  const cursor = decodeCursor(cursorRaw);
  const formats: MediaFormat[] = filters.format?.length ? filters.format : ['movie', 'series'];
  let page = cursor?.page ?? Math.floor(Math.random() * 10) + 1;
  let format: MediaFormat =
    cursor?.format && formats.includes(cursor.format) ? cursor.format : formats[0];

  const items: DeckItem[] = [];
  const shownIds = new Set<string>();
  let attempts = 0;
  const maxPages =
    filters.classification?.length || filters.genreNames?.length || filters.language?.length
      ? MAX_TMDB_PAGES_FILTERED
      : MAX_TMDB_PAGES_PER_REQUEST;

  while (items.length < limit && attempts < maxPages) {
    attempts++;
    const tmdbParams = buildTmdbParams(filters, format);
    const discovered = await tmdbDiscover(format, page, tmdbParams);
    const upserted = await upsertMediaBatch(supabase, discovered);

    for (const media of upserted) {
      if (shownIds.has(media.id)) continue;
      if (watchedIds.has(media.id) && !filters.status?.includes('watched') && !filters.status?.includes('watch_later')) continue;
      if (!matchesFormat(media.format, filters.format)) continue;
      if (!matchesClassification(media.classification, filters.classification)) continue;

      if (friendWatchedIds) {
        if (filters.friendMode === 'watched_not_me' && !friendWatchedIds.has(media.id)) continue;
        if (filters.friendMode === 'watched' && !friendWatchedIds.has(media.id)) continue;
        if (!filters.friendMode && !friendWatchedIds.has(media.id)) continue;
      }

      shownIds.add(media.id);
      items.push({ ...media });
      if (items.length >= limit) break;
    }

    const formatIndex = formats.indexOf(format);
    if (formatIndex < formats.length - 1) {
      format = formats[formatIndex + 1];
    } else {
      format = formats[0];
      page++;
    }
  }

  const statusMap = await getUserMediaStatusMap(
    supabase,
    userId,
    items.map((i) => i.id),
  );

  let filteredIds = items.map((i) => i.id);
  if (filters.status?.length || filters.reviewStatus?.length) {
    filteredIds = filterByUserStatus(filteredIds, statusMap, filters);
  }

  const finalItems = items
    .filter((i) => filteredIds.includes(i.id))
    .map((i) => {
      const um = statusMap.get(i.id);
      return { ...i, userStatus: um?.status, userReviewStatus: um?.reviewStatus };
    });

  if (filters.sort === 'random') {
    for (let i = finalItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalItems[i], finalItems[j]] = [finalItems[j], finalItems[i]];
    }
  }

  const nextCursor =
    finalItems.length >= limit
      ? encodeCursor({ page, format, sessionId: session! })
      : null;

  return {
    items: finalItems.slice(0, limit),
    cursor: nextCursor,
    sessionId: session!,
    message:
      finalItems.length === 0
        ? 'No titles match these filters. Try broadening your filters.'
        : undefined,
  };
}

export { DECK_BATCH_SIZE };
