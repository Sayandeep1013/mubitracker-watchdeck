import { NextRequest } from 'next/server';
import { updateReviewSchema } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

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
      .select()
      .single();

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk(data);
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
