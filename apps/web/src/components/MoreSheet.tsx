'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { NotificationItem } from '@/hooks/useNotificationsFeed';
import {
  IconBell,
  IconClock,
  IconInfo,
  IconMenu,
  IconUser,
  IconUsers,
} from './icons';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  unread: number;
  items: NotificationItem[];
  onOpenNotifications: () => void;
}

const DESTINATIONS = [
  { href: '/watch-later', label: 'Watch Later', Icon: IconClock },
  { href: '/friends', label: 'Friends', Icon: IconUsers },
  { href: '/profile', label: 'Profile', Icon: IconUser },
  { href: '/about', label: 'About', Icon: IconInfo },
];

export function MoreTrigger({
  active,
  unread,
  onPress,
}: {
  active: boolean;
  unread: number;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-haspopup="dialog"
      className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-[10px] transition-colors ${
        active ? 'text-red-400' : 'text-neutral-600'
      }`}
    >
      <IconMenu size={18} />
      More
      {unread > 0 && (
        <span className="absolute right-[22%] top-1 rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

export function MoreSheet({ open, onClose, unread, items, onOpenNotifications }: MoreSheetProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setShowNotifications(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleNotifications = () => {
    setShowNotifications((v) => !v);
    if (!showNotifications) onOpenNotifications();
  };

  return (
    <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="More">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-neutral-800 bg-neutral-950 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] outline-none"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-800" />

        {DESTINATIONS.map((d) => {
          const Icon = d.Icon;
          return (
            <Link
              key={d.href}
              href={d.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-neutral-300 hover:bg-neutral-900"
            >
              <Icon size={18} className="opacity-80" />
              {d.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={toggleNotifications}
          className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-medium text-neutral-300 hover:bg-neutral-900"
        >
          <span className="flex items-center gap-3">
            <IconBell size={18} className="opacity-80" />
            Notifications
          </span>
          {unread > 0 && (
            <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-900 bg-neutral-900/40 p-2">
            {items.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-neutral-600">No notifications</p>
            ) : (
              <ul className="space-y-1">
                {items.map((n) => (
                  <li key={n.id} className="rounded-lg px-2 py-2 text-xs text-neutral-300">
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
    </div>
  );
}
