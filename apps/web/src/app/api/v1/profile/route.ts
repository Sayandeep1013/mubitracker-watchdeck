import { NextRequest } from 'next/server';
import { updateProfileSchema } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, errorMessage, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/supabase/database.types';
import { friendshipInvolvingUserFilter } from '@/lib/social/friends';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const supabase = createSupabaseAdminClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !profile) return apiError('NOT_FOUND', 'Profile not found', 404);

    const [
      { count: watchedCount },
      { count: unwatchedCount },
      { count: watchLaterCount },
      { count: reviewCount },
      { count: friendsCount },
    ] = await Promise.all([
      supabase
        .from('user_media')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'watched'),
      supabase
        .from('user_media')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'unwatched'),
      supabase
        .from('user_media')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'watch_later'),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(friendshipInvolvingUserFilter(user.id)),
    ]);

    return apiOk({
      id: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      profileVisibility: profile.profile_visibility,
      collectionVisibility: profile.collection_visibility,
      reviewsVisibility: profile.reviews_visibility,
      watchedCount: watchedCount ?? 0,
      unwatchedCount: unwatchedCount ?? 0,
      watchLaterCount: watchLaterCount ?? 0,
      reviewCount: reviewCount ?? 0,
      friendsCount: friendsCount ?? 0,
    });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch profile', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = updateProfileSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const update: TablesUpdate<'profiles'> = {};
    if (body.username) update.username = body.username; // already lowercased by schema
    if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url;
    if (body.profile_visibility) update.profile_visibility = body.profile_visibility;
    if (body.collection_visibility) update.collection_visibility = body.collection_visibility;
    if (body.reviews_visibility) update.reviews_visibility = body.reviews_visibility;

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', user.id)
      .select()
      .single();

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk(data);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', errorMessage(e, 'Invalid request'), 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const supabase = createSupabaseAdminClient();
    await supabase.from('user_media').delete().eq('user_id', user.id);
    await supabase.from('reviews').delete().eq('user_id', user.id);
    await supabase.from('friendships').delete().or(friendshipInvolvingUserFilter(user.id));
    await supabase.from('filter_presets').delete().eq('user_id', user.id);
    await supabase
      .from('recommendations')
      .delete()
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.auth.admin.deleteUser(user.id);
    return apiOk({ deleted: true });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to delete account', 500);
  }
}
