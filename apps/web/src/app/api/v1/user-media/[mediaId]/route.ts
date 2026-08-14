import { NextRequest } from 'next/server';
import { updateUserMediaSchema } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, errorMessage, requireAuth } from '@/lib/api/helpers';
import { upsertUserMedia } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { mediaId } = await params;
    const body = updateUserMediaSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const data = await upsertUserMedia(
      supabase,
      user.id,
      mediaId,
      body.status,
      body.review_status,
    );

    return apiOk(data);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', errorMessage(e, 'Invalid request'), 400);
  }
}
