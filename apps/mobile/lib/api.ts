import { MubitrackerClient } from '@mubitracker/shared';
import { supabase } from './supabase';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = new MubitrackerClient({
  baseUrl,
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
