'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  IconBookmark,
  IconClock,
  IconLayers,
  IconLibrary,
  IconSearch,
  IconUser,
  IconUsers,
} from './icons';
import { NotificationBell } from './NotificationBell';
import { MoreSheet, MoreTrigger } from './MoreSheet';
import { ActionToast } from './ActionToast';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';

const links = [
  { href: '/deck', label: 'Deck', Icon: IconLayers },
  { href: '/search', label: 'Search', Icon: IconSearch },
  { href: '/collection', label: 'Collection', Icon: IconLibrary },
  { href: '/watch-later', label: 'Later', Icon: IconClock },
  { href: '/reviews', label: 'Reviews', Icon: IconBookmark },
  { href: '/friends', label: 'Friends', Icon: IconUsers },
  { href: '/profile', label: 'Profile', Icon: IconUser },
];

// Spec 32 §6: 5 items + More, not 7-item cramming. Slots 1-4 stay static;
// Reviews (not Later) fills slot 4 — Watch Later moves into the sheet.
const MOBILE_BAR = [links[0], links[1], links[2], links[4]];
const MORE_SHEET_ROUTES = ['/watch-later', '/friends', '/profile', '/about'];

export function Nav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { unread, items, toast, dismissToast, markAll } = useNotificationsFeed();

  const moreActive = MORE_SHEET_ROUTES.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );

  return (
    <>
      <nav className="hidden md:flex md:w-52 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-neutral-800/50 md:bg-neutral-950 md:p-4">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/deck" className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={24} height={24} className="rounded-md" />
            <span className="text-sm font-bold tracking-tight text-neutral-200">MUBITRACKER</span>
          </Link>
          <NotificationBell unread={unread} items={items} onMarkAll={markAll} />
        </div>
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.Icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                active
                  ? 'bg-red-500/10 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]'
                  : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300'
              }`}
            >
              <Icon className="opacity-80" size={16} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-neutral-800/50 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOBILE_BAR.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.Icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] transition-colors ${
                active ? 'text-red-400' : 'text-neutral-600'
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
        <MoreTrigger active={moreActive} unread={unread} onPress={() => setMoreOpen(true)} />
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        unread={unread}
        items={items}
        onMarkAll={markAll}
      />

      <ActionToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
