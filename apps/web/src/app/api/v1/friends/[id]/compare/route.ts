import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { compareCollections } from '@/lib/social/friends';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id: friendId } = await params;
    const supabase = createSupabaseAdminClient();
    const comparison = await compareCollections(supabase, user.id, friendId);
    return apiOk(comparison);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    if (e instanceof Error && e.message.includes('Cannot view')) {
      return apiError('FORBIDDEN', e.message, 403);
    }
    return apiError('INTERNAL', 'Comparison failed', 500);
  }
}
