import { NextRequest } from 'next/server';
import { updateReviewSchema } from '@mubitracker/shared';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('reviews')
      .select('*, media(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return apiError('DB_ERROR', error.message, 500);
    if (!data) return apiError('NOT_FOUND', 'Review not found', 404);
    return apiOk(toReviewJson(data));
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch review', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = updateReviewSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('reviews')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, media(*)')
      .single();

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk(toReviewJson(data));
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', e instanceof Error ? e.message : 'Invalid request', 400);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from('reviews').delete().eq('id', id).eq('user_id', user.id);
    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk({ deleted: true });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to delete review', 500);
  }
}
