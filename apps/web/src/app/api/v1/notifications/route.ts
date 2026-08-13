import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { markNotificationsRead } from '@/lib/social/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const unreadOnly = new URL(request.url).searchParams.get('unread') === '1';
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(id, username, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) query = query.is('read_at', null);

    const { data, error } = await query;
    if (error) return apiError('DB_ERROR', error.message, 500);

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);

    return apiOk({
      unreadCount: count ?? 0,
      items: (data ?? []).map((n) => ({
        id: n.id,
        type: n.type,
        friendshipId: n.friendship_id,
        readAt: n.read_at,
        createdAt: n.created_at,
        actor: n.actor
          ? {
              id: (n.actor as { id: string }).id,
              username: (n.actor as { username: string }).username,
              avatarUrl: (n.actor as { avatar_url: string | null }).avatar_url,
            }
          : null,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch notifications', 500);
  }
}

/** @deprecated Use POST /api/v1/notifications/read (spec 40 §7). Kept as
 * an alias for one release — same body shape, same behavior. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json()) as { ids?: string[]; all?: boolean };
    const supabase = createSupabaseAdminClient();
    await markNotificationsRead(supabase, user.id, body);
    return apiOk({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', e instanceof Error ? e.message : 'Invalid request', 400);
  }
}
