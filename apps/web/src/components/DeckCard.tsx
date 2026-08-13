'use client';

import type { DeckItem } from '@mubitracker/shared';
import { tmdbPosterUrl } from '@mubitracker/shared';
import Image from 'next/image';
import { useState } from 'react';
import { IconBookmarkPlus, IconCheck, IconClock, IconExternalLink, IconX } from './icons';
import { useApiClient } from '@/hooks/useApiClient';

type Action = 'unwatched' | 'watched' | 'review_later' | 'watch_later';

interface DeckCardProps {
  item: DeckItem;
  selectedAction: Action;
  onSelectAction: (action: Action) => void;
  onConfirm: () => void;
  dragX?: number;
  dragY?: number;
  exitDirection?: 'left' | 'right' | 'up' | 'down' | null;
  entering?: boolean;
}

export function DeckCard({
  item,
  selectedAction,
  onSelectAction,
  onConfirm,
  dragX = 0,
  dragY = 0,
  exitDirection = null,
  entering = false,
}: DeckCardProps) {
  const client = useApiClient();
  const [imdbLoading, setImdbLoading] = useState(false);
  const posterUrl = tmdbPosterUrl(item.posterPath, 'deck');
  const rotation = dragX * 0.05;
  const opacity = 1 - Math.min(Math.abs(dragX) / 300, 0.3);

  const openImdb = async () => {
    if (imdbLoading) return;
    setImdbLoading(true);
    try {
      const { imdbUrl } = await client.getImdbLink(item.id);
      if (imdbUrl) window.open(imdbUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // silently ignore — non-critical, secondary action
    } finally {
      setImdbLoading(false);
    }
  };

  const exitClass =
    exitDirection === 'left'
      ? 'animate-deck-exit-left'
      : exitDirection === 'right'
        ? 'animate-deck-exit-right'
        : exitDirection === 'up'
          ? 'animate-deck-exit-up'
          : exitDirection === 'down'
            ? 'animate-deck-exit-down'
            : '';

  return (
    <div
      className={`flex w-full max-w-md flex-col items-center gap-4 ${
        entering && !exitDirection ? 'animate-deck-enter' : ''
      } ${exitClass}`}
      style={
        exitDirection
          ? undefined
          : {
              transform: `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`,
              opacity,
              transition: dragX === 0 && dragY === 0 ? 'transform 0.2s ease' : 'none',
            }
      }
    >
      <div className="relative aspect-[2/3] w-56 overflow-hidden rounded-xl border border-white/5 bg-neutral-950 shadow-[0_0_60px_rgba(239,68,68,0.08)] sm:w-64">
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-600">No poster</div>
        )}
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10" />

        {Math.abs(dragX) > 40 && (
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              dragX > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {dragX > 0 ? <IconCheck size={64} /> : <IconX size={64} />}
          </div>
        )}
        {dragY < -60 && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20 text-amber-300">
            <IconClock size={64} />
          </div>
        )}
        {dragY > 60 && (
          <div className="absolute inset-0 flex items-center justify-center bg-purple-500/20 text-purple-300">
            <IconBookmarkPlus size={64} />
          </div>
        )}
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">{item.title}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {item.year ?? '—'} · {item.displayType} · {item.originalLanguage.toUpperCase()}
        </p>
        <button
          type="button"
          onClick={openImdb}
          disabled={imdbLoading}
          className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-600 transition-colors hover:text-amber-400 disabled:opacity-50"
        >
          <IconExternalLink size={12} />
          {imdbLoading ? 'Opening…' : 'IMDb'}
        </button>
        {item.overview && (
          <p className="mt-3 line-clamp-3 max-w-md text-sm text-neutral-600">{item.overview}</p>
        )}
      </div>

      <div className="flex w-full max-w-md flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSelectAction('unwatched')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'unwatched'
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-neutral-800 bg-neutral-950 text-neutral-500'
            }`}
          >
            <IconX size={16} />
            Haven&apos;t
          </button>
          <button
            type="button"
            onClick={() => onSelectAction('watched')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'watched'
                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                : 'border-neutral-800 bg-neutral-950 text-neutral-500'
            }`}
          >
            <IconCheck size={16} />
            Watched
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSelectAction('watch_later')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'watch_later'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-neutral-800 bg-neutral-950 text-neutral-500'
            }`}
          >
            <IconClock size={16} />
            Watch Later
          </button>
          <button
            type="button"
            onClick={() => onSelectAction('review_later')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'review_later'
                ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                : 'border-neutral-800 bg-neutral-950 text-neutral-500'
            }`}
          >
            <IconBookmarkPlus size={16} />
            Review Later
          </button>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-1 w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 active:scale-[0.98]"
        >
          Confirm
        </button>
      </div>

      <div className="hidden items-center justify-center gap-3 text-[10px] text-neutral-700 md:flex">
        <span>← Haven&apos;t</span>
        <span>↑ Watch Later</span>
        <span>↓ Review Later</span>
        <span>Watched →</span>
        <span>Enter ↵</span>
      </div>
    </div>
  );
}

/** Mirrors DeckCard's exact dimensions so real content never shifts layout on arrival. */
export function DeckCardSkeleton() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 animate-pulse">
      <div className="aspect-[2/3] w-56 rounded-xl bg-neutral-900 sm:w-64" />
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-40 rounded bg-neutral-900" />
        <div className="h-3 w-24 rounded bg-neutral-900" />
      </div>
      <div className="flex w-full max-w-md flex-col gap-2">
        <div className="flex gap-2">
          <div className="h-11 flex-1 rounded-lg bg-neutral-900" />
          <div className="h-11 flex-1 rounded-lg bg-neutral-900" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 flex-1 rounded-lg bg-neutral-900" />
          <div className="h-11 flex-1 rounded-lg bg-neutral-900" />
        </div>
        <div className="mt-1 h-11 w-full rounded-lg bg-neutral-900" />
      </div>
    </div>
  );
}
