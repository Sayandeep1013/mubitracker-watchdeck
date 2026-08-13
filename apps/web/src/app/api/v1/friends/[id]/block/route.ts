import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { friendshipInvolvingUserFilter } from '@/lib/social/friends';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'blocked', blocked_by: user.id })
      .eq('id', id)
      .or(friendshipInvolvingUserFilter(user.id))
      .select()
      .single();

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk(data);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Block failed', 500);
  }
}

// Spec 40 §4: unblock is a delete, not a status flip — after unblocking the
// pair returns to "no relationship" so either side can send a fresh request.
// Only the user who did the blocking may undo it.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', id)
      .or(friendshipInvolvingUserFilter(user.id))
      .maybeSingle();

    if (!existing || existing.status !== 'blocked') {
      return apiError('NOT_FOUND', 'Blocked relationship not found', 404);
    }
    if (existing.blocked_by !== user.id) {
      return apiError('FORBIDDEN', 'Only the user who blocked can unblock', 403);
    }

    const { error } = await supabase.from('friendships').delete().eq('id', id);
    if (error) return apiError('DB_ERROR', error.message, 500);

    return apiOk({ deleted: true });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Unblock failed', 500);
  }
}
