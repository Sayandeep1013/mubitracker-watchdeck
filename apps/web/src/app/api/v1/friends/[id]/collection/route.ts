import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { asDbMedia, toMediaSummary } from '@/lib/media/repository';
import { canViewCollection } from '@/lib/social/friends';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id: friendId } = await params;
    const supabase = createSupabaseAdminClient();

    const allowed = await canViewCollection(supabase, user.id, friendId);
    if (!allowed) return apiError('FORBIDDEN', 'Collection is private', 403);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'watched';

    const { data, error } = await supabase
      .from('user_media')
      .select('status, review_status, watched_at, media(*)')
      .eq('user_id', friendId)
      .eq('status', status);

    if (error) return apiError('DB_ERROR', error.message, 500);

    const items = (data ?? []).map((row) => ({
      ...toMediaSummary(asDbMedia(row.media)),
      status: row.status,
      reviewStatus: row.review_status,
      watchedAt: row.watched_at,
    }));

    return apiOk({ items, total: items.length, page: 1, pageSize: items.length });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch collection', 500);
  }
}
