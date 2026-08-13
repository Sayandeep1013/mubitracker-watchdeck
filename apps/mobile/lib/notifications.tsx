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

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, items, refresh, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}
