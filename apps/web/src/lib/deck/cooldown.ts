import type { WatchStatus } from '@mubitracker/shared';

/** Postgres accepts/returns the literal string 'infinity' for timestamptz;
 * `new Date('infinity')` is an Invalid Date in JS, so it needs its own check
 * rather than a Date comparison. */
export const HIDDEN_FOREVER = 'infinity';

const ESCALATION_DAYS = [14, 60] as const;

/** reject_count is the count *after* this rejection (1-indexed). */
export function computeHiddenUntil(rejectCount: number): string {
  if (rejectCount >= 3) return HIDDEN_FOREVER;
  const days = ESCALATION_DAYS[rejectCount - 1] ?? ESCALATION_DAYS[0];
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isHiddenNow(hiddenUntil: string | null): boolean {
  if (!hiddenUntil) return false;
  if (hiddenUntil === HIDDEN_FOREVER) return true;
  return new Date(hiddenUntil).getTime() > Date.now();
}

export interface CooldownTransition {
  rejectCount: number;
  hiddenUntil: string | null;
}

/**
 * Rules (spec 24 §5):
 *  - unwatched: reject_count += 1, hidden_until escalates 14d -> 60d -> forever.
 *  - watched / watch_later: hidden_until = forever, reject_count preserved
 *    (undo must be able to restore it).
 */
export function nextCooldownState(
  status: WatchStatus,
  prior: { rejectCount: number; hiddenUntil: string | null },
): CooldownTransition {
  if (status === 'unwatched') {
    const rejectCount = prior.rejectCount + 1;
    return { rejectCount, hiddenUntil: computeHiddenUntil(rejectCount) };
  }
  return { rejectCount: prior.rejectCount, hiddenUntil: HIDDEN_FOREVER };
}
