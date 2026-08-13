import type { SupabaseClient } from '@supabase/supabase-js';

const IMPRESSION_SUPPRESS_MS = 24 * 60 * 60 * 1000;
const IMPRESSION_PRUNE_MS = 30 * 24 * 60 * 60 * 1000;

/** Shared by both the v1 generate.ts loop and the v2 bucket service — a
 * served-but-unacted title is weak negative signal either way (spec 24 §6). */
export async function getRecentImpressions(
  supabase: SupabaseClient,
  userId: string,
  mediaIds: string[],
): Promise<Set<string>> {
  if (!mediaIds.length) return new Set();
  const { data } = await supabase
    .from('deck_impressions')
    .select('media_id')
    .eq('user_id', userId)
    .in('media_id', mediaIds)
    .gt('shown_at', new Date(Date.now() - IMPRESSION_SUPPRESS_MS).toISOString());
  return new Set((data ?? []).map((r) => r.media_id));
}

export async function recordImpressions(
  supabase: SupabaseClient,
  userId: string,
  mediaIds: string[],
): Promise<void> {
  if (!mediaIds.length) return;
  const now = new Date().toISOString();
  await supabase
    .from('deck_impressions')
    .upsert(
      mediaIds.map((mediaId) => ({ user_id: userId, media_id: mediaId, shown_at: now })),
      { onConflict: 'user_id,media_id' },
    );
  // Opportunistic prune — keeps the table bounded without a cron (Stage 5).
  // Safe alongside the write above: it only targets rows older than 30 days.
  await supabase
    .from('deck_impressions')
    .delete()
    .eq('user_id', userId)
    .lt('shown_at', new Date(Date.now() - IMPRESSION_PRUNE_MS).toISOString());
}
