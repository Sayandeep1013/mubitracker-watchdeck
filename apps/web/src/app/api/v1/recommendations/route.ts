import { NextRequest } from 'next/server';
import { recommendationSchema } from '@watchdeck/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { friendshipPairFilter } from '@/lib/social/friends';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('recommendations')
      .select('*, media(*), sender:profiles!sender_id(id, username, avatar_url)')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk(data ?? []);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch recommendations', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = recommendationSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(friendshipPairFilter(user.id, body.receiver_id))
      .maybeSingle();

    if (!friendship) return apiError('FORBIDDEN', 'Must be friends to recommend', 403);

    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        sender_id: user.id,
        receiver_id: body.receiver_id,
        media_id: body.media_id,
        message: body.message ?? null,
      })
      .select()
      .single();

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk(data, 201);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', e instanceof Error ? e.message : 'Invalid request', 400);
  }
}
