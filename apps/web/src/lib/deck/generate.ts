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
import { asDbMedia, attachGenreNames, toMediaSummary, upsertMediaBatch } from '@/lib/media/repository';
import { isHiddenNow } from '@/lib/deck/cooldown';
import { getRecentImpressions, recordImpressions } from '@/lib/deck/impressions';
import { friendshipPairFilter } from '@/lib/social/friends';

/** Thrown by the friend-deck path for conditions that map to a specific
 * HTTP status (spec 40 §5) rather than the generic 500 the route's catch
 * block otherwise returns. */
export class FriendAccessError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const FRIEND_MODES = ['watched_not_me', 'watched', 'reviewed'] as const;
type FriendMode = (typeof FRIEND_MODES)[number];

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

interface UserMediaState {
  status: WatchStatus;
  reviewStatus: ReviewStatus;
  rejectCount: number;
  hiddenUntil: string | null;
}

/**
 * Exclusion is evaluated as a scoped lookup against only the current page's
 * candidate ids (spec 24 §7), never as a single unbounded fetch of the
 * user's whole history — that was the v1 bug: PostgREST caps rows at 1,000,
 * so past 1,000 watched/watch_later items the in-memory Set silently
 * truncated and watched titles started reappearing.
 */
async function getUserMediaState(
  supabase: SupabaseClient,
  userId: string,
  mediaIds: string[],
): Promise<Map<string, UserMediaState>> {
  if (!mediaIds.length) return new Map();

  const { data } = await supabase
    .from('user_media')
    .select('media_id, status, review_status, reject_count, hidden_until')
    .eq('user_id', userId)
    .in('media_id', mediaIds);

  return new Map(
    (data ?? []).map((r) => [
      r.media_id,
      {
        status: r.status as WatchStatus,
        reviewStatus: r.review_status as ReviewStatus,
        rejectCount: r.reject_count ?? 0,
        hiddenUntil: r.hidden_until,
      },
    ]),
  );
}

/** Explicit status filters override cooldown — the user is asking to see
 * exactly those titles (spec 24 §8). Impression suppression is not a
 * rejection signal, so it is never overridden by a status filter. */
function isEligible(
  state: UserMediaState | undefined,
  filters: ParsedDeckFilters,
  recentlyImpressed: boolean,
): boolean {
  if (recentlyImpressed) return false;
  if (!state) return true;

  const wantsWatched = filters.status?.includes('watched') ?? false;
  const wantsWatchLater = filters.status?.includes('watch_later') ?? false;
  const wantsUnwatched = filters.status?.includes('unwatched') ?? false;

  if (state.status === 'watched') return wantsWatched;
  if (state.status === 'watch_later') return wantsWatchLater;
  if (state.status === 'unwatched' && isHiddenNow(state.hiddenUntil)) return wantsUnwatched;
  return true;
}

/** Spec 40 §5 rules 1-3: validates friend_mode + friendship acceptance +
 * reviews visibility before any candidate query runs. */
async function assertFriendAccess(
  supabase: SupabaseClient,
  userId: string,
  friendId: string,
  friendModeRaw: string | undefined,
): Promise<FriendMode> {
  if (friendModeRaw && !FRIEND_MODES.includes(friendModeRaw as FriendMode)) {
    throw new FriendAccessError(400, 'BAD_REQUEST', `Unknown friend_mode: ${friendModeRaw}`);
  }
  const mode = (friendModeRaw as FriendMode | undefined) ?? 'watched_not_me';

  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(friendshipPairFilter(userId, friendId))
    .maybeSingle();
  if (!friendship) {
    throw new FriendAccessError(403, 'FORBIDDEN', 'Not friends with this user');
  }

  if (mode === 'reviewed') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('reviews_visibility')
      .eq('id', friendId)
      .single();
    // 'friends' visibility is satisfied by the accepted-friendship check
    // above; only 'private' blocks an already-accepted friend.
    if (profile?.reviews_visibility === 'private') {
      throw new FriendAccessError(403, 'FORBIDDEN', "This user's reviews are private");
    }
  }

  return mode;
}

/**
 * Friend decks are a finite, known set — the friend's own watched list or
 * reviewed titles — not a random slice of the global TMDB catalog. Querying
 * it directly (rather than intersecting random discover pages, as before)
 * is what makes Their Deck actually show the friend's titles instead of
 * whichever ones happen to land on a randomly chosen page (spec 40 §5.4).
 */
