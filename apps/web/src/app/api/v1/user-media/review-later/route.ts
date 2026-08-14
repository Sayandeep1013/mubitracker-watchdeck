import { NextRequest } from 'next/server';
import { reviewLaterSchema } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, errorMessage, requireAuth } from '@/lib/api/helpers';
import { upsertUserMedia } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = reviewLaterSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const data = await upsertUserMedia(
      supabase,
      user.id,
      body.media_id,
      'watched',
      'pending',
    );
    return apiOk(data);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', errorMessage(e, 'Invalid request'), 400);
  }
}
