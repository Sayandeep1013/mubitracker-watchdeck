import { NetworkUnavailableError } from '@mubitracker/shared';

const RETRY_DELAYS_MS = [500, 1500, 3000];

/**
 * Retries `fn` only on `NetworkUnavailableError` — a real connectivity blip
 * (a dead WiFi handover, a moment of no signal) is exactly the kind of
 * failure that resolves itself within a few seconds, so retrying silently
 * here means the user never even sees it. `ApiHttpError` and everything
 * else rethrows on the first attempt: retrying a request the server
 * already explicitly rejected can't ever succeed differently, so there's
 * nothing to gain and, for a non-idempotent endpoint, real risk in trying.
 *
 * Only call this around requests that are safe to send more than once —
 * `user_media` writes upsert on `(user_id, media_id)`, so a retry after an
 * ambiguous "did that actually go through?" failure just re-applies the
 * same state rather than creating a duplicate.
 */
export async function withNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof NetworkUnavailableError) || attempt >= RETRY_DELAYS_MS.length) throw e;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
