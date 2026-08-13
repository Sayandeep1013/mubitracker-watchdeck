'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconBell } from './icons';
import type { NotificationItem } from '@/hooks/useNotificationsFeed';

interface NotificationBellProps {
  unread: number;
  items: NotificationItem[];
  onMarkAll: () => void;
}

export function NotificationBell({ unread, items, onMarkAll }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button type="button" onClick={onMarkAll} className="text-[10px] text-neutral-500 hover:text-neutral-300">
                  Mark all read
                </button>
              )}
              <Link href="/friends" className="text-[10px] text-red-400" onClick={() => setOpen(false)}>
                Friends
              </Link>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-neutral-600">No notifications</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg px-2 py-2 text-xs hover:bg-neutral-900 ${
                    n.readAt ? 'text-neutral-500' : 'text-neutral-200'
                  }`}
                >
                  {n.type === 'friend_request'
                    ? `@${n.actor?.username ?? 'someone'} sent a friend request`
                    : `@${n.actor?.username ?? 'someone'} accepted your request`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
