import { NextRequest } from 'next/server';
import type { AnalyticsEventName } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const VALID_EVENTS: AnalyticsEventName[] = [
  'deck_batch_served',
  'media_classified',
  'undo_used',
  'deck_empty',
  'filter_applied',
];

/** Fire-and-forget sink (spec 50 §6) — a bad/oversized payload never breaks
 * the caller since both clients' `trackEvent()` swallow every rejection. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    if (!VALID_EVENTS.includes(body?.event)) {
      return apiError('BAD_REQUEST', 'Unknown event', 400);
    }
    if (typeof body.properties !== 'object' || body.properties === null) {
      return apiError('BAD_REQUEST', 'properties must be an object', 400);
    }

    const platform =
      body.properties.platform === 'mobile' || body.properties.platform === 'web'
        ? body.properties.platform
        : (request.headers.get('x-client-platform') ?? 'web');

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from('analytics_events').insert({
      user_id: user.id,
      event: body.event,
      properties: body.properties,
      platform,
      request_id: request.headers.get('x-request-id'),
    });

    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk({ ok: true }, 202);
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', e instanceof Error ? e.message : 'Failed to record event', 500);
  }
}
