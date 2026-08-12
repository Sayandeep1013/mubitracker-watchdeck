import { NextRequest } from 'next/server';
import { undoSchema } from '@watchdeck/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { upsertUserMedia } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = undoSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const data = await upsertUserMedia(
      supabase,
      user.id,
      body.media_id,
      body.previous_status,
      body.previous_review_status,
    );
    return apiOk(data);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', e instanceof Error ? e.message : 'Invalid request', 400);
  }
}
