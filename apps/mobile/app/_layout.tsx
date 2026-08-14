import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotificationsProvider } from '@/lib/notifications';
import { FiltersProvider } from '@/lib/filters';
import { color } from '@/lib/theme';

function useAuthGuard() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let mounted = true;

    // getUser() (not getSession()) round-trips to Supabase, so a token whose
    // underlying account no longer exists (deleted user, revoked session) is
    // caught here instead of silently passing a stale local session.
    //
    // The .catch() is load-bearing: this call fails on a flaky/offline network,
    // and without it `checked` stayed false forever while the layout rendered
    // nothing — a permanent blank screen on app launch.
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!mounted) return;
        setAuthed(!error && !!data.user);
      })
      .catch(() => {
        // Network failure — treat as unauthenticated so the user reaches the
        // login screen and can retry, rather than being stuck on a blank view.
        if (mounted) setAuthed(false);
      })
      .finally(() => {
        if (mounted) setChecked(true);
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
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <ErrorBoundary>
          <ToastProvider>
            <StatusBar style="light" />
            {checked ? (
              <NotificationsProvider>
                <FiltersProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="review/[id]" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="friends/add" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="friends/notifications" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="friends/[id]" />
                    <Stack.Screen name="watch-later" />
                    <Stack.Screen name="about" />
                    <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="menu" options={{ presentation: 'modal' }} />
                  </Stack>
                </FiltersProvider>
              </NotificationsProvider>
            ) : (
              <View style={styles.splash} accessibilityLabel="Loading Mubitracker">
                <ActivityIndicator color={color.primary} size="large" />
              </View>
            )}
          </ToastProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },
});
