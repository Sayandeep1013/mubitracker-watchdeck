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
    // There's no `app/index.tsx`, so a cold launch with no deep link (or an
    // unrecognized/stale path) resolves to expo-router's built-in Unmatched
    // Route screen, not any segment we own — confirmed live as the app
    // getting stuck on "Unmatched Route" after a fresh install that still
    // carried over a persisted session (`adb install -r` keeps app data).
    // The old `authed && inLogin` check only ever rescued someone off the
    // login screen, so an authed user landing anywhere else unrecognized
    // (root, unmatched) was never sent home. Recognize every top-level
    // segment this Stack actually declares, and treat anything outside
    // that set as "needs to be routed home" instead of just "login".
    const inApp =
      segments[0] === '(tabs)' ||
      segments[0] === 'review' ||
      segments[0] === 'friends' ||
      segments[0] === 'filters';
    if (!authed && !inLogin) {
      router.replace('/login');
    } else if (authed && !inApp) {
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
                          for a frame during a slide-up (or any push) before that
                          screen's own dark View mounts and paints — confirmed
                          live as "a white page shows up for a second" opening
                          Filters.

                          Dropping `presentation: 'modal'` is deliberate: with
                          modal presentation Android hands the screen to a
                          separate native container carrying the app theme's own
                          (white) window background, which is where the white
                          flash on close came from. */}
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: color.bg },
                          // `slide_from_right`, NOT `slide_from_bottom`: on
                          // Android this version of react-native-screens
                          // animates slide_from_bottom on push but cuts
                          // instantly on pop — "it just stops suddenly".
                          // Established by high-rate on-device capture
                          // (screencap looping on the device itself, ~100ms
                          // apart, so a sub-200ms transition can't hide between
                          // frames): opening reliably produced a mid-slide
                          // frame, closing produced ZERO intermediate frames
                          // across every run and both triggers (Close button
                          // and hardware back). Switching only the animation to
                          // slide_from_right made an intermediate pop frame
                          // appear immediately, with nothing else changed.
                          // `animationDuration` is deliberately absent — it is
                          // iOS-only, so it was a no-op on Android throughout.
                          animation: 'slide_from_right',
                        }}
                      >
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="login" />
                        <Stack.Screen
                          name="review/[id]"
                          options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                          name="friends/add"
                          options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                          name="friends/notifications"
                          options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen name="friends/[id]" />
                        {/* Filters is the one screen that should read as a
                            sheet coming up and going back down, not a sideways
                            page push. */}
                        <Stack.Screen
                          name="filters"
                          options={{
                            // `animation: 'none'` is deliberate: filters.tsx
                            // animates its own sheet with Reanimated, which is
                            // the only way to get a symmetric up/down here (see
                            // the note there). A native animation on top of
                            // that would double up. `transparentModal` +
                            // transparent contentStyle keep the Deck visible
                            // behind the sheet while it travels.
                            presentation: 'transparentModal',
                            animation: 'none',
                            contentStyle: { backgroundColor: 'transparent' },
                          }}
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
