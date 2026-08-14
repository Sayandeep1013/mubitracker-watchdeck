import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkUnavailableError, type OfflineAction } from '@mubitracker/shared';
import { apiClient } from './api';
import { withNetworkRetry } from './retry';

const QUEUE_KEY = 'mubitracker_offline_queue';

export interface SyncResult {
  synced: number;
  /** Dropped after the server explicitly rejected them — see the comment in
   * `syncOfflineQueue` for why these must not be retried forever. */
  failed: number;
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function enqueueOfflineAction(action: Omit<OfflineAction, 'synced'>) {
  const queue = await getOfflineQueue();
  queue.push({ ...action, synced: false });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function syncOfflineQueue(): Promise<SyncResult> {
  const queue = await getOfflineQueue();
  let synced = 0;
  let failed = 0;
  const remaining: OfflineAction[] = [];

  for (const action of queue) {
    try {
      await withNetworkRetry(() => {
        if (action.reviewStatus === 'pending') return apiClient.reviewLater(action.mediaId);
        return apiClient.updateUserMedia(action.mediaId, {
          status: action.status,
          review_status: action.reviewStatus,
        });
      });
      synced++;
    } catch (e) {
      // A real (non-network) error here means the server was reached and
      // explicitly rejected this action — retrying it again next load
      // would fail identically forever, silently, with no way for the user
      // to ever find out their action never actually saved. Only a genuine
      // connectivity failure belongs back in the queue; everything else is
      // dropped and reported through `failed` so the caller can say so.
      if (e instanceof NetworkUnavailableError) {
        remaining.push(action);
      } else {
        failed++;
      }
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { synced, failed };
}
