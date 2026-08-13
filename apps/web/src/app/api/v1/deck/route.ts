import { NextRequest } from 'next/server';
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DECK_BATCH_SIZE } from '@mubitracker/shared';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { generateDeck, parseDeckFilters, type ParsedDeckFilters } from '@/lib/deck/generate';
import {
  buildBucket,
  computeFilterHash,
  getBucketById,
  getReadyBucket,
  markServing,
  releaseBuildLock,
  supportsBucketAlgorithm,
  tryAcquireBuildLock,
} from '@/lib/deck/bucket-service';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/** Ships behind a flag (spec 20 §10): v1 stays the production default until
 * v2 has served a full week without a deck_empty event. Flip via env var,
 * not a code change — rollback is just unsetting it. */
const DECK_ENGINE_V2 = process.env.DECK_ENGINE === 'v2';

// Bounded wait for a concurrent in-flight build (spec 23 §6's "advisory
// lock holds" — losers wait for the winner rather than building twice).
// 15x300ms comfortably covers a normal build; only a genuinely stuck/
// crashed lock-holder (caught separately by the 60s staleness reclaim in
// tryAcquireBuildLock) falls through to the fail-open build below.
const BUILD_WAIT_RETRIES = 15;
const BUILD_WAIT_MS = 300;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const filters = parseDeckFilters(searchParams);
    const supabase = createSupabaseAdminClient();

    if (DECK_ENGINE_V2 && supportsBucketAlgorithm(filters)) {
      return await serveBucket(supabase, user.id, filters, searchParams);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') ?? String(DECK_BATCH_SIZE), 10), 50);
    const cursor = searchParams.get('cursor');
    const sessionId = searchParams.get('session_id') ?? undefined;
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

async function serveBucket(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedDeckFilters,
  searchParams: URLSearchParams,
) {
  const filterHash = computeFilterHash(filters);
  const bucketIdParam = searchParams.get('bucket');

  let bucket = bucketIdParam ? await getBucketById(supabase, userId, bucketIdParam) : null;
  if (!bucket) bucket = await getReadyBucket(supabase, userId, filterHash);

  if (!bucket) {
    const acquired = await tryAcquireBuildLock(supabase, userId, filterHash);
    if (acquired) {
      try {
        // Re-check: another request may have finished building while we
        // were checking the lock.
        bucket = await getReadyBucket(supabase, userId, filterHash);
        if (!bucket) bucket = await buildBucket(supabase, userId, filters);
      } finally {
        await releaseBuildLock(supabase, userId, filterHash);
      }
    } else {
      // Another request is already building — wait briefly for it rather
      // than building twice, but never leave the client stuck: fall
      // through to building anyway if it doesn't finish in time.
      for (let i = 0; i < BUILD_WAIT_RETRIES && !bucket; i++) {
        await new Promise((r) => setTimeout(r, BUILD_WAIT_MS));
        bucket = await getReadyBucket(supabase, userId, filterHash);
      }
      if (!bucket) bucket = await buildBucket(supabase, userId, filters);
    }
  }

  await markServing(supabase, userId, filterHash, bucket.id);

  // Background pre-build (spec 23 §6): runs after the response is flushed,
  // so it costs the user nothing. Guarded by the same lock so a burst of
  // requests near the end of a bucket doesn't trigger redundant builds.
  after(async () => {
    const hasReady = await getReadyBucket(supabase, userId, filterHash);
    if (hasReady) return;
    const acquired = await tryAcquireBuildLock(supabase, userId, filterHash);
    if (!acquired) return;
    try {
      await buildBucket(supabase, userId, filters);
    } finally {
      await releaseBuildLock(supabase, userId, filterHash);
    }
  });

  return apiOk({
    bucketId: bucket.id,
    items: bucket.items,
    position: bucket.position,
    partial: bucket.partial,
    reason: bucket.reason,
  });
}
