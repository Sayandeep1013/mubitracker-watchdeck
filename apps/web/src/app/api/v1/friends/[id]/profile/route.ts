import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { getFriendProfile } from '@/lib/social/friends';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();
    const profile = await getFriendProfile(supabase, user.id, id);
    if (!profile) return apiError('NOT_FOUND', 'Profile not found or private', 404);
    return apiOk(profile);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch profile', 500);
  }
}
