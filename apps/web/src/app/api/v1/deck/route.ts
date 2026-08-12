import { NextRequest } from 'next/server';
import { DECK_BATCH_SIZE } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { generateDeck, parseDeckFilters } from '@/lib/deck/generate';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? String(DECK_BATCH_SIZE), 10), 50);
    const cursor = searchParams.get('cursor');
    const sessionId = searchParams.get('session_id') ?? undefined;
    const filters = parseDeckFilters(searchParams);

    const supabase = createSupabaseAdminClient();
    const result = await generateDeck(supabase, user.id, filters, limit, cursor, sessionId);

    return apiOk({
      items: result.items,
      cursor: result.cursor,
      sessionId: result.sessionId,
      message: result.message,
    });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', e instanceof Error ? e.message : 'Deck generation failed', 500);
  }
}
