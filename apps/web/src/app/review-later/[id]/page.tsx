'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiClient } from '@/hooks/useApiClient';

export default function WriteReviewPage() {
  const { id: mediaId } = useParams<{ id: string }>();
  const client = useApiClient();
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await client.createReview({
        media_id: mediaId,
        body: body.trim(),
        is_spoiler: isSpoiler,
        visibility: 'friends',
      });
      router.push('/review-later');
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
      <button
        type="button"
        onClick={save}
        disabled={saving || !body.trim()}
        className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        Save Review
      </button>
    </div>
  );
}
