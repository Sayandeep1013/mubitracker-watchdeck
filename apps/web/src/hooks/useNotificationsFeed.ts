'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { ToastState } from '@/components/ActionToast';

export interface NotificationItem {
  id: string;
  type: string;
  friendshipId: string | null;
  readAt: string | null;
  actor: { username: string } | null;
}

/**
 * Single source of truth for the notification feed, shared by the desktop
 * bell and the mobile "More" sheet (spec 32 §6) — both render at once (CSS
 * just hides one per breakpoint), so this must be called once in `Nav()`
 * and passed down, not re-instantiated per surface, or they'd double-poll
 * and double-toast the same friend_request.
 */
export function useNotificationsFeed() {
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
        if (n.type === 'friend_request' && n.actor) {
          const id = ++toastId.current;
          setToast({
            id,
            tone: 'neutral',
            message: `Friend request from @${n.actor.username}`,
            href: '/friends',
            hrefLabel: 'Open Friends',
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

  return { unread, items, toast, dismissToast: () => setToast(null), markAll };
}
