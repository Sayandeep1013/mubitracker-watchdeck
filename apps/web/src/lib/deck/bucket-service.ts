import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  genreNamesToIds,
  getDisplayType,
  type Classification,
  type DeckItem,
  type MediaFormat,
} from '@mubitracker/shared';
import { getTaste, deriveQuotas, MIN_DECISIONS_FOR_TASTE, type TasteVector } from '@/lib/deck/taste';
import { recordImpressions } from '@/lib/deck/impressions';
import { tmdbDiscover } from '@/lib/tmdb/provider';
import { upsertMediaBatch } from '@/lib/media/repository';
import type { ParsedDeckFilters } from '@/lib/deck/generate';

const BUCKET_SIZE = 50;
const EXPLORE_SLOTS = 10;
const CANDIDATE_OVERSAMPLE = 3;
const TOP_GENRES_EXCLUDED_FROM_EXPLORE = 3;

export interface Bucket {
  id: string;
  items: DeckItem[];
  position: number;
  partial: boolean;
  reason?: 'no_matches_for_filters' | 'corpus_exhausted';
}

interface EligibleRow {
  id: string;
  format: string;
  classification: string;
  popularity: number;
  year: number | null;
  title: string;
  original_title: string;
  overview: string;
  original_language: string;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
  genre_ids: number[];
}

/**
 * Bucket assembly needs a plain object per item (persisted as jsonb), not a
 * SQL row shape — this doubles as the conversion to DeckItem for the API
 * response.
 */
function rowToDeckItem(row: EligibleRow): DeckItem {
  return {
    id: row.id,
    format: row.format as MediaFormat,
    classification: row.classification as Classification,
    title: row.title,
    originalTitle: row.original_title,
    overview: row.overview,
    year: row.year,
    originalLanguage: row.original_language,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    runtime: row.runtime,
    displayType: getDisplayType(row.format as MediaFormat, row.classification as Classification),
    userRejectCount: 0,
    userHiddenUntil: null,
  };
}

// --- filter hashing (spec 23 §7) ---

function sortedOrUndefined<T>(arr: T[] | undefined): T[] | undefined {
  return arr && arr.length ? [...arr].sort() : undefined;
}

function normaliseFilters(filters: ParsedDeckFilters): Record<string, unknown> {
  const norm: Record<string, unknown> = {};
  const format = sortedOrUndefined(filters.format);
  if (format) norm.format = format;
  const classification = sortedOrUndefined(filters.classification);
  if (classification) norm.classification = classification;
  const genreNames = sortedOrUndefined(filters.genreNames);
  if (genreNames) norm.genreNames = genreNames;
  const language = sortedOrUndefined(filters.language);
  if (language) norm.language = language;
  if (filters.yearFrom != null) norm.yearFrom = filters.yearFrom;
  if (filters.yearTo != null) norm.yearTo = filters.yearTo;
  return norm;
}

export function computeFilterHash(filters: ParsedDeckFilters): string {
  return createHash('sha256').update(JSON.stringify(normaliseFilters(filters))).digest('hex');
}

/** The bucket algorithm (taste-weighted quotas, explore/exploit) only makes
 * sense for the default personalized deck. Explicit status/review-status
 * filters and friend decks ask for a specific, non-personalized subset —
 * those stay on the v1 generate.ts path. */
export function supportsBucketAlgorithm(filters: ParsedDeckFilters): boolean {
  return !filters.friendId && !filters.status?.length && !filters.reviewStatus?.length;
}

// --- candidate query (spec 23 §4 / spec 24 §7) ---

