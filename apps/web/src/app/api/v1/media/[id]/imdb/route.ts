import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { getExternalId, getMediaById } from '@/lib/media/repository';
import { tmdbGetExternalIds } from '@/lib/tmdb/provider';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

function imdbUrl(imdbId: string): string {
  return `https://www.imdb.com/title/${imdbId}/`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const cachedImdbId = await getExternalId(supabase, id, 'imdb');
    if (cachedImdbId) return apiOk({ imdbId: cachedImdbId, imdbUrl: imdbUrl(cachedImdbId) });

    const media = await getMediaById(supabase, id);
    if (!media) return apiError('NOT_FOUND', 'Media not found', 404);

    const tmdbId = await getExternalId(supabase, id, 'tmdb');
    if (!tmdbId) return apiOk({ imdbId: null, imdbUrl: null });

    const { imdbId } = await tmdbGetExternalIds(tmdbId, media.format);
    if (imdbId) {
      await supabase
        .from('media_external_ids')
        .insert({ media_id: id, provider: 'imdb', external_id: imdbId });
    }

    return apiOk({ imdbId, imdbUrl: imdbId ? imdbUrl(imdbId) : null });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch IMDb link', 500);
  }
}
