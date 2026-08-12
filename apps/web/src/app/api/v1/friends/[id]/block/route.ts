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
      .update({ status: 'blocked' })
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
