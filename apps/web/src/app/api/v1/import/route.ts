import { NextRequest } from 'next/server';
import { importSchema } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, errorMessage, requireAuth } from '@/lib/api/helpers';
import { upsertMedia, upsertUserMedia } from '@/lib/media/repository';
import { tmdbGetDetails } from '@/lib/tmdb/provider';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = importSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of body.media) {
      try {
        let mediaId: string;
        const { data: existing } = await supabase
          .from('media_external_ids')
          .select('media_id')
          .eq('provider', item.provider)
          .eq('external_id', item.provider_id)
          .maybeSingle();

        if (existing) {
          mediaId = existing.media_id;
        } else if (item.provider === 'tmdb') {
          const format = item.format === 'movie' ? 'movie' : 'series';
          const normalized = await tmdbGetDetails(item.provider_id, format);
          const media = await upsertMedia(supabase, normalized);
          mediaId = media.id;
        } else {
          skipped++;
          continue;
        }

        await upsertUserMedia(
          supabase,
          user.id,
          mediaId,
          item.status,
          item.review_status,
        );

        if (item.review) {
          await supabase.from('reviews').upsert(
            {
              user_id: user.id,
              media_id: mediaId,
              body: item.review.body,
              is_spoiler: item.review.is_spoiler,
            },
            { onConflict: 'user_id,media_id' },
          );
        }

        imported++;
      } catch (e) {
        errors.push(`${item.title}: ${errorMessage(e, 'failed')}`);
        skipped++;
      }
    }

    return apiOk({ imported, skipped, errors });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('BAD_REQUEST', errorMessage(e, 'Invalid import'), 400);
  }
}
