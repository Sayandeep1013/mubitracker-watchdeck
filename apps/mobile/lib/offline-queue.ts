import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineAction } from '@watchdeck/shared';
import { apiClient } from './api';

const QUEUE_KEY = 'watchdeck_offline_queue';

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function enqueueOfflineAction(action: Omit<OfflineAction, 'synced'>) {
  const queue = await getOfflineQueue();
  queue.push({ ...action, synced: false });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function syncOfflineQueue(): Promise<number> {
  const queue = await getOfflineQueue();
  let synced = 0;
  const remaining: OfflineAction[] = [];

  for (const action of queue) {
    try {
      if (action.reviewStatus === 'pending') {
        await apiClient.reviewLater(action.mediaId);
      } else {
        await apiClient.updateUserMedia(action.mediaId, {
          status: action.status,
          review_status: action.reviewStatus,
        });
      }
      synced++;
    } catch {
      remaining.push(action);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return synced;
}
