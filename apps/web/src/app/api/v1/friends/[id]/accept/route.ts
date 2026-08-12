import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(
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
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (!existing) return apiError('NOT_FOUND', 'Request not found', 404);

    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', id)
      .select()
      .single();

    if (error) return apiError('DB_ERROR', error.message, 500);

    await supabase.from('notifications').insert({
      user_id: existing.requester_id,
      type: 'friend_accepted',
      actor_id: user.id,
      friendship_id: data.id,
    });

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('friendship_id', id)
      .eq('user_id', user.id)
      .is('read_at', null);

    return apiOk(data);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Accept failed', 500);
  }
}
