'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { WatchdeckClient } from '@watchdeck/shared';
import { useMemo } from 'react';

export function useApiClient() {
  return useMemo(() => {
    const supabase = createSupabaseBrowserClient();
    return new WatchdeckClient({
      baseUrl: '',
      getAccessToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
  }, []);
}

export function useSupabase() {
  return useMemo(() => createSupabaseBrowserClient(), []);
}
