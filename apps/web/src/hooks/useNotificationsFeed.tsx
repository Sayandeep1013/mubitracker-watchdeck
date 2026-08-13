'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { ToastState } from '@/components/ActionToast';

export interface NotificationItem {
  id: string;
  type: string;
  friendshipId: string | null;
  readAt: string | null;
  actor: { username: string } | null;
}

interface NotificationsFeedValue {
  unread: number;
  items: NotificationItem[];
  toast: ToastState | null;
  dismissToast: () => void;
  markAll: () => Promise<void>;
  markIncomingRead: () => Promise<void>;
  markFriendshipNotificationsRead: (friendshipId: string) => Promise<void>;
}

const NotificationsFeedContext = createContext<NotificationsFeedValue | null>(null);

/**
 * Single source of truth for the notification feed, shared by the desktop
 * bell, the mobile "More" sheet (spec 32 §6), and the Friends page's
 * Incoming-tab read-tracking (spec 40 §7) — all can render at once, so
 * this must be a single provider instance, not re-instantiated per
 * consumer, or they'd double-poll and double-toast the same friend_request.
 */
export function useNotificationsFeed() {
  const ctx = useContext(NotificationsFeedContext);
  if (!ctx) throw new Error('useNotificationsFeed must be used within a NotificationsFeedProvider');
  return ctx;
}

export function NotificationsFeedProvider({ children }: { children: React.ReactNode }) {
  const client = useApiClient();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const toastId = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const data = await client.getNotifications();
      setUnread(data.unreadCount);
      setItems(data.items.slice(0, 12));

      for (const n of data.items) {
        if (n.readAt) continue;
        if (seen.current.has(n.id)) continue;
        seen.current.add(n.id);
        if (n.type === 'friend_request' && n.actor && n.friendshipId) {
          const id = ++toastId.current;
          const friendshipId = n.friendshipId;
          setToast({
            id,
            tone: 'neutral',
            message: `Friend request from @${n.actor.username}`,
            href: '/friends?tab=incoming',
            hrefLabel: 'View',
            acceptLabel: 'Accept',
            onAccept: async () => {
              try {
                await client.acceptFriend(friendshipId);
                await client.markNotificationsRead({ ids: [n.id] });
              } catch {
                // best-effort — the Incoming tab is still the source of truth
              } finally {
                refresh();
              }
            },
          });
          window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
        }
      }
    } catch {
      // ignore — next poll retries
    }
  }, [client]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const markAll = useCallback(async () => {
    await client.markNotificationsRead({ all: true });
    refresh();
  }, [client, refresh]);

  const markIds = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      await client.markNotificationsRead({ ids });
      refresh();
    },
    [client, refresh],
  );

  // Spec 40 §7: viewing Incoming clears friend-request unreads — opening
  // the bell/sheet panel itself must NOT mark anything read anymore.
  const markIncomingRead = useCallback(() => {
    const ids = items.filter((n) => n.type === 'friend_request' && !n.readAt).map((n) => n.id);
    return markIds(ids);
  }, [items, markIds]);

  // Spec 40 §7: Accept/Decline/Block/Cancel on a request also clears its
  // own notification, not just a bulk "mark all".
  const markFriendshipNotificationsRead = useCallback(
    (friendshipId: string) => {
      const ids = items.filter((n) => n.friendshipId === friendshipId && !n.readAt).map((n) => n.id);
      return markIds(ids);
    },
    [items, markIds],
  );

  return (
    <NotificationsFeedContext.Provider
      value={{
        unread,
        items,
        toast,
        dismissToast: () => setToast(null),
        markAll,
        markIncomingRead,
        markFriendshipNotificationsRead,
      }}
    >
      {children}
    </NotificationsFeedContext.Provider>
  );
}
