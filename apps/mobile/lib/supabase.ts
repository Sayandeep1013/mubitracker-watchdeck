import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Spec 08 "Auth": session must live in Expo SecureStore (Keychain/
// EncryptedSharedPreferences), not AsyncStorage's plaintext file — this was
// previously unswapped despite the dependency already being installed.
//
// Known caveat, unverified this session (no device): SecureStore enforces a
// ~2048-byte per-item limit on Android. This app only does password auth
// (no OAuth provider tokens), so the session JSON should normally stay well
// under that, but if a real device ever throws on setItemAsync for a
// oversized session blob, the fix is Supabase's documented "LargeSecureStore"
// pattern (AES-encrypt the session, store the ciphertext in AsyncStorage,
// keep only the small encryption key in SecureStore) — not implemented here
// since it pulls in expo-crypto + aes-js for a failure mode that hasn't
// actually been observed against this app's session shape.
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
    },
  },
);
