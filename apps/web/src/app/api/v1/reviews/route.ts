import { NextRequest } from 'next/server';
import { createReviewSchema } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { asDbMedia, toMediaSummary } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

function toReviewJson(row: {
  id: string;
  user_id: string;
  media_id: string;
  body: string;
  is_spoiler: boolean;
  visibility: string;
  created_at: string;
  updated_at: string;
  media?: unknown;
}) {
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    body: row.body,
    isSpoiler: row.is_spoiler,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: row.media ? toMediaSummary(asDbMedia(row.media)) : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('*, media(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk({ reviews: (data ?? []).map(toReviewJson) });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch reviews', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = createReviewSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('reviews')
      .upsert(
        {
          user_id: user.id,
          media_id: body.media_id,
          body: body.body,
          is_spoiler: body.is_spoiler,
          visibility: body.visibility,
        },
        { onConflict: 'user_id,media_id' },
      )
      .select()
      .single();

    if (error) return apiError('DB_ERROR', error.message, 500);

    await supabase
      .from('user_media')
      .upsert(
        {
          user_id: user.id,
          media_id: body.media_id,
          status: 'watched',
          review_status: 'written',
          watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,media_id' },
      );

    return apiOk(toReviewJson(data), 201);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', e instanceof Error ? e.message : 'Invalid request', 400);
  }
}
