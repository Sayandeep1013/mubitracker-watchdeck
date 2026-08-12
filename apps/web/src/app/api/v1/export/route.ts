import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { getExternalId, asDbMedia } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const supabase = createSupabaseAdminClient();

    const { data: userMedia } = await supabase
      .from('user_media')
      .select('status, review_status, watched_at, media_id, media(*)')
      .eq('user_id', user.id);

    const { data: reviews } = await supabase.from('reviews').select('*').eq('user_id', user.id);
    const reviewMap = new Map((reviews ?? []).map((r) => [r.media_id, r]));

    const media = await Promise.all(
      (userMedia ?? []).map(async (row) => {
        const m = asDbMedia(row.media);
        const providerId = await getExternalId(supabase, row.media_id);
        const review = reviewMap.get(row.media_id);
        return {
          provider: 'tmdb',
          provider_id: providerId ?? '',
          title: m.title,
          format: m.format,
          classification: m.classification,
          status: row.status,
          review_status: row.review_status,
          watched_at: row.watched_at,
          review: review
            ? { body: review.body, is_spoiler: review.is_spoiler }
            : null,
        };
      }),
    );

    return apiOk({
      export_version: 1,
      exported_at: new Date().toISOString(),
      media,
    });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Export failed', 500);
  }
}
