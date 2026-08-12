import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { getMediaById } from '@/lib/media/repository';
import { tmdbSearch } from '@/lib/tmdb/provider';
import { upsertMediaBatch } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    void user;
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    if (!q?.trim()) return apiError('BAD_REQUEST', 'Query required', 400);

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const supabase = createSupabaseAdminClient();

    let results;
    try {
      const tmdbResults = await tmdbSearch(q.trim(), limit);
      results = await upsertMediaBatch(supabase, tmdbResults);
    } catch {
      return apiError('TMDB_UNAVAILABLE', 'Search temporarily unavailable', 503);
    }

    return apiOk({ results, total: results.length });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Search failed', 500);
  }
}

export async function GET_MEDIA(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();
    const media = await getMediaById(supabase, id);
    if (!media) return apiError('NOT_FOUND', 'Media not found', 404);
    return apiOk(media);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch media', 500);
  }
}
