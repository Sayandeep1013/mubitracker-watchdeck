'use client';

import { usePathname } from 'next/navigation';
import { Nav } from './Nav';
import { NotificationsFeedProvider } from '@/hooks/useNotificationsFeed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';
  const isPublicPage = pathname === '/about';

  if (isAuthPage || isPublicPage) {
    return <>{children}</>;
  }

  return (
    <NotificationsFeedProvider>
      <div className="flex min-h-screen bg-neutral-950">
        <Nav />
        <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
      </div>
    </NotificationsFeedProvider>
  );
}
