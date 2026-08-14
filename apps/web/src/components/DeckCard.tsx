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
      className={`flex w-full max-w-md flex-col items-center gap-2 ${
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
      {/* Height-driven, not width-driven: a fixed width (the old `w-56`)
          produces a fixed height via the aspect-ratio regardless of viewport
          height, which is exactly what didn't fit on short screens. Sizing
          off `dvh` instead lets the poster shrink on short viewports before
          anything below it runs out of room. The poster is the main
          attraction of this screen — it gets the majority of the vertical
          budget; everything below (buttons, confirm) is deliberately
          compact so it doesn't compete for attention. */}
      <div className="relative aspect-[2/3] h-[clamp(220px,54dvh,560px)] w-auto max-w-[82vw] overflow-hidden rounded-xl border border-white/5 bg-neutral-950 shadow-[0_0_60px_rgba(239,68,68,0.08)]">
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
        <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">{item.title}</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          {item.year ?? '—'} · {item.displayType} · {item.originalLanguage.toUpperCase()}
          {' · '}
          <button
            type="button"
            onClick={openImdb}
            disabled={imdbLoading}
            className="inline-flex items-center gap-1 text-neutral-600 transition-colors hover:text-amber-400 disabled:opacity-50"
          >
            <IconExternalLink size={11} />
            {imdbLoading ? 'Opening…' : 'IMDb'}
          </button>
        </p>
      </div>

      {/* Compact toolbar, not a second focal point: small icon-first
          buttons in one row (instead of the old two stacked rows + a
          separate Confirm bar) so the poster above keeps the visual
          weight. Muted until selected. */}
      <div className="flex w-full max-w-md flex-col gap-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => onSelectAction('unwatched')}
            className={`flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[10px] font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'unwatched'
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-neutral-800/70 bg-neutral-950/60 text-neutral-600'
            }`}
          >
            <IconX size={14} />
            Haven&apos;t
          </button>
          <button
            type="button"
            onClick={() => onSelectAction('watched')}
            className={`flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[10px] font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'watched'
                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                : 'border-neutral-800/70 bg-neutral-950/60 text-neutral-600'
            }`}
          >
            <IconCheck size={14} />
            Watched
          </button>
          <button
            type="button"
            onClick={() => onSelectAction('watch_later')}
            className={`flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[10px] font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'watch_later'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-neutral-800/70 bg-neutral-950/60 text-neutral-600'
            }`}
          >
            <IconClock size={14} />
            Later
          </button>
          <button
            type="button"
            onClick={() => onSelectAction('review_later')}
            className={`flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[10px] font-medium transition-all active:scale-[0.97] ${
              selectedAction === 'review_later'
                ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                : 'border-neutral-800/70 bg-neutral-950/60 text-neutral-600'
            }`}
          >
            <IconBookmarkPlus size={14} />
            Review
          </button>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-lg border border-red-500/30 bg-neutral-950/60 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 active:scale-[0.98]"
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
    <div className="flex w-full max-w-md flex-col items-center gap-2 animate-pulse">
      <div className="aspect-[2/3] h-[clamp(220px,54dvh,560px)] w-auto max-w-[82vw] rounded-xl bg-neutral-900" />
      <div className="flex flex-col items-center gap-2">
        <div className="h-5 w-40 rounded bg-neutral-900" />
        <div className="h-3 w-32 rounded bg-neutral-900" />
      </div>
      <div className="flex w-full max-w-md flex-col gap-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          <div className="h-11 rounded-lg bg-neutral-900" />
          <div className="h-11 rounded-lg bg-neutral-900" />
          <div className="h-11 rounded-lg bg-neutral-900" />
          <div className="h-11 rounded-lg bg-neutral-900" />
        </div>
        <div className="h-8 w-full rounded-lg bg-neutral-900" />
      </div>
    </div>
  );
}
