'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { tmdbPosterUrl, type MediaSummary } from '@mubitracker/shared';
import { useApiClient } from '@/hooks/useApiClient';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function WriteReviewPage() {
  const { id: mediaId } = useParams<{ id: string }>();
  const client = useApiClient();
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaSummary | null>(null);
  const [mediaError, setMediaError] = useState(false);

  // The API validates media_id as a uuid and 400s otherwise. Catching it here
  // gives a real message instead of a silent no-op.
  const invalidId = !mediaId || !UUID_RE.test(mediaId);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    client
      .getMedia(mediaId)
      .then((data) => {
        if (!cancelled) setMedia(data as MediaSummary);
      })
      .catch(() => {
        if (!cancelled) setMediaError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [client, mediaId, invalidId]);

  const save = async () => {
    if (!body.trim() || invalidId) return;
    setSaving(true);
    setError(null);
    try {
      await client.createReview({
        media_id: mediaId,
        body: body.trim(),
        is_spoiler: isSpoiler,
        visibility: 'friends',
      });
      router.push('/review-later');
    } catch (e) {
      // Previously try/finally with no catch: a 400 left the UI unchanged and
      // the user with no idea the review had not saved.
      setError(e instanceof Error ? e.message : 'Could not save your review. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const poster = media ? tmdbPosterUrl(media.posterPath, 'card') : null;

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-1 text-2xl font-bold">Write Review</h1>
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
        <input
          type="checkbox"
          checked={isSpoiler}
          onChange={(e) => setIsSpoiler(e.target.checked)}
        />
        Contains spoilers
      </label>
      {invalidId && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          This review link is invalid. Open it from the Review Later list.
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
      <button
        type="button"
        onClick={save}
        disabled={saving || !body.trim() || invalidId}
        className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Review'}
      </button>
    </div>
  );
}
