import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { markNotificationsRead } from '@/lib/social/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/** Canonical endpoint per spec 12 §6 / 40 §7. `POST /api/v1/notifications`
 * remains as a deprecated alias for one release. */
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
