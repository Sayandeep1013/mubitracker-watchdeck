'use client';

import {
  DECK_PREFETCH_AT,
  deckFiltersToSearchParams,
  filtersFromSearchParams,
  type DeckFilters,
  type DeckItem,
  type UndoAction,
  MAX_UNDO_STACK,
} from '@mubitracker/shared';
import { IconSliders } from './icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ActionToast, type ToastState } from './ActionToast';
import { DeckCard } from './DeckCard';
import { FilterDrawer } from './FilterDrawer';
import { useApiClient } from '@/hooks/useApiClient';

type Action = 'unwatched' | 'watched' | 'review_later' | 'watch_later';

const EXIT_MS = 220;

function hasFilterValues(filters: DeckFilters): boolean {
  return Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ''));
}

export function DeckView() {
  const client = useApiClient();
  const searchParams = useSearchParams();
  const [queue, setQueue] = useState<DeckItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<Action>('unwatched');
  const stickyAction = useRef<Action>('unwatched');
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DeckFilters>(() =>
    filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [entering, setEntering] = useState(true);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const fetching = useRef(false);
  const toastId = useRef(0);
  const busy = useRef(false);
  const urlSynced = useRef(false);

  const current = queue[currentIndex];
  const activeFilterCount = Object.values(filters).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v != null && v !== '',
  ).length;

  // Apply friend_id / filter query from URL once (e.g. Friends → Their Deck)
  useEffect(() => {
    if (urlSynced.current) return;
    urlSynced.current = true;
    const fromUrl = filtersFromSearchParams(new URLSearchParams(searchParams.toString()));
    if (hasFilterValues(fromUrl)) {
      setFilters(fromUrl);
    }
  }, [searchParams]);

  const showToast = useCallback((partial: Omit<ToastState, 'id'>) => {
    const id = ++toastId.current;
    setToast({ id, ...partial });
    window.setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, 2500);
  }, []);

  const fetchBatch = useCallback(
    async (overrides?: { cursor: string | null; sessionId: string | null }) => {
      if (fetching.current) return;
      fetching.current = true;
      const activeCursor = overrides ? overrides.cursor : cursor;
      const activeSessionId = overrides ? overrides.sessionId : sessionId;
      try {
        const params = deckFiltersToSearchParams(filters);
        if (activeCursor) params.set('cursor', activeCursor);
        if (activeSessionId) params.set('session_id', activeSessionId);
        const data = await client.getDeck(params);
        setQueue((q) => [...q, ...data.items]);
        setCursor(data.cursor);
        setSessionId(data.sessionId);
        if (data.message && data.items.length === 0) {
          showToast({ message: data.message, tone: 'neutral' });
        }
      } catch (e) {
        showToast({
          message: e instanceof Error ? e.message : 'Failed to load deck',
          tone: 'error',
        });
      } finally {
        fetching.current = false;
        setLoading(false);
      }
    },
    [client, cursor, sessionId, filters, showToast],
  );

  useEffect(() => {
    setQueue([]);
    setCurrentIndex(0);
    setCursor(null);
    setSessionId(null);
    setLoading(true);
    setEntering(true);
    // Pass explicit nulls — cursor/sessionId state resets haven't committed yet,
    // so the fetchBatch closure would otherwise reuse the previous filter set's values.
    fetchBatch({ cursor: null, sessionId: null });
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentIndex >= queue.length - 5 && cursor) {
      fetchBatch();
    }
    if (currentIndex >= DECK_PREFETCH_AT && cursor && queue.length < DECK_PREFETCH_AT + 10) {
      fetchBatch();
    }
  }, [currentIndex, queue.length, cursor, fetchBatch]);

  const advance = useCallback(() => {
    setCurrentIndex((i) => i + 1);
    // Sticky: keep last ←/→/Enter selection (not watch/review later shortcuts)
    const sticky =
      stickyAction.current === 'watched' || stickyAction.current === 'unwatched'
        ? stickyAction.current
        : 'unwatched';
    setSelectedAction(sticky);
    setDragX(0);
    setDragY(0);
    setExitDirection(null);
    setEntering(true);
    window.setTimeout(() => setEntering(false), 220);
  }, []);

  const performAction = useCallback(
    async (action: Action) => {
      if (!current || busy.current || exitDirection) return;
      busy.current = true;

      const title = current.title;
      const prevStatus = current.userStatus ?? 'unwatched';
      const prevReview = current.userReviewStatus ?? 'none';
      const prevRejectCount = current.userRejectCount ?? 0;
      const prevHiddenUntil = current.userHiddenUntil ?? null;

      if (action === 'watched' || action === 'unwatched') {
        stickyAction.current = action;
      }

      setUndoStack((s) =>
        [
          {
            mediaId: current.id,
            previousStatus: prevStatus as UndoAction['previousStatus'],
            previousReviewStatus: prevReview as UndoAction['previousReviewStatus'],
            previousRejectCount: prevRejectCount,
            previousHiddenUntil: prevHiddenUntil,
            timestamp: new Date().toISOString(),
          },
          ...s,
        ].slice(0, MAX_UNDO_STACK),
      );

      const dir =
        action === 'watched'
          ? 'right'
          : action === 'unwatched'
            ? 'left'
            : action === 'watch_later'
              ? 'up'
              : 'up';
      setExitDirection(dir);

      window.setTimeout(() => {
        advance();
        busy.current = false;
      }, EXIT_MS);

      try {
        if (action === 'review_later') {
          await client.reviewLater(current.id);
          showToast({
            message: `Queued for review · ${title}`,
            tone: 'review',
            href: '/review-later',
            hrefLabel: 'Open Reviews',
          });
        } else if (action === 'watch_later') {
          await client.watchLater(current.id);
          showToast({
            message: `Saved to Watch Later · ${title}`,
            tone: 'neutral',
            href: '/watch-later',
            hrefLabel: 'Open Watch Later',
          });
        } else {
          await client.updateUserMedia(current.id, {
            status: action === 'watched' ? 'watched' : 'unwatched',
            review_status: prevReview,
          });
        }
      } catch {
        showToast({ message: 'Could not save action — try again', tone: 'error' });
      }
    },
    [current, client, advance, exitDirection, showToast],
  );

  const handleConfirm = useCallback(() => {
    // Only confirm watched/unwatched/review_later/watch_later from button selection
    performAction(selectedAction);
  }, [selectedAction, performAction]);

  const handleUndo = useCallback(async () => {
    const last = undoStack[0];
    if (!last) return;
    setUndoStack((s) => s.slice(1));
    setCurrentIndex((i) => Math.max(0, i - 1));
    setEntering(true);
    try {
      await client.undo({
        media_id: last.mediaId,
        previous_status: last.previousStatus,
        previous_review_status: last.previousReviewStatus,
        previous_reject_count: last.previousRejectCount,
        previous_hidden_until: last.previousHiddenUntil,
      });
      showToast({ message: 'Undone', tone: 'undo' });
    } catch {
      showToast({ message: 'Undo failed', tone: 'error' });
    }
  }, [undoStack, client, showToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stickyAction.current = 'unwatched';
        setSelectedAction('unwatched');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stickyAction.current = 'watched';
        setSelectedAction('watched');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        performAction('watch_later');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        performAction('review_later');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setShowFilters((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleConfirm, performAction, handleUndo]);

  const onTouchStart = (e: React.TouchEvent) => {
    const { clientX, clientY } = e.touches[0];
    touchStart.current = { x: clientX, y: clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || exitDirection) return;
    const { clientX, clientY } = e.touches[0];
    setDragX(clientX - touchStart.current.x);
    setDragY(clientY - touchStart.current.y);
  };

  const onTouchEnd = () => {
    if (Math.abs(dragX) > 80) {
      performAction(dragX > 0 ? 'watched' : 'unwatched');
    } else if (dragY < -100) {
      performAction('watch_later');
    } else if (dragY > 100) {
      performAction('review_later');
    } else {
      setDragX(0);
      setDragY(0);
    }
    touchStart.current = null;
  };

  if (!loading && !current && queue.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center animate-deck-enter">
          <p className="mb-2 text-lg text-neutral-400">Deck is empty</p>
          <p className="text-sm text-neutral-600">
            {activeFilterCount > 0
              ? 'Try broadening your filters'
              : 'Check back later for new titles'}
          </p>
          {activeFilterCount > 0 && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
              >
                Edit filters
              </button>
              <button
                type="button"
                onClick={() => setFilters({})}
                className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                Clear filters
              </button>
            </div>
          )}
          {activeFilterCount === 0 && (
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="mt-4 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
            >
              Open filters
            </button>
          )}
        </div>
        {showFilters && (
          <FilterDrawer
            filters={filters}
            onApply={(f) => {
              setFilters(f);
              setShowFilters(false);
            }}
            onClose={() => setShowFilters(false)}
            client={client}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="mb-4 flex w-full max-w-md items-center justify-between">
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:border-red-500/30 hover:text-red-400"
        >
          <IconSliders size={14} />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <span className="text-xs text-neutral-700">#{currentIndex + 1}</span>
      </div>

      <div
        className="w-full max-w-md select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {current && (
          <DeckCard
            key={current.id}
            item={current}
            selectedAction={selectedAction}
            onSelectAction={(a) => {
              if (a === 'watched' || a === 'unwatched') stickyAction.current = a;
              setSelectedAction(a);
            }}
            onConfirm={handleConfirm}
            dragX={dragX}
            dragY={dragY}
            exitDirection={exitDirection}
            entering={entering}
          />
        )}
      </div>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-neutral-600">
          <div className="h-1.5 w-1.5 animate-ping rounded-full bg-red-500" />
          Loading deck...
        </div>
      )}

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />

      {showFilters && (
        <FilterDrawer
          filters={filters}
          onApply={(f) => {
            setFilters(f);
            setShowFilters(false);
          }}
          onClose={() => setShowFilters(false)}
          client={client}
        />
      )}
    </div>
  );
}