async function getEligibleCandidates(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    formats?: string[];
    classifications?: string[];
    genreIds?: number[];
    languages?: string[];
    yearFrom?: number;
    yearTo?: number;
    limit: number;
  },
): Promise<EligibleRow[]> {
  const { data, error } = await supabase.rpc('get_eligible_media', {
    p_user_id: userId,
    p_formats: opts.formats ?? null,
    p_classifications: opts.classifications ?? null,
    p_genre_ids: opts.genreIds ?? null,
    p_languages: opts.languages ?? null,
    p_year_from: opts.yearFrom ?? null,
    p_year_to: opts.yearTo ?? null,
    p_limit: opts.limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as EligibleRow[];
}

function resolveGenreIds(names: string[] | undefined): number[] {
  if (!names?.length) return [];
  const ids = new Set([...genreNamesToIds(names, 'movie'), ...genreNamesToIds(names, 'series')]);
  return [...ids];
}

// --- weighted sampling (spec 23 §3 step 4) ---

function scoreCandidate(row: EligibleRow, taste: TasteVector, maxPopularity: number): number {
  const genreAff = row.genre_ids.length
    ? row.genre_ids.reduce((sum, g) => sum + (taste.genre[String(g)] ?? 0.5), 0) / row.genre_ids.length
    : 0.5;
  const normPop = maxPopularity > 0 ? Math.min(1, row.popularity / maxPopularity) : 0;
  return 0.7 * genreAff + 0.3 * normPop;
}

function weightedSampleWithoutReplacement(
  items: { id: string; weight: number }[],
  n: number,
): Set<string> {
  const pool = items.map((i) => ({ id: i.id, weight: Math.max(i.weight, 0.0001) }));
  const chosen = new Set<string>();
  while (chosen.size < n && pool.length > 0) {
    const total = pool.reduce((sum, i) => sum + i.weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    chosen.add(pool[idx].id);
    pool.splice(idx, 1);
  }
  return chosen;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function topGenreIds(taste: TasteVector, n: number): Set<string> {
  return new Set(
    Object.entries(taste.genre)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k),
  );
}

/** Best-effort TMDB top-up (spec 23 §5 step 3) — narrow discover call
 * matching the unsatisfied quota, ingesting whatever it finds via the same
 * upsert path deck/search already use. Not exhaustive; this is a fallback
 * for a genuinely thin corpus/filter combination, not the primary ingestion
 * mechanism (that's spec 21's scheduled script). */
async function tmdbTopUp(
  supabase: SupabaseClient,
  format: MediaFormat,
  genreIds: number[],
): Promise<void> {
  try {
    const params: Record<string, string> = { sort_by: 'popularity.desc' };
    if (genreIds.length) params.with_genres = genreIds.join('|');
    const discovered = await tmdbDiscover(format, Math.floor(Math.random() * 5) + 1, params);
    await upsertMediaBatch(supabase, discovered);
  } catch {
    // Top-up is best-effort — a TMDB hiccup here should not fail bucket build.
  }
}

// --- assembly (spec 23 §3) ---

export async function buildBucket(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedDeckFilters,
): Promise<Bucket> {
  const filterHash = computeFilterHash(filters);
  const taste = await getTaste(supabase, userId);
  const quotas = deriveQuotas(taste);

  const genreIds = resolveGenreIds(filters.genreNames);
  const allowedFormats = filters.format?.length ? filters.format : null;
  const explicitClassification = filters.classification?.length ? filters.classification : null;

  const chosen = new Map<string, EligibleRow>();

  const commonOpts = {
    genreIds: genreIds.length ? genreIds : undefined,
    languages: filters.language?.length ? filters.language : undefined,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
  };

  if (explicitClassification) {
    // An explicit classification chip (e.g. "Documentaries") makes the
    // movie/series/anime quota split meaningless — just fill from what
    // matches, taste-weighted, up to the full exploit budget.
    const pool = await getEligibleCandidates(supabase, userId, {
      ...commonOpts,
      formats: allowedFormats ?? undefined,
      classifications: explicitClassification,
      limit: BUCKET_SIZE * CANDIDATE_OVERSAMPLE,
    });
    const maxPop = Math.max(0, ...pool.map((r) => r.popularity));
    const picked = weightedSampleWithoutReplacement(
      pool.map((r) => ({ id: r.id, weight: scoreCandidate(r, taste, maxPop) })),
      BUCKET_SIZE,
    );
    for (const row of pool) if (picked.has(row.id)) chosen.set(row.id, row);
  } else {
    const quotaBuckets: { key: keyof typeof quotas; formats?: string[]; classifications: string[] }[] = [
      { key: 'movie', formats: ['movie'], classifications: ['live_action', 'animation', 'documentary'] },
      { key: 'series', formats: ['series'], classifications: ['live_action', 'animation', 'documentary'] },
      { key: 'anime', classifications: ['anime'] },
    ];

    // The three pools are disjoint by construction (movie/series explicitly
    // exclude anime classification; anime is format-agnostic), so they can
    // be fetched concurrently instead of round-tripping one at a time.
    const activeBuckets = quotaBuckets
      .map((bucket) => {
        const slotCount = quotas[bucket.key];
        const formats = bucket.formats
          ? allowedFormats
            ? bucket.formats.filter((f) => allowedFormats.includes(f as MediaFormat))
            : bucket.formats
          : (allowedFormats ?? undefined);
        return { ...bucket, slotCount, formats };
      })
      .filter((b) => b.slotCount > 0 && !(b.formats && allowedFormats && b.formats.length === 0));

    const pools = await Promise.all(
      activeBuckets.map((bucket) =>
        getEligibleCandidates(supabase, userId, {
          ...commonOpts,
          formats: bucket.formats,
          classifications: bucket.classifications,
          limit: bucket.slotCount * CANDIDATE_OVERSAMPLE + 10,
        }),
      ),
    );

    activeBuckets.forEach((bucket, i) => {
      const available = pools[i].filter((r) => !chosen.has(r.id));
      const maxPop = Math.max(0, ...available.map((r) => r.popularity));
      const picked = weightedSampleWithoutReplacement(
        available.map((r) => ({ id: r.id, weight: scoreCandidate(r, taste, maxPop) })),
        bucket.slotCount,
      );
      for (const row of available) if (picked.has(row.id)) chosen.set(row.id, row);
    });
  }

  // Explore: 10 wildcards outside the user's top-3 genres (spec 23 §3 step 5).
  const explorePool = await getEligibleCandidates(supabase, userId, {
    ...commonOpts,
    formats: allowedFormats ?? undefined,
    classifications: explicitClassification ?? undefined,
    limit: EXPLORE_SLOTS * CANDIDATE_OVERSAMPLE + 20,
  });
  const top3 = taste.decisionCount >= MIN_DECISIONS_FOR_TASTE ? topGenreIds(taste, TOP_GENRES_EXCLUDED_FROM_EXPLORE) : new Set<string>();

  let exploreCandidates = explorePool.filter(
    (r) => !chosen.has(r.id) && !r.genre_ids.some((g) => top3.has(String(g))),
  );
  if (exploreCandidates.length < EXPLORE_SLOTS) {
    // Shortfall step 1: relax the top-3 exclusion.
    exploreCandidates = explorePool.filter((r) => !chosen.has(r.id));
  }
  for (const row of shuffle(exploreCandidates).slice(0, EXPLORE_SLOTS)) chosen.set(row.id, row);

  // Shortfall step 2: quotas are floors, not walls — if we're still short,
  // pull anything eligible matching the user's explicit filters only.
  if (chosen.size < BUCKET_SIZE) {
    const fillPool = await getEligibleCandidates(supabase, userId, {
      ...commonOpts,
      formats: allowedFormats ?? undefined,
      classifications: explicitClassification ?? undefined,
      limit: (BUCKET_SIZE - chosen.size) * CANDIDATE_OVERSAMPLE + 20,
    });
    for (const row of fillPool) {
      if (chosen.size >= BUCKET_SIZE) break;
      if (!chosen.has(row.id)) chosen.set(row.id, row);
    }
  }

  // Shortfall step 3: best-effort TMDB top-up, then one more local pull.
  if (chosen.size < BUCKET_SIZE) {
    const topUpFormats = allowedFormats ?? ['movie', 'series'];
    await Promise.all(topUpFormats.map((f) => tmdbTopUp(supabase, f, genreIds)));
    const fillPool = await getEligibleCandidates(supabase, userId, {
      ...commonOpts,
      formats: allowedFormats ?? undefined,
      classifications: explicitClassification ?? undefined,
      limit: (BUCKET_SIZE - chosen.size) * CANDIDATE_OVERSAMPLE + 20,
    });
    for (const row of fillPool) {
      if (chosen.size >= BUCKET_SIZE) break;
      if (!chosen.has(row.id)) chosen.set(row.id, row);
    }
  }

  const items = shuffle([...chosen.values()]).map(rowToDeckItem);
  const partial = items.length < BUCKET_SIZE;
  const reason: Bucket['reason'] = !partial
    ? undefined
    : items.length === 0
      ? (genreIds.length || explicitClassification || filters.language?.length
          ? 'no_matches_for_filters'
          : 'corpus_exhausted')
      : 'corpus_exhausted';

  const { data: inserted, error } = await supabase
    .from('deck_buckets')
    .insert({
      user_id: userId,
      filter_hash: filterHash,
      status: 'ready',
      items,
      partial,
      reason,
    })
    .select('id')
    .single();
  if (error || !inserted) throw new Error(error?.message ?? 'Failed to persist bucket');

  await recordImpressions(supabase, userId, items.map((i) => i.id));

  return { id: inserted.id, items, position: 0, partial, reason };
}

export async function getReadyBucket(
  supabase: SupabaseClient,
  userId: string,
  filterHash: string,
): Promise<Bucket | null> {
  const { data } = await supabase
    .from('deck_buckets')
    .select('id, items, partial, reason')
    .eq('user_id', userId)
    .eq('filter_hash', filterHash)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    items: data.items as DeckItem[],
    position: 0,
    partial: data.partial,
    reason: data.reason ?? undefined,
  };
}

export async function getBucketById(
  supabase: SupabaseClient,
  userId: string,
  bucketId: string,
): Promise<Bucket | null> {
  const { data } = await supabase
    .from('deck_buckets')
    .select('id, items, partial, reason')
    .eq('user_id', userId)
    .eq('id', bucketId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    items: data.items as DeckItem[],
    position: 0,
    partial: data.partial,
    reason: data.reason ?? undefined,
  };
}

/** Marks the given bucket 'serving' and demotes any other 'serving' bucket
 * for this filterHash to 'consumed' — at most one serving bucket per
 * (user, filterHash) (spec 23 §2). */
export async function markServing(
  supabase: SupabaseClient,
  userId: string,
  filterHash: string,
  bucketId: string,
): Promise<void> {
  await supabase
    .from('deck_buckets')
    .update({ status: 'consumed' })
    .eq('user_id', userId)
    .eq('filter_hash', filterHash)
    .eq('status', 'serving');

  await supabase
    .from('deck_buckets')
    .update({ status: 'serving', served_at: new Date().toISOString() })
    .eq('id', bucketId);
}

const BUILD_LOCK_STALE_MS = 60 * 1000;

/**
 * Row-based lock keyed on (userId, filterHash) so two rapid requests can't
 * both build (spec 23 §6) — see the migration comment for why this isn't a
 * Postgres advisory lock. A lock older than 60s is treated as abandoned
 * (e.g. a crashed build) and stolen rather than left blocking forever.
 * Always pair with `releaseBuildLock` in a `finally`.
 */
export async function tryAcquireBuildLock(
  supabase: SupabaseClient,
  userId: string,
  filterHash: string,
): Promise<boolean> {
  const { data: inserted } = await supabase
    .from('deck_build_locks')
    .upsert(
      { user_id: userId, filter_hash: filterHash, acquired_at: new Date().toISOString() },
      { onConflict: 'user_id,filter_hash', ignoreDuplicates: true },
    )
    .select('user_id')
    .maybeSingle();
  if (inserted) return true;

  const { data: existing } = await supabase
    .from('deck_build_locks')
    .select('acquired_at')
    .eq('user_id', userId)
    .eq('filter_hash', filterHash)
    .maybeSingle();
  if (!existing) return false;

  const age = Date.now() - new Date(existing.acquired_at).getTime();
  if (age < BUILD_LOCK_STALE_MS) return false;

  await supabase
    .from('deck_build_locks')
    .update({ acquired_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('filter_hash', filterHash)
    .lt('acquired_at', existing.acquired_at); // no-op if someone else already stole/refreshed it
  return true;
}

export async function releaseBuildLock(
  supabase: SupabaseClient,
  userId: string,
  filterHash: string,
): Promise<void> {
  await supabase
    .from('deck_build_locks')
    .delete()
    .eq('user_id', userId)
    .eq('filter_hash', filterHash);
}
