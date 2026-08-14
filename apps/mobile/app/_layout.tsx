import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MenuDrawer } from '@/components/MenuDrawer';
import { NotificationsProvider } from '@/lib/notifications';
import { FiltersProvider } from '@/lib/filters';
import { MenuProvider } from '@/lib/menu';
import { color } from '@/lib/theme';

function useAuthGuard() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let mounted = true;

    // Fast path: `getSession()` reads the locally persisted session with no
    // network round-trip, so a returning user reaches the app immediately
    // instead of waiting on a full server round-trip before first paint —
    // confirmed live as "the deck page ... is loading most of the time when
    // u first open it" (Deck's own fetch can't start until this resolves).
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
      setChecked(true);
    });

    // `getUser()` still runs, just no longer blocking first paint — it
    // round-trips to Supabase to catch a token whose underlying account no
    // longer exists (deleted user, revoked session), which a purely local
    // `getSession()` can't see. A failure here is best-effort only: it must
    // NOT downgrade `authed` to false, or a flaky network would log out
    // someone with a perfectly good locally cached session — the fast path
    // above already stands as the answer in that case.
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!mounted) return;
        setAuthed(!error && !!data.user);
        setChecked(true);
      })
      .catch(() => {});

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
                  <MenuProvider>
                    {/* MenuDrawer is a sibling of Stack, not a route — it renders
                        last so it overlays everything (tab bar included) as a
                        sliding side panel instead of navigating to a full page. */}
                    <View style={styles.root}>
                      {/* `contentStyle` matters here: without it the native stack
                          defaults each screen's container to white, which flashes
                          for a frame during a modal's slide-up (or any push)
                          before that screen's own dark View mounts and paints —
                          confirmed live as "a white page shows up for a second"
                          opening Filters. `animation: 'slide_from_bottom'` on the
                          modal screens is what actually makes them read as a
                          modal sliding up rather than a same-direction full page
                          push, which is otherwise indistinguishable on Android. */}
                      <Stack
                        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}
                      >
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="login" />
                        <Stack.Screen
                          name="review/[id]"
                          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                        />
                        <Stack.Screen
                          name="friends/add"
                          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                        />
                        <Stack.Screen
                          name="friends/notifications"
                          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                        />
                        <Stack.Screen name="friends/[id]" />
                        <Stack.Screen
                          name="filters"
                          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                        />
                      </Stack>
                      <MenuDrawer />
                    </View>
                  </MenuProvider>
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
