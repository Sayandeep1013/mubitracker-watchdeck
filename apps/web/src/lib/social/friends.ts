import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionComparison, MediaSummary, Profile } from '@watchdeck/shared';
import { asDbMedia, toMediaSummary } from '@/lib/media/repository';

/** PostgREST `.or()` filter matching an accepted/blocked/etc. friendship between these two specific users, in either direction. */
export function friendshipPairFilter(userA: string, userB: string): string {
  return `and(requester_id.eq.${userA},receiver_id.eq.${userB}),and(requester_id.eq.${userB},receiver_id.eq.${userA})`;
}

/** PostgREST `.or()` filter matching any friendship row involving this user, as requester or receiver. */
export function friendshipInvolvingUserFilter(userId: string): string {
  return `requester_id.eq.${userId},receiver_id.eq.${userId}`;
}

export async function canViewCollection(
  supabase: SupabaseClient,
  viewerId: string,
  ownerId: string,
): Promise<boolean> {
  if (viewerId === ownerId) return true;

  const { data: profile } = await supabase
    .from('profiles')
    .select('collection_visibility')
    .eq('id', ownerId)
    .single();

  if (!profile) return false;
  if (profile.collection_visibility === 'public') return true;
  if (profile.collection_visibility === 'private') return false;

  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(friendshipPairFilter(viewerId, ownerId))
    .maybeSingle();

  return !!friendship;
}

export async function compareCollections(
  supabase: SupabaseClient,
  userId: string,
  friendId: string,
): Promise<CollectionComparison> {
  const canView = await canViewCollection(supabase, userId, friendId);
  if (!canView) {
    throw new Error('Cannot view friend collection');
  }

  const { data: myWatched } = await supabase
    .from('user_media')
    .select('media_id, media(*)')
    .eq('user_id', userId)
    .eq('status', 'watched');

  const { data: friendWatched } = await supabase
    .from('user_media')
    .select('media_id, media(*)')
    .eq('user_id', friendId)
    .eq('status', 'watched');

  const myIds = new Set((myWatched ?? []).map((r) => r.media_id));
  const friendIds = new Set((friendWatched ?? []).map((r) => r.media_id));

  const bothIds = [...myIds].filter((id) => friendIds.has(id));
  const friendOnlyIds = [...friendIds].filter((id) => !myIds.has(id));

  const friendOnlyItems: MediaSummary[] = (friendWatched ?? [])
    .filter((r) => friendOnlyIds.includes(r.media_id))
    .map((r) => toMediaSummary(asDbMedia(r.media)));

  const bothItems: MediaSummary[] = (myWatched ?? [])
    .filter((r) => bothIds.includes(r.media_id))
    .map((r) => toMediaSummary(asDbMedia(r.media)));

  return {
    bothWatched: bothIds.length,
    youOnly: [...myIds].filter((id) => !friendIds.has(id)).length,
    friendOnly: friendOnlyIds.length,
    bothWatchedItems: bothItems,
    friendOnlyItems: friendOnlyItems.slice(0, 50),
  };
}

export async function getFriendProfile(
  supabase: SupabaseClient,
  viewerId: string,
  friendId: string,
): Promise<Profile | null> {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', friendId).single();
  if (!profile) return null;

  if (profile.profile_visibility === 'private' && viewerId !== friendId) {
    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(friendshipPairFilter(viewerId, friendId))
      .maybeSingle();
    if (!friendship) return null;
  }

  const [{ count: watchedCount }, { count: reviewCount }] = await Promise.all([
    supabase
      .from('user_media')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', friendId)
      .eq('status', 'watched'),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', friendId),
  ]);

  return {
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatar_url,
    profileVisibility: profile.profile_visibility,
    collectionVisibility: profile.collection_visibility,
    reviewsVisibility: profile.reviews_visibility,
    watchedCount: watchedCount ?? 0,
    reviewCount: reviewCount ?? 0,
  };
}
