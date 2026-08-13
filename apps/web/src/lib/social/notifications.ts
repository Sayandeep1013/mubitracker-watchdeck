import type { SupabaseClient } from '@supabase/supabase-js';

/** Spec 40 §7: canonical body shape for marking notifications read,
 * shared by the canonical `/notifications/read` route and the deprecated
 * `/notifications` POST alias. */
export async function markNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
  body: { ids?: string[]; all?: boolean },
) {
  const now = new Date().toISOString();

  if (body.all) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
    return;
  }

  if (body.ids?.length) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .in('id', body.ids);
    if (error) throw error;
    return;
  }

  throw new Error('Provide ids or all=true');
}
