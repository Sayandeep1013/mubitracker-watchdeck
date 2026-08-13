'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { tmdbPosterUrl, type MediaSummary } from '@mubitracker/shared';
import { useApiClient } from '@/hooks/useApiClient';

type Visibility = 'public' | 'friends' | 'private';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReviewEditorProps {
  mode: 'create' | 'edit';
  mediaId?: string;
  reviewId?: string;
  onSaved: () => void;
}

/** Shared by review-later/[id]/page.tsx (create mode, from Pending) and
 * reviews/[id]/page.tsx (edit mode, from Written) — spec 32 §4: "reuses
 * one ReviewEditor component in edit mode." */
export function ReviewEditor({ mode, mediaId, reviewId, onSaved }: ReviewEditorProps) {
  const client = useApiClient();
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const [media, setMedia] = useState<MediaSummary | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [loadingReview, setLoadingReview] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The API validates media_id as a uuid and 400s otherwise — catching it
  // here gives a real message instead of firing a doomed request.
  const invalidId = mode === 'create' ? !mediaId || !UUID_RE.test(mediaId) : !reviewId;

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;

    if (mode === 'create' && mediaId) {
      client
        .getMedia(mediaId)
        .then((data) => {
          if (!cancelled) setMedia(data as MediaSummary);
        })
        .catch(() => {
          if (!cancelled) setMediaError(true);
        });
    } else if (mode === 'edit' && reviewId) {
      client
        .getReview(reviewId)
        .then((review) => {
          if (cancelled) return;
          setBody(review.body);
          setIsSpoiler(review.isSpoiler);
          setVisibility(review.visibility as Visibility);
          if (review.media) setMedia(review.media);
          else setMediaError(true);
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load this review.");
        })
        .finally(() => {
          if (!cancelled) setLoadingReview(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [client, mediaId, reviewId, mode, invalidId]);

  const save = async () => {
    if (!body.trim() || invalidId || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create' && mediaId) {
        await client.createReview({
          media_id: mediaId,
          body: body.trim(),
          is_spoiler: isSpoiler,
          visibility,
        });
      } else if (mode === 'edit' && reviewId) {
        await client.updateReview(reviewId, {
          body: body.trim(),
          is_spoiler: isSpoiler,
          visibility,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your review. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const poster = media ? tmdbPosterUrl(media.posterPath, 'card') : null;

  if (loadingReview) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-20 w-14 shrink-0 animate-pulse rounded bg-neutral-900" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-neutral-900" />
            <div className="h-3 w-20 animate-pulse rounded bg-neutral-900" />
          </div>
        </div>
        <div className="h-40 w-full animate-pulse rounded-lg bg-neutral-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-1 text-2xl font-bold">{mode === 'edit' ? 'Edit Review' : 'Write Review'}</h1>
      {!invalidId && (
        <div className="mb-4 flex items-center gap-3">
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-neutral-800">
            {poster && <Image src={poster} alt="" fill className="object-cover" unoptimized />}
          </div>
          {media ? (
            <div>
              <p className="font-medium text-white">{media.title}</p>
              <p className="text-xs text-neutral-500">
                {media.year ?? '—'} · {media.displayType}
              </p>
            </div>
          ) : mediaError ? (
            <p className="text-sm text-neutral-500">Title unavailable</p>
          ) : (
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-neutral-900" />
              <div className="h-3 w-20 animate-pulse rounded bg-neutral-900" />
            </div>
          )}
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder="Your thoughts…"
        className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm"
      />
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} />
        Contains spoilers
      </label>
      <label className="mb-4 block text-sm">
        <span className="mb-1 block text-xs uppercase text-neutral-500">Who can see this</span>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          <option value="public">Public</option>
          <option value="friends">Friends</option>
          <option value="private">Private</option>
        </select>
      </label>
      {invalidId && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {mode === 'create'
            ? 'This review link is invalid. Open it from the Review Later list.'
            : 'This review link is invalid.'}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !body.trim() || invalidId}
          className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Review'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
