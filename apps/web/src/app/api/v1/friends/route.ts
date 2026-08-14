import { NextRequest } from 'next/server';
import { friendRequestSchema, normalizeUsername } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, errorMessage, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { friendshipInvolvingUserFilter, friendshipPairFilter } from '@/lib/social/friends';

async function enrichFriendship(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  f: {
    id: string;
    requester_id: string;
    receiver_id: string;
    status: string;
    blocked_by?: string | null;
  },
  userId: string,
) {
  const friendId = f.requester_id === userId ? f.receiver_id : f.requester_id;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', friendId)
    .single();
  return {
    id: f.id,
    requesterId: f.requester_id,
    receiverId: f.receiver_id,
    status: f.status,
    blockedBy: f.blocked_by ?? null,
    direction: f.requester_id === userId ? 'outgoing' : 'incoming',
    friend: profile
      ? { id: profile.id, username: profile.username, avatarUrl: profile.avatar_url }
      : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // accepted | pending_in | pending_out | all
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('friendships')
      .select('*')
      .or(friendshipInvolvingUserFilter(user.id));

    if (status === 'accepted') {
      query = query.eq('status', 'accepted');
    } else if (status === 'pending_in') {
      query = query.eq('status', 'pending').eq('receiver_id', user.id);
    } else if (status === 'pending_out') {
      query = query.eq('status', 'pending').eq('requester_id', user.id);
    } else if (status === 'blocked') {
      query = query.eq('status', 'blocked');
    } else {
      query = query.neq('status', 'blocked');
    }

    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) return apiError('DB_ERROR', error.message, 500);

    const friendships = await Promise.all(
      (data ?? []).map((f) => enrichFriendship(supabase, f, user.id)),
    );

    return apiOk(friendships);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch friends', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = friendRequestSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    let targetId = body.user_id;
    if (body.username) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', normalizeUsername(body.username))
        .maybeSingle();
      if (!profile) return apiError('NOT_FOUND', 'User not found', 404);
      targetId = profile.id;
    }

    if (!targetId || targetId === user.id) {
      return apiError('BAD_REQUEST', 'Invalid friend request', 400);
    }

    // Load any existing row for this pair, in either direction, and branch
    // on its status. Previously this only checked for 'blocked' and a
    // reverse-'pending' row — an existing reverse-'accepted' row fell
    // through to the insert below and created a second row for the same
    // pair (spec 40 §6), since UNIQUE(requester_id, receiver_id) only
    // protects one direction.
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(friendshipPairFilter(user.id, targetId))
      .maybeSingle();

    if (existing?.status === 'blocked') {
      return apiError('FORBIDDEN', 'Cannot send request to this user', 403);
    }

    if (existing?.status === 'accepted') {
      return apiError('ALREADY_FRIENDS', 'You are already friends', 409);
    }

    if (existing?.status === 'pending') {
      if (existing.requester_id === user.id) {
        return apiError('REQUEST_PENDING', 'Request already sent', 409);
      }
      // Reverse pending → auto-accept.
      const { data: accepted, error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return apiError('DB_ERROR', error.message, 500);

      await supabase.from('notifications').insert([
        {
          user_id: targetId,
          type: 'friend_accepted',
          actor_id: user.id,
          friendship_id: accepted.id,
        },
      ]);

      return apiOk(await enrichFriendship(supabase, accepted, user.id));
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        receiver_id: targetId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return apiError('CONFLICT', 'Request already exists', 409);
      return apiError('DB_ERROR', error.message, 500);
    }

    await supabase.from('notifications').insert({
      user_id: targetId,
      type: 'friend_request',
      actor_id: user.id,
      friendship_id: data.id,
    });

    return apiOk(await enrichFriendship(supabase, data, user.id), 201);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', errorMessage(e, 'Invalid request'), 400);
  }
}
