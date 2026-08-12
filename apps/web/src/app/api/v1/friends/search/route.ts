import { NextRequest } from 'next/server';
import { normalizeUsername } from '@watchdeck/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { friendshipInvolvingUserFilter } from '@/lib/social/friends';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return apiError('BAD_REQUEST', 'Query must be at least 2 characters', 400);

    const limit = Math.min(
      parseInt(new URL(request.url).searchParams.get('limit') ?? '10', 10),
      20,
    );
    const supabase = createSupabaseAdminClient();
    const prefix = normalizeUsername(q);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, profile_visibility')
      .eq('profile_visibility', 'public')
      .ilike('username', `${prefix}%`)
      .neq('id', user.id)
      .limit(limit);

    if (error) return apiError('DB_ERROR', error.message, 500);

    const { data: relations } = await supabase
      .from('friendships')
      .select('requester_id, receiver_id, status')
      .or(friendshipInvolvingUserFilter(user.id));

    const excluded = new Set<string>();
    for (const r of relations ?? []) {
      const other = r.requester_id === user.id ? r.receiver_id : r.requester_id;
      if (r.status === 'accepted' || r.status === 'blocked' || r.status === 'pending') {
        excluded.add(other);
      }
    }

    const results = (profiles ?? [])
      .filter((p) => !excluded.has(p.id))
      .map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatar_url }));

    return apiOk({ results });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Search failed', 500);
  }
}
