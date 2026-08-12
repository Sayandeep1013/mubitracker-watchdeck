'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionToast, type ToastState } from './ActionToast';
import { IconBell } from './icons';
import { useApiClient } from '@/hooks/useApiClient';

export function NotificationBell() {
  const client = useApiClient();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    {
      id: string;
      type: string;
      friendshipId: string | null;
      actor: { username: string } | null;
    }[]
  >([]);
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
      // ignore
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

  const markAll = async () => {
    await client.markNotificationsRead({ all: true });
    refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAll();
        }}
        className="relative rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:border-red-500/30 hover:text-red-400"
        aria-label="Notifications"
      >
        <IconBell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs font-semibold text-neutral-300">Notifications</p>
            <Link href="/friends" className="text-[10px] text-red-400" onClick={() => setOpen(false)}>
              Friends
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-neutral-600">No notifications</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="rounded-lg px-2 py-2 text-xs text-neutral-300 hover:bg-neutral-900">
                  {n.type === 'friend_request'
                    ? `@${n.actor?.username ?? 'someone'} sent a friend request`
                    : `@${n.actor?.username ?? 'someone'} accepted your request`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
