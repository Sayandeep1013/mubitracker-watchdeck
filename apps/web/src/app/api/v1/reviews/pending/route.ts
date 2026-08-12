import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { asDbMedia, toMediaSummary } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_media')
      .select('review_status, media(*)')
      .eq('user_id', user.id)
      .eq('review_status', 'pending');

    if (error) return apiError('DB_ERROR', error.message, 500);

    const items = (data ?? []).map((row) => ({
      ...toMediaSummary(asDbMedia(row.media)),
      reviewStatus: row.review_status,
    }));

    return apiOk(items);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch pending reviews', 500);
  }
}