async function getFriendCandidateMediaIds(
  supabase: SupabaseClient,
  friendId: string,
  mode: FriendMode,
): Promise<string[]> {
  if (mode === 'reviewed') {
    const { data } = await supabase
      .from('reviews')
      .select('media_id')
      .eq('user_id', friendId)
      .order('created_at', { ascending: false })
      .order('media_id', { ascending: false });
    return (data ?? []).map((r) => r.media_id);
  }

  const { data } = await supabase
    .from('user_media')
    .select('media_id')
    .eq('user_id', friendId)
    .eq('status', 'watched')
    .order('watched_at', { ascending: false, nullsFirst: false })
    .order('media_id', { ascending: false });
  return (data ?? []).map((r) => r.media_id);
}

/** `watched_not_me`/`reviewed`: "what have they seen/reviewed that I
 * haven't?" — drop anything already in my own watched/watch_later.
 * `watched` mode intentionally skips this (spec 40 §5: browse their whole
 * watched list, including titles I've already seen). */
async function excludeMyHistory(
  supabase: SupabaseClient,
  userId: string,
  candidateIds: string[],
): Promise<string[]> {
  if (!candidateIds.length) return candidateIds;
  const { data } = await supabase
    .from('user_media')
    .select('media_id')
    .eq('user_id', userId)
    .in('status', ['watched', 'watch_later'])
    .in('media_id', candidateIds);
  const mine = new Set((data ?? []).map((r) => r.media_id));
  return candidateIds.filter((id) => !mine.has(id));
}

