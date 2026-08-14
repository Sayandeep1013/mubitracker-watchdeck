'use client';

import { useEffect } from 'react';

/** Route-segment error boundary (Next.js convention). Reports to
 * /api/v1/errors so the failure shows up in Vercel's server log dashboard —
 * a client `console.error` alone only reaches the browser console. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch('/api/v1/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        platform: 'web',
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg text-neutral-300">Something went wrong.</p>
      <p className="text-sm text-neutral-600">Try again, or reload the page.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
      >
        Try again
      </button>
    </div>
  );
}
