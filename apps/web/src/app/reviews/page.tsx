'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { tmdbPosterUrl, type PendingReviewsResponse, type Review } from '@mubitracker/shared';
import { useApiClient } from '@/hooks/useApiClient';
import { ActionToast, type ToastState } from '@/components/ActionToast';

type Tab = 'written' | 'pending';

export default function ReviewsPage() {
  const client = useApiClient();
  const [tab, setTab] = useState<Tab>('written');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pending, setPending] = useState<PendingReviewsResponse>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastId = useRef(0);

  const showToast = (partial: Omit<ToastState, 'id'>) => {
    const id = ++toastId.current;
    setToast({ id, ...partial });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2500);
  };

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([client.getReviews(), client.getPendingReviews()])
      .then(([r, p]) => {
        setReviews(r.reviews);
        setPending(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load reviews'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSpoiler = (id: string) => {
    setRevealedSpoilers((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteReview = async (review: Review) => {
    setConfirmDeleteId(null);
    const previous = reviews;
    setReviews((r) => r.filter((x) => x.id !== review.id));
    try {
      await client.deleteReview(review.id);
      showToast({ message: `Deleted review for ${review.media?.title ?? 'title'}`, tone: 'neutral' });
    } catch (e) {
      setReviews(previous);
      showToast({ message: e instanceof Error ? e.message : 'Could not delete review', tone: 'error' });
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4 lg:max-w-3xl xl:max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold text-white">Reviews</h1>

      <div className="mb-4 flex gap-1">
        {(
          [
            ['written', `Written${reviews.length ? ` (${reviews.length})` : ''}`],
            ['pending', `Pending${pending.length ? ` (${pending.length})` : ''}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              tab === id ? 'border-red-500/40 text-red-400' : 'border-neutral-800 text-neutral-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-900/60" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-neutral-800 p-8 text-center">
          <p className="mb-3 text-neutral-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400"
          >
            Retry
          </button>
        </div>
      ) : tab === 'written' ? (
        reviews.length === 0 ? (
          <p className="text-sm text-neutral-600">No reviews written yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => {
              const poster = tmdbPosterUrl(review.media?.posterPath ?? null, 'card');
              const revealed = revealedSpoilers.has(review.id);
              const blurred = review.isSpoiler && !revealed;
              return (
                <div key={review.id} className="flex gap-4 rounded-xl border border-neutral-800 p-3">
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-neutral-800">
                    {poster && <Image src={poster} alt="" fill className="object-cover" unoptimized />}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{review.media?.title ?? 'Unknown title'}</p>
                        <p className="text-xs text-neutral-500">
                          {review.media?.year ?? '—'} · Updated{' '}
                          {new Date(review.updatedAt).toLocaleDateString()}
                          {review.isSpoiler && (
                            <span className="ml-2 rounded-full border border-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-400">
                              Spoiler
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2 text-xs">
                        <Link href={`/reviews/${review.id}`} className="text-red-400">
                          Edit
                        </Link>
                        {confirmDeleteId === review.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => deleteReview(review)}
                              className="text-red-500"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-neutral-500"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(review.id)}
                            className="text-neutral-500 hover:text-red-400"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p
                      className={`mt-1 line-clamp-2 text-sm text-neutral-400 ${blurred ? 'blur-sm select-none' : ''}`}
                    >
                      {review.body}
                    </p>
                    {review.isSpoiler && (
                      <button
                        type="button"
                        onClick={() => toggleSpoiler(review.id)}
                        className="mt-1 self-start text-xs text-neutral-500 underline"
                      >
                        {revealed ? 'Hide spoiler' : 'Show spoiler'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : pending.length === 0 ? (
        <p className="text-sm text-neutral-600">Nothing queued for review.</p>
      ) : (
        <div className="space-y-3">
          {pending.map((item) => {
            const poster = tmdbPosterUrl(item.posterPath, 'card');
            return (
              <div key={item.id} className="flex gap-4 rounded-xl border border-neutral-800 p-3">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-neutral-800">
                  {poster && <Image src={poster} alt="" fill className="object-cover" unoptimized />}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-xs text-neutral-500">
                      {item.year ?? '—'} · {item.displayType}
                    </p>
                  </div>
                  <Link href={`/review-later/${item.id}`} className="self-start text-xs text-green-400">
                    Write review
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
