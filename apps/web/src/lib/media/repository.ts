import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getDisplayType,
  type MediaSummary,
  type NormalizedMedia,
  type ReviewStatus,
  type WatchStatus,
} from '@mubitracker/shared';

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
  };
}

export async function upsertMedia(
  supabase: SupabaseClient,
  normalized: NormalizedMedia,
): Promise<MediaSummary> {
  const { data: existing } = await supabase
    .from('media_external_ids')
    .select('media_id, media(*)')
    .eq('provider', normalized.provider)
    .eq('external_id', normalized.providerId)
    .maybeSingle();

  if (existing?.media) {
    const m = existing.media as unknown as DbMedia;
    return toMediaSummary(m);
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
    })
    .select()
    .single();

  if (error || !inserted) throw new Error(error?.message ?? 'Failed to insert media');

  await supabase.from('media_external_ids').insert({
    media_id: inserted.id,
    provider: normalized.provider,
    external_id: normalized.providerId,
  });

  if (normalized.genreIds.length > 0) {
    await supabase.from('media_genres').upsert(
      normalized.genreIds.map((genreId) => ({ media_id: inserted.id, genre_id: genreId })),
      { onConflict: 'media_id,genre_id' },
    );
  }

  return toMediaSummary(inserted as DbMedia);
}

export async function upsertMediaBatch(
  supabase: SupabaseClient,
  items: NormalizedMedia[],
): Promise<MediaSummary[]> {
  return Promise.all(items.map((item) => upsertMedia(supabase, item)));
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

export async function upsertUserMedia(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string,
  status: WatchStatus,
  reviewStatus?: ReviewStatus,
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

  const { data, error } = await supabase
    .from('user_media')
    .upsert(payload, { onConflict: 'user_id,media_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
