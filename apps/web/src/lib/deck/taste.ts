import type { SupabaseClient } from '@supabase/supabase-js';

/** spec 22 §4: below this many total decisions, computed affinity is noise —
 * ignore it entirely and use fixed default quotas. */
export const MIN_DECISIONS_FOR_TASTE = 50;

/** spec 22 §4: Laplace smoothing toward the population mean. */
const SMOOTHING_ALPHA = 5;
const SMOOTHING_PRIOR = 0.5;

/** spec 22 §7: recompute when either threshold is crossed. */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_MIN_NEW_DECISIONS = 10;

const EXPLOIT_SLOTS = 40;
const QUOTA_FLOOR = 2;

export interface TasteVector {
  decisionCount: number;
  genre: Record<string, number>;
  format: Record<string, number>;
  classification: Record<string, number>;
}

export interface DeckQuotas {
  movie: number;
  series: number;
  anime: number;
}

export const DEFAULT_QUOTAS: DeckQuotas = { movie: 30, series: 10, anime: 10 };

interface RawDimension {
  [key: string]: { accepted: number | null; decided: number | null };
}

interface RawTaste {
  decisionCount: number;
  genre: RawDimension;
  format: RawDimension;
  classification: RawDimension;
}

function smooth(accepted: number | null, decided: number | null): number {
  const a = accepted ?? 0;
  const d = decided ?? 0;
  return (a + SMOOTHING_ALPHA * SMOOTHING_PRIOR) / (d + SMOOTHING_ALPHA);
}

function smoothDimension(raw: RawDimension | undefined): Record<string, number> {
  return Object.fromEntries(
    Object.entries(raw ?? {}).map(([key, v]) => [key, smooth(v.accepted, v.decided)]),
  );
}

function buildTasteVector(raw: RawTaste): TasteVector {
  return {
    decisionCount: raw.decisionCount ?? 0,
    genre: smoothDimension(raw.genre),
    format: smoothDimension(raw.format),
    classification: smoothDimension(raw.classification),
  };
}

async function computeAndCacheTaste(
  supabase: SupabaseClient,
  userId: string,
): Promise<TasteVector> {
  const { data: raw, error } = await supabase.rpc('compute_user_taste', { p_user_id: userId });
  if (error) throw new Error(error.message);

  const vector = buildTasteVector(raw as RawTaste);

  await supabase.from('user_taste').upsert(
    {
      user_id: userId,
      vector,
      decision_count: vector.decisionCount,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  return vector;
}

/**
 * Returns the user's cached taste vector, recomputing when the cache is
 * missing, >24h old, or ≥10 decisions stale (spec 22 §7). Cheap to rebuild —
 * a stale cache degrades ranking quality, never correctness.
 */
export async function getTaste(supabase: SupabaseClient, userId: string): Promise<TasteVector> {
  const { data: cached } = await supabase
    .from('user_taste')
    .select('vector, decision_count, computed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.computed_at).getTime();
    if (age < CACHE_MAX_AGE_MS) {
      const { count } = await supabase
        .from('user_media')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['watched', 'watch_later', 'unwatched']);
      const newDecisions = (count ?? 0) - cached.decision_count;
      if (newDecisions < CACHE_MIN_NEW_DECISIONS) {
        return cached.vector as TasteVector;
      }
    }
  }

  return computeAndCacheTaste(supabase, userId);
}

function affinityOf(dim: Record<string, number>, key: string): number {
  // Absent = zero samples, which is exactly what smooth(0, 0) already
  // evaluates to (the neutral smoothing prior) — reuse it rather than a
  // separate hardcoded default so the two stay consistent by construction.
  return dim[key] ?? smooth(0, 0);
}

/**
 * spec 22 §8. Below the cold-start threshold, fixed defaults. Otherwise
 * derive the three exploit-slot quotas from affinity, respecting a floor of
 * 2 so no bucket disappears, then rebalance rounding remainders onto the
 * largest-affinity buckets so slots always sum to exactly EXPLOIT_SLOTS.
 */
export function deriveQuotas(vector: TasteVector): DeckQuotas {
  if (vector.decisionCount < MIN_DECISIONS_FOR_TASTE) {
    // DEFAULT_QUOTAS (30/10/10) is the spec-literal default ratio and sums
    // to 50 — but deriveQuotas's contract is the 40 *exploit* slots, with
    // explore's 10 wildcards added on top by the bucket service. Scale the
    // ratio down rather than returning it verbatim, or a cold-start bucket
    // ends up with 50 exploit + 10 explore = 60 items.
    const total = DEFAULT_QUOTAS.movie + DEFAULT_QUOTAS.series + DEFAULT_QUOTAS.anime;
    return {
      movie: Math.round((DEFAULT_QUOTAS.movie / total) * EXPLOIT_SLOTS),
      series: Math.round((DEFAULT_QUOTAS.series / total) * EXPLOIT_SLOTS),
      anime: Math.round((DEFAULT_QUOTAS.anime / total) * EXPLOIT_SLOTS),
    };
  }

  const raw: DeckQuotas = {
    movie: affinityOf(vector.format, 'movie') * affinityOf(vector.classification, 'live_action'),
    series: affinityOf(vector.format, 'series') * affinityOf(vector.classification, 'live_action'),
    anime: affinityOf(vector.classification, 'anime'),
  };

  const keys: (keyof DeckQuotas)[] = ['movie', 'series', 'anime'];
  const total = keys.reduce((sum, k) => sum + raw[k], 0);

  const slots: DeckQuotas = { movie: 0, series: 0, anime: 0 };
  for (const k of keys) {
    const share = total > 0 ? raw[k] / total : 1 / keys.length;
    slots[k] = Math.max(QUOTA_FLOOR, Math.round(share * EXPLOIT_SLOTS));
  }

  let diff = EXPLOIT_SLOTS - keys.reduce((sum, k) => sum + slots[k], 0);
  const byAffinityDesc = [...keys].sort((a, b) => raw[b] - raw[a]);
  let i = 0;
  while (diff !== 0 && i < 1000) {
    const k = byAffinityDesc[i % byAffinityDesc.length];
    if (diff > 0) {
      slots[k]++;
      diff--;
    } else if (slots[k] > QUOTA_FLOOR) {
      slots[k]--;
      diff++;
    }
    i++;
  }

  return slots;
}