async function generateFriendDeck(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedDeckFilters,
  limit: number,
  cursorRaw: string | null,
  sessionId: string | undefined,
): Promise<{ items: DeckItem[]; cursor: string | null; sessionId: string; message?: string }> {
  const friendId = filters.friendId!;
  const mode = await assertFriendAccess(supabase, userId, friendId, filters.friendMode);

  let candidateIds = await getFriendCandidateMediaIds(supabase, friendId, mode);
  if (mode !== 'watched') {
    candidateIds = await excludeMyHistory(supabase, userId, candidateIds);
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

  // The friend's candidate list is already fully known, so the cursor is
  // just a page offset into it — no TMDB paging/exclusion-loop needed.
  const cursor = decodeCursor(cursorRaw);
  const page = cursor?.page ?? 1;
  const offset = (page - 1) * limit;
  const pageIds = candidateIds.slice(offset, offset + limit);

  if (pageIds.length === 0) {
    return {
      items: [],
      cursor: null,
      sessionId: session!,
      message:
        candidateIds.length === 0
          ? mode === 'reviewed'
            ? "They haven't reviewed anything yet."
            : "They haven't watched anything yet."
          : "You've reached the end of their list.",
    };
  }

  const [{ data: mediaRows }, stateMap] = await Promise.all([
    supabase.from('media').select('*').in('id', pageIds),
    getUserMediaState(supabase, userId, pageIds),
  ]);
  const byId = new Map((mediaRows ?? []).map((m) => [m.id, m]));

  const items: DeckItem[] = pageIds
    .map((id) => byId.get(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((row) => {
      const summary = toMediaSummary(asDbMedia(row));
      const state = stateMap.get(row.id);
      return {
        ...summary,
        userStatus: state?.status,
        userReviewStatus: state?.reviewStatus,
        userRejectCount: state?.rejectCount ?? 0,
        userHiddenUntil: state?.hiddenUntil ?? null,
      };
    });

  const hasMore = offset + limit < candidateIds.length;
  const nextCursor = hasMore
    ? encodeCursor({ page: page + 1, format: 'movie', sessionId: session! })
    : null;

  return { items: await attachGenreNames(supabase, items), cursor: nextCursor, sessionId: session! };
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

/** Spec 50 §7's TMDB-down fallback for v1's discover loop. Not genre-aware
 * (would need a `media_genres` join) — format + classification is enough
 * to keep the deck alive and roughly on-topic during an outage; precision
 * degrading briefly is an acceptable trade against a 500. */
async function getLocalFallbackCandidates(
  supabase: SupabaseClient,
  format: MediaFormat,
  filters: ParsedDeckFilters,
  excludeIds: Set<string>,
  limit: number,
) {
  let query = supabase
    .from('media')
    .select('*')
    .eq('format', format)
    .order('popularity', { ascending: false })
    .limit(limit + excludeIds.size);
  if (filters.classification?.length) {
    query = query.in('classification', filters.classification);
  }
  const { data } = await query;
  return (data ?? [])
    .filter((row) => !excludeIds.has(row.id))
    .slice(0, limit)
    .map((row) => toMediaSummary(asDbMedia(row)));
}

export async function generateDeck(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedDeckFilters,
  limit: number,
  cursorRaw: string | null,
  sessionId?: string,
  requestId?: string,
): Promise<{ items: DeckItem[]; cursor: string | null; sessionId: string; message?: string }> {
  if (filters.friendId) {
    return generateFriendDeck(supabase, userId, filters, limit, cursorRaw, sessionId);
  }

  const genStart = Date.now();
  let tmdbMs = 0;
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
  let candidatesConsidered = 0;
  let candidatesEligible = 0;
  const maxPages =
    filters.classification?.length || filters.genreNames?.length || filters.language?.length
      ? MAX_TMDB_PAGES_FILTERED
      : MAX_TMDB_PAGES_PER_REQUEST;

  while (items.length < limit && attempts < maxPages) {
    attempts++;
    const tmdbParams = buildTmdbParams(filters, format);
    let upserted;
    try {
      const tmdbStart = Date.now();
      const discovered = await tmdbDiscover(format, page, tmdbParams);
      tmdbMs += Date.now() - tmdbStart;
      upserted = await upsertMediaBatch(supabase, discovered);
    } catch (e) {
      // Spec 50 §7: the deck survives TMDB being down instead of 500-ing —
      // fall back to whatever the corpus already has locally. `media` is
      // populated continuously by every prior discover/search this app has
      // ever done (Stage 2.4's ingest script plus organic upserts), so this
      // is a real, if smaller, candidate pool rather than an empty one.
      console.warn(
        `[deck] TMDB unreachable, using local media fallback: ${e instanceof Error ? e.message : e}`,
      );
      upserted = await getLocalFallbackCandidates(supabase, format, filters, shownIds, limit);
    }

    const pageIds = upserted.map((m) => m.id);
    const [stateMap, impressed] = await Promise.all([
      getUserMediaState(supabase, userId, pageIds),
      getRecentImpressions(supabase, userId, pageIds),
    ]);

    for (const media of upserted) {
      if (shownIds.has(media.id)) continue;
      if (!matchesFormat(media.format, filters.format)) continue;
      if (!matchesClassification(media.classification, filters.classification)) continue;

      candidatesConsidered++;
      const state = stateMap.get(media.id);
      if (!isEligible(state, filters, impressed.has(media.id))) continue;
      if (filters.reviewStatus?.includes('pending') && state?.reviewStatus !== 'pending') continue;
      candidatesEligible++;

      shownIds.add(media.id);
      items.push({
        ...media,
        userStatus: state?.status,
        userReviewStatus: state?.reviewStatus,
        userRejectCount: state?.rejectCount ?? 0,
        userHiddenUntil: state?.hiddenUntil ?? null,
      });
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

  // Early signal that a user is exhausting the corpus (spec 24 §9) — exactly
  // the condition v1 hit silently once ~400 titles were exhausted.
  if (candidatesConsidered > 0 && candidatesEligible < limit * 2) {
    console.warn(
      `[deck] low eligible pool user=${userId} eligible=${candidatesEligible} considered=${candidatesConsidered} limit=${limit}`,
    );
  }

  const finalItems = items;

  if (filters.sort === 'random') {
    for (let i = finalItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalItems[i], finalItems[j]] = [finalItems[j], finalItems[i]];
    }
  }

  // Only the served page pays the extra query — the rest of finalItems
  // (over-fetched candidates that lost the slice) never need genre names.
  const served = await attachGenreNames(supabase, finalItems.slice(0, limit));
  if (served.length > 0) {
    await recordImpressions(supabase, userId, served.map((i) => i.id));
  }

  console.log(
    JSON.stringify({
      evt: 'deck.generate',
      ms: Date.now() - genStart,
      tmdb_pages: attempts,
      tmdb_ms: tmdbMs,
      candidates: candidatesConsidered,
      excluded: candidatesConsidered - candidatesEligible,
      returned: served.length,
      filtered: Boolean(
        filters.format?.length ||
          filters.classification?.length ||
          filters.genreNames?.length ||
          filters.language?.length ||
          filters.yearFrom != null ||
          filters.yearTo != null ||
          filters.status?.length,
      ),
      req_id: requestId,
    }),
  );

  const nextCursor =
    finalItems.length >= limit
      ? encodeCursor({ page, format, sessionId: session! })
      : null;

  return {
    items: served,
    cursor: nextCursor,
    sessionId: session!,
    message:
      finalItems.length === 0
        ? 'No titles match these filters. Try broadening your filters.'
        : undefined,
  };
}

export { DECK_BATCH_SIZE };
