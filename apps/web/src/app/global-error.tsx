'use client';

import { useEffect } from 'react';

/** Root-layout error boundary (Next.js convention) — catches errors the
 * root layout itself throws, which `error.tsx` can't (it's rendered
 * inside that layout). Must render its own <html>/<body>: this replaces
 * the whole document when it fires. */
export default function GlobalError({
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
    <html>
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#0a0a0a',
          color: '#d4d4d4',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ fontSize: '1.125rem' }}>Something went wrong.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            borderRadius: '0.5rem',
            backgroundColor: '#dc2626',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
