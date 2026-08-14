import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkContentFilter,
  getDisplayType,
  type MediaSummary,
  type NormalizedMedia,
  type ReviewStatus,
  type WatchStatus,
} from '@mubitracker/shared';
import { nextCooldownState } from '@/lib/deck/cooldown';

export class RejectedContentError extends Error {
  constructor(reason: string) {
    super(`Rejected by content filter: ${reason}`);
    this.name = 'RejectedContentError';
  }
}

export interface DbMedia {
  id: string;
  format: string;
  classification: string;
  title: string;
  original_title: string;
  overview: string;
  year: number | null;
  original_language: string;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
}

export function asDbMedia(value: unknown): DbMedia {
  return value as DbMedia;
}

export function toMediaSummary(row: DbMedia): MediaSummary {
  return {
    id: row.id,
    format: row.format as MediaSummary['format'],
    classification: row.classification as MediaSummary['classification'],
    title: row.title,
    originalTitle: row.original_title,
    overview: row.overview,
    year: row.year,
    originalLanguage: row.original_language,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    runtime: row.runtime,
    displayType: getDisplayType(
      row.format as MediaSummary['format'],
      row.classification as MediaSummary['classification'],
    ),
    // Empty until a caller opts in via attachGenreNames() below — most
    // routes don't need genre names, so this isn't fetched by default.
    genres: [],
  };
}

/**
 * Batch-attaches genre names onto already-built MediaSummary/DeckItem
 * objects, via one extra `media_genres` query (not a join on the primary
 * `media` select, so every existing call site keeps working unchanged).
 * `genres` table holds TMDB's own authoritative genre id/name pairs
 * (seeded by the corpus ingestion script), which is what `media_genres`
 * links reference — deliberately NOT the same as shared/constants/genres.ts'
 * GENRE_MAP (that's a movie-only, hand-picked subset used only for
 * building TMDB discover query params, not a source of truth for display).
 */
export async function attachGenreNames<T extends MediaSummary>(
  supabase: SupabaseClient,
  items: T[],
): Promise<T[]> {
  if (items.length === 0) return items;
  const ids = items.map((item) => item.id);
  const { data, error } = await supabase
    .from('media_genres')
    .select('media_id, genres(name)')
    .in('media_id', ids);
  if (error || !data) return items;

  const byMedia = new Map<string, string[]>();
  for (const row of data as { media_id: string; genres: { name: string } | { name: string }[] | null }[]) {
    const genreRow = row.genres;
    const name = Array.isArray(genreRow) ? genreRow[0]?.name : genreRow?.name;
    if (!name) continue;
    const list = byMedia.get(row.media_id) ?? [];
    list.push(name);
    byMedia.set(row.media_id, list);
  }

  return items.map((item) => ({ ...item, genres: byMedia.get(item.id) ?? [] }));
}

/**
 * Inserts each (media_id, genre_id) link as its own statement so a genre id
 * that violates the FK (e.g. a TMDB id not yet seeded into `genres`) only
 * drops that one link, not every genre for the title.
 */
async function linkGenres(
  supabase: SupabaseClient,
  mediaId: string,
  genreIds: number[],
): Promise<void> {
  await Promise.all(
    genreIds.map((genreId) =>
      supabase
        .from('media_genres')
        .upsert({ media_id: mediaId, genre_id: genreId }, { onConflict: 'media_id,genre_id' }),
    ),
  );
}

async function refreshMediaMetadata(
  supabase: SupabaseClient,
  mediaId: string,
  normalized: NormalizedMedia,
): Promise<DbMedia> {
  const { data: updated, error } = await supabase
    .from('media')
    .update({
      title: normalized.title,
      original_title: normalized.originalTitle,
      overview: normalized.overview,
      release_date: normalized.releaseDate,
      year: normalized.year,
      poster_path: normalized.posterPath,
      backdrop_path: normalized.backdropPath,
      runtime: normalized.runtime,
      popularity: normalized.popularity,
      adult: normalized.adult,
      vote_count: normalized.voteCount,
    })
    .eq('id', mediaId)
    .select()
    .single();

  if (error || !updated) throw new Error(error?.message ?? 'Failed to refresh media');

  if (normalized.genreIds.length > 0) {
    await linkGenres(supabase, mediaId, normalized.genreIds);
  }

  return updated as DbMedia;
}

