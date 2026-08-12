import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export interface FocusFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Manual re-run, for retry buttons. */
  reload: () => void;
}

/**
 * Fetch on every screen focus, with loading/error state.
 *
 * Tab screens stay mounted in expo-router, so a plain `useEffect(…, [])` runs
 * exactly once for the whole session — classify a title on the Deck tab and
 * Collection would still show its old status until the app restarted. Fetching
 * on focus is what keeps tabs consistent with each other.
 *
 * Also guarantees a `.catch()`: the previous screens had none, so any API
 * failure left a permanently blank view with no message and no way to retry.
 */
export function useFocusFetch<T>(fetcher: () => Promise<T>): FocusFetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest fetcher without making it a dependency — callers pass an
  // inline arrow, which would otherwise re-trigger the effect on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback((isActive: () => boolean) => {
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((result) => {
        if (isActive()) setData(result);
      })
      .catch((e: unknown) => {
        if (isActive()) setError(e instanceof Error ? e.message : 'Something went wrong');
      })
      .finally(() => {
        if (isActive()) setLoading(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      run(() => active);
      return () => {
        active = false;
      };
    }, [run]),
  );

  const reload = useCallback(() => {
    run(() => true);
  }, [run]);

  return { data, loading, error, reload };
}
