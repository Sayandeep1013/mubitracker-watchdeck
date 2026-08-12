import { NextRequest } from 'next/server';
import { Classification, MediaFormat } from '@watchdeck/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { asDbMedia, toMediaSummary } from '@/lib/media/repository';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function asMediaFormat(value: string | null): MediaFormat | null {
  return value != null && (Object.values(MediaFormat) as string[]).includes(value)
    ? (value as MediaFormat)
    : null;
}

function asClassification(value: string | null): Classification | null {
  return value != null && (Object.values(Classification) as string[]).includes(value)
    ? (value as Classification)
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('page_size') ?? '24', 10), 100);
    const status = searchParams.get('status');
    const reviewStatus = searchParams.get('review_status');
    const format = asMediaFormat(searchParams.get('format'));
    const classification = asClassification(searchParams.get('classification'));
    const sort = searchParams.get('sort') ?? 'recent';
    const q = searchParams.get('q');

    const supabase = createSupabaseAdminClient();
    // `!inner` is required so .eq('media.*')/.ilike('media.*') filters below narrow
    // the joined rows (and the exact `count`) instead of only the top-level user_media rows.
    let query = supabase
      .from('user_media')
      .select('status, review_status, watched_at, media!inner(*)', { count: 'exact' })
      .eq('user_id', user.id);

    if (status) query = query.eq('status', status);
    if (reviewStatus) query = query.eq('review_status', reviewStatus);
    if (format) query = query.eq('media.format', format);
    if (classification) query = query.eq('media.classification', classification);
    if (q) query = query.ilike('media.title', `%${escapeLike(q)}%`);

    if (sort === 'alpha') {
      query = query.order('title', { referencedTable: 'media', ascending: true });
    } else if (sort === 'year') {
      query = query.order('year', { referencedTable: 'media', ascending: false });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    // Filters above are applied server-side before this slice, so the page and
    // `count` both reflect the filtered result set rather than the full collection.
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error) return apiError('DB_ERROR', error.message, 500);

    const items = (data ?? []).map((row) => ({
      ...toMediaSummary(asDbMedia(row.media)),
      status: row.status,
      reviewStatus: row.review_status,
      watchedAt: row.watched_at,
    }));

    return apiOk({ items, total: count ?? items.length, page, pageSize });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to fetch collection', 500);
  }
}