export async function upsertMedia(
  supabase: SupabaseClient,
  normalized: NormalizedMedia,
): Promise<MediaSummary> {
  // Checked before the existing/new branch below so a title that was
  // wrongly seeded before this filter existed also gets excluded the next
  // time deck/search re-discovers it — without touching (or deleting) the
  // row, so any user_media a person already recorded against it survives.
  const filterResult = checkContentFilter({
    title: normalized.title,
    overview: normalized.overview,
    adult: normalized.adult,
    voteCount: normalized.voteCount,
    genreIds: normalized.genreIds,
  });
  if (filterResult.rejected) {
    throw new RejectedContentError(filterResult.reason ?? 'unknown');
  }

  const { data: existing } = await supabase
    .from('media_external_ids')
    .select('media_id')
    .eq('provider', normalized.provider)
    .eq('external_id', normalized.providerId)
    .maybeSingle();

  if (existing?.media_id) {
    const updated = await refreshMediaMetadata(supabase, existing.media_id, normalized);
    return toMediaSummary(updated);
  }

  const { data: inserted, error } = await supabase
    .from('media')
    .insert({
      format: normalized.format,
      classification: normalized.classification,
      title: normalized.title,
      original_title: normalized.originalTitle,
      overview: normalized.overview,
      release_date: normalized.releaseDate,
      year: normalized.year,
      original_language: normalized.originalLanguage,
      poster_path: normalized.posterPath,
      backdrop_path: normalized.backdropPath,
      runtime: normalized.runtime,
      popularity: normalized.popularity,
      adult: normalized.adult,
      vote_count: normalized.voteCount,
    })
    .select()
    .single();

  if (error || !inserted) throw new Error(error?.message ?? 'Failed to insert media');

  // Claim the external-id link. Two concurrent upserts for the same new
  // title can both reach this point after both missing the lookup above —
  // `on conflict do nothing` lets exactly one of them win the link.
  const { data: linked, error: linkError } = await supabase
    .from('media_external_ids')
    .upsert(
      { media_id: inserted.id, provider: normalized.provider, external_id: normalized.providerId },
      { onConflict: 'provider,external_id', ignoreDuplicates: true },
    )
    .select('media_id')
    .maybeSingle();

  if (linkError) throw new Error(linkError.message);

  if (!linked) {
    // Lost the race — another request's row already owns this external id.
    // Discard our orphan insert and refresh the winner's metadata instead.
    await supabase.from('media').delete().eq('id', inserted.id);
    const { data: winner } = await supabase
      .from('media_external_ids')
      .select('media_id')
      .eq('provider', normalized.provider)
      .eq('external_id', normalized.providerId)
      .single();
    const updated = await refreshMediaMetadata(supabase, winner!.media_id, normalized);
    return toMediaSummary(updated);
  }

  if (normalized.genreIds.length > 0) {
    await linkGenres(supabase, inserted.id, normalized.genreIds);
  }

  return toMediaSummary(inserted as DbMedia);
}

/**
 * One rejected/failed item (e.g. content filter, a transient FK issue)
 * must not sink the whole discover/search page — each item settles
 * independently and only the successes are returned.
 */
export async function upsertMediaBatch(
  supabase: SupabaseClient,
  items: NormalizedMedia[],
): Promise<MediaSummary[]> {
  const settled = await Promise.allSettled(items.map((item) => upsertMedia(supabase, item)));
  return settled
    .filter((r): r is PromiseFulfilledResult<MediaSummary> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function getMediaById(
  supabase: SupabaseClient,
  id: string,
): Promise<MediaSummary | null> {
  const { data } = await supabase.from('media').select('*').eq('id', id).maybeSingle();
  return data ? toMediaSummary(data as DbMedia) : null;
}

export async function getExternalId(
  supabase: SupabaseClient,
  mediaId: string,
  provider = 'tmdb',
): Promise<string | null> {
  const { data } = await supabase
    .from('media_external_ids')
    .select('external_id')
    .eq('media_id', mediaId)
    .eq('provider', provider)
    .maybeSingle();
  return data?.external_id ?? null;
}

export interface CooldownOverride {
  rejectCount: number;
  hiddenUntil: string | null;
}

/**
 * `cooldownOverride` restores exact prior reject_count/hidden_until values
 * (undo, import) instead of deriving them from `status` (spec 24 §5) — pass
 * it whenever the caller already knows the target state rather than is
 * reacting to a fresh classification.
 */
export async function upsertUserMedia(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string,
  status: WatchStatus,
  reviewStatus?: ReviewStatus,
  cooldownOverride?: CooldownOverride,
) {
  const { data: existing } = await supabase
    .from('user_media')
    .select('*')
    .eq('user_id', userId)
    .eq('media_id', mediaId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    user_id: userId,
    media_id: mediaId,
    status,
    updated_at: new Date().toISOString(),
  };

  if (reviewStatus !== undefined) payload.review_status = reviewStatus;

  if (status === 'watched' && !existing?.watched_at) {
    payload.watched_at = new Date().toISOString();
  }

  const cooldown =
    cooldownOverride ??
    nextCooldownState(status, {
      rejectCount: existing?.reject_count ?? 0,
      hiddenUntil: existing?.hidden_until ?? null,
    });
  payload.reject_count = cooldown.rejectCount;
  payload.hidden_until = cooldown.hiddenUntil;

  const { data, error } = await supabase
    .from('user_media')
    .upsert(payload, { onConflict: 'user_id,media_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
