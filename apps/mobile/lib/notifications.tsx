import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiClient } from './api';
import { useToast } from '@/components/Toast';

export interface NotificationItem {
  id: string;
  type: string;
  friendshipId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; username: string; avatarUrl: string | null } | null;
}

interface NotificationsContextValue {
  unreadCount: number;
  items: NotificationItem[];
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markIncomingRead: () => Promise<void>;
  markFriendshipRead: (friendshipId: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const POLL_MS = 30000;

/** Mirrors web's `NotificationBell` polling — 30s interval, one toast per
 * newly-seen unread friend_request, no repeat toast on the next poll. */
export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const showToast = useToast();
  const seen = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.getNotifications();
      setUnreadCount(data.unreadCount);
      setItems(data.items);
      for (const n of data.items) {
        if (n.readAt || seen.current.has(n.id)) continue;
        seen.current.add(n.id);
        if (n.type === 'friend_request' && n.actor) {
          showToast({ message: `Friend request from @${n.actor.username}`, tone: 'neutral' });
        }
      }
    } catch {
      // Offline or unauthenticated — next poll retries.
    }
  }, [showToast]);

  const markAllRead = useCallback(async () => {
    try {
      await apiClient.markNotificationsRead({ all: true });
      await refresh();
    } catch {
      // Best-effort — badge just stays as-is until the next successful poll.
    }
  }, [refresh]);

  const markIds = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      try {
        await apiClient.markNotificationsRead({ ids });
        await refresh();
      } catch {
        // Best-effort — badge just stays as-is until the next successful poll.
      }
    },
    [refresh],
  );

  // Spec 40 §7: viewing Incoming clears friend-request unreads — opening
  // the notifications modal itself must NOT mark anything read anymore.
  const markIncomingRead = useCallback(() => {
    const ids = items.filter((n) => n.type === 'friend_request' && !n.readAt).map((n) => n.id);
    return markIds(ids);
  }, [items, markIds]);

  // Spec 40 §7: Accept/Decline/Block/Cancel on a request also clears its
  // own notification, not just a bulk "mark all".
  const markFriendshipRead = useCallback(
    (friendshipId: string) => {
      const ids = items.filter((n) => n.friendshipId === friendshipId && !n.readAt).map((n) => n.id);
      return markIds(ids);
    },
    [items, markIds],
  );

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <NotificationsContext.Provider
      value={{ unreadCount, items, refresh, markAllRead, markIncomingRead, markFriendshipRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
