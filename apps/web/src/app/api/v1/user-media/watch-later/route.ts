import { NextRequest } from 'next/server';
import { watchLaterSchema } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, errorMessage, requireAuth } from '@/lib/api/helpers';
import { asDbMedia, toMediaSummary, upsertUserMedia } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = watchLaterSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const data = await upsertUserMedia(
      supabase,
      user.id,
      body.media_id,
      'watch_later',
      'none',
    );
    return apiOk(data);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', errorMessage(e, 'Invalid request'), 400);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_media')
      .select('status, review_status, media(*)')
      .eq('user_id', user.id)
      .eq('status', 'watch_later')
      .order('updated_at', { ascending: false });

    if (error) return apiError('DB_ERROR', error.message, 500);

    const items = (data ?? []).map((row) => ({
      ...toMediaSummary(asDbMedia(row.media)),
      status: row.status,
      reviewStatus: row.review_status,
    }));

    return apiOk(items);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch watch later', 500);
  }
}
