'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MubitrackerClient } from '@mubitracker/shared';
import { useMemo } from 'react';

export function useApiClient() {
  return useMemo(() => {
    const supabase = createSupabaseBrowserClient();
    return new MubitrackerClient({
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
