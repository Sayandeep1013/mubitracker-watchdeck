'use client';

import { tmdbPosterUrl } from '@mubitracker/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconClock } from '@/components/icons';
import { useApiClient } from '@/hooks/useApiClient';

interface Item {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  displayType: string;
}

export default function WatchLaterPage() {
  const client = useApiClient();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .getWatchLater()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [client]);

  return (
    <div className="p-4">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-white">
        <IconClock className="text-amber-400" size={22} />
        Watch Later
      </h1>
      <p className="mb-4 text-sm text-neutral-500">Titles you want to watch someday</p>

      {loading ? (
        <p className="text-sm text-neutral-600">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 p-8 text-center">
          <p className="text-neutral-400">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-neutral-600">On the deck, press ↑ for Watch Later.</p>
          <Link
            href="/deck"
            className="mt-4 inline-block rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400"
          >
            Open deck
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const poster = tmdbPosterUrl(item.posterPath, 'card');
            return (
              <div
                key={item.id}
                className="flex gap-4 rounded-xl border border-neutral-800 p-3"
              >
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-neutral-800">
                  {poster && <Image src={poster} alt="" fill className="object-cover" unoptimized />}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-xs text-neutral-500">
                      {item.year} · {item.displayType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await client.updateUserMedia(item.id, {
                        status: 'watched',
                        review_status: 'none',
                      });
                      setItems((s) => s.filter((x) => x.id !== item.id));
                    }}
                    className="self-start text-xs text-green-400"
                  >
                    Mark watched
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
