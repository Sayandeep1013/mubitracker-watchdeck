'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
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

  // The API validates media_id as a uuid and 400s otherwise. Catching it here
  // gives a real message instead of a silent no-op.
  const invalidId = !mediaId || !UUID_RE.test(mediaId);

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

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-2xl font-bold">Write Review</h1>
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
