'use client';

import { tmdbPosterUrl } from '@watchdeck/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconBookmark } from '@/components/icons';
import { useApiClient } from '@/hooks/useApiClient';

interface PendingItem {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  displayType: string;
}

export default function ReviewLaterPage() {
  const client = useApiClient();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client
      .getPendingReviews()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <div className="p-4">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-white">
        <IconBookmark className="text-purple-400" size={22} />
        Review Later
      </h1>
      <p className="mb-4 text-sm text-neutral-500">Titles you flagged to write about</p>

      {loading ? (
        <p className="text-sm text-neutral-600">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-8 text-center">
          <p className="text-neutral-400">Nothing queued for review.</p>
          <p className="mt-1 text-sm text-neutral-600">
            On the deck, press ↑ or choose Review Later.
          </p>
          <Link
            href="/deck"
            className="mt-4 inline-block rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Open deck
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const poster = tmdbPosterUrl(item.posterPath, 'card');
            return (
              <Link
                key={item.id}
                href={`/review-later/${item.id}`}
                className="flex gap-4 rounded-xl border border-neutral-800 p-3 transition-colors hover:border-purple-500/30 hover:bg-neutral-900"
              >
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-neutral-800">
                  {poster && (
                    <Image src={poster} alt="" fill className="object-cover" unoptimized />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-xs text-neutral-500">
                    {item.year} · {item.displayType}
                  </p>
                  <p className="mt-2 text-xs text-purple-400">Write review →</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
