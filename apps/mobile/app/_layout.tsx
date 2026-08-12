import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/lib/supabase';

function useAuthGuard() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let mounted = true;

    // getUser() (not getSession()) round-trips to Supabase, so a token whose
    // underlying account no longer exists (deleted user, revoked session)
    // is caught here instead of silently passing a stale local session.
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      setAuthed(!error && !!data.user);
      setChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthed(!!session);
      setChecked(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!checked) return;
    const inLogin = segments[0] === 'login';
    if (!authed && !inLogin) {
      router.replace('/login');
    } else if (authed && inLogin) {
      router.replace('/(tabs)/deck');
    }
  }, [checked, authed, segments, router]);

  return checked;
}

export default function RootLayout() {
  const checked = useAuthGuard();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {checked && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="review/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      )}
    </GestureHandlerRootView>
  );
}
