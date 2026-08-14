import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dimensions, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import type { DeckItem, ReviewStatus, WatchStatus } from '@mubitracker/shared';
import { MAX_UNDO_STACK, deckFiltersToSearchParams, tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { enqueueOfflineAction, syncOfflineQueue } from '@/lib/offline-queue';
import { useFilters } from '@/lib/filters';
import { useToast } from '@/components/Toast';
import { color, glassChip, hitSlopFor, motion, radius, space, type } from '@/lib/theme';

type Action = 'unwatched' | 'watched' | 'watch_later' | 'review_later';
type ExitDirection = 'left' | 'right' | 'up' | 'down';

interface LastAction {
  mediaId: string;
  title: string;
  previousStatus: WatchStatus;
  previousReviewStatus: ReviewStatus;
  previousRejectCount: number;
  previousHiddenUntil: string | null;
}

const ACTION_META: Record<
  Action,
  { label: string; icon: keyof typeof Feather.glyphMap; tint: string; dir: ExitDirection }
> = {
  unwatched: { label: "Haven't", icon: 'x', tint: color.danger, dir: 'left' },
  watched: { label: 'Watched', icon: 'check', tint: color.success, dir: 'right' },
  watch_later: { label: 'Watch Later', icon: 'clock', tint: color.warning, dir: 'up' },
  review_later: { label: 'Review Later', icon: 'bookmark', tint: color.review, dir: 'down' },
};

// A distinct physical "feel" per action instead of the old two-bucket split
// (watched/unwatched both Medium, watch_later/review_later both Light) —
// confirmed live that felt indistinguishable by touch alone. Undo and the
// offline-save fallback stay on `notificationAsync` (a different haptic
// class entirely), so none of these six overlap.
//
// On Android, `impactAsync`/`notificationAsync` are NOT the real haptic
// engine — expo-haptics simulates them with the generic `Vibrator` API,
// which on most Android hardware reads as a mushy, elastic "spring" rather
// than a sharp click (confirmed live: "feels like spring, use some other
// clicky haptic"). `performAndroidHapticsAsync` instead fires Android's own
// `HapticFeedbackConstants` — the same primitives the OS keyboard/switches
// use — which land as genuine short clicks. iOS's impact styles are native
// (not simulated) and already felt right, so only Android branches here.
function fireActionHaptic(action: Action) {
  if (Platform.OS === 'android') {
    switch (action) {
      case 'watched':
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
        break;
      case 'unwatched':
        // AndroidHaptics.Reject is a compound double-buzz by OS design (it's
        // meant to read as "no/error", not a plain click) — confirmed live
        // as "double haptic" specifically on left-swipe/unwatched, the one
        // action using it. Long_Press is a single firm pulse instead.
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press);
        break;
      case 'watch_later':
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Toggle_On);
        break;
      case 'review_later':
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key);
        break;
    }
    return;
  }
  switch (action) {
    case 'watched':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case 'unwatched':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      break;
    case 'watch_later':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'review_later':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      break;
  }
}

function fireUndoHaptic() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click);
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

function fireErrorHaptic() {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject);
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

function hasFilterValues(filters: ReturnType<typeof useFilters>['filters']): boolean {
  return Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ''));
}

function filterKeys(filters: ReturnType<typeof useFilters>['filters']): string[] {
  return Object.entries(filters)
    .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ''))
    .map(([k]) => k);
}

// Reverted from a full-bleed poster back to a smaller framed card per
// explicit feedback — deliberately smaller than the screen on both axes,
// with visible "wiggle room" (background) around it on every side, and a
// double border (an outer frame with a gap, then the poster's own border)
// instead of the poster running edge to edge.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POSTER_WIDTH = Math.min(SCREEN_WIDTH * 0.68, 270);
const POSTER_MAX_HEIGHT = Math.round(POSTER_WIDTH * 1.5);
const FRAME_GAP = 5;
const FRAME_BORDER = 1.5;
// Header and tab bar are both transparent/floating on this screen now (see
// (tabs)/_layout.tsx) so the blurred backdrop shows through behind them
// instead of being cut off by solid chrome — which means this screen's own
// content has to reserve that space manually instead of getting it for
// free. Approximate standard Material heights; not pixel-exact, but close
// enough that nothing sits under the header/tab bar.
const HEADER_HEIGHT = 56;
const TAB_BAR_HEIGHT = 56;
const POSTER_BORDER = 2;

export default function DeckScreen() {
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const navigation = useNavigation();
  const router = useRouter();
  // Friends → Their Deck (spec 40 §3) navigates here with these params —
  // matches web's `?friend_id=&friend_mode=` handling in DeckView.tsx.
  const { friend_id: friendId, friend_mode: friendMode } = useLocalSearchParams<{
    friend_id?: string;
    friend_mode?: string;
  }>();
  const { filters, activeCount } = useFilters();
  const [queue, setQueue] = useState<DeckItem[]>([]);
  const [index, setIndex] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Bucket mode (DECK_ENGINE=v2) has no cursor — "more" always exists by
  // construction, so exhaustion is tracked explicitly rather than inferred
  // from a falsy cursor (see web DeckView.tsx for the same pattern).
  const engineMode = useRef<'v1' | 'v2' | null>(null);
  const [deckExhausted, setDeckExhausted] = useState(false);
  // Multi-level undo (spec 40 §4.5) — matches web's MAX_UNDO_STACK-deep
  // stack (packages/shared/src/constants/tmdb.ts) rather than remembering
  // only the single most recent action.
  const [undoStack, setUndoStack] = useState<LastAction[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [imdbLoading, setImdbLoading] = useState(false);
  const [exitDirection, setExitDirection] = useState<ExitDirection | null>(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragOpacity = useSharedValue(1);
  const enterOpacity = useSharedValue(1);
  const enterScale = useSharedValue(1);
  const enterTranslateY = useSharedValue(0);
  // Mirrors `busy.current` but readable from the gesture worklet (UI
  // thread) — a ref can't be read there. Without this, starting a new drag
  // while the previous card is still mid-exit would overwrite tx/ty out
  // from under the in-flight withTiming animation.
  const busyShared = useSharedValue(false);

  const fetching = useRef(false);
  const busy = useRef(false);
  // A filter change swaps the deck's contents in place rather than emptying
  // it first — see the `[filters]` effect and `setQueue` below.
  const pendingReplace = useRef(false);
  const queuedReload = useRef(false);
  const loadDeckRef = useRef<
    (o?: { cursor: string | null; sessionId: string | null }, r?: 'initial' | 'filter_change') => void
  >(() => {});
  // Analytics (spec 50 §6) — mirrors web DeckView.tsx's refs.
  const filtersApplied = useRef(false);
  const batchesServedThisSession = useRef(0);
  const cardShownAt = useRef(Date.now());

  const current = queue[index];

  useEffect(() => {
    if (current) cardShownAt.current = Date.now();
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDeck = useCallback(async (
    overrides?: { cursor: string | null; sessionId: string | null },
    reason?: 'initial' | 'filter_change',
  ) => {
    if (fetching.current) {
      // A filter change landing mid-prefetch must not be dropped. Now that
      // the queue stays populated across a filter change, nothing else would
      // retrigger the load, and the deck would keep serving the previous
      // filter set's cards indefinitely.
      if (overrides) queuedReload.current = true;
      return;
    }
    fetching.current = true;
    // On a filter change the caller passes explicit nulls — cursor/sessionId
    // state resets haven't committed yet, so reading the closure's `cursor`/
    // `sessionId` here would still reuse the previous filter set's values.
    const activeCursor = overrides ? overrides.cursor : cursor;
    const activeSessionId = overrides ? overrides.sessionId : sessionId;
    const fetchStart = Date.now();
    try {
      await syncOfflineQueue();
      const params = deckFiltersToSearchParams(filters);
      if (friendId) {
        params.set('friend_id', friendId);
        if (friendMode) params.set('friend_mode', friendMode);
      }
      if (engineMode.current !== 'v2') {
        if (activeCursor) params.set('cursor', activeCursor);
        if (activeSessionId) params.set('session_id', activeSessionId);
      }
      const data = await apiClient.getDeck(params);
      const latencyMs = Date.now() - fetchStart;
      if (engineMode.current === null) engineMode.current = data.bucketId ? 'v2' : 'v1';

      // A filter change replaces the deck outright; every other load appends.
      // Deliberately NOT done by clearing the queue up front: that left
      // `current` undefined for the whole round-trip, and since
      // `initialLoadDone` is already true by then, the Deck rendered its
      // "No titles match — try again later" empty state for a few hundred ms
      // on every Apply — confirmed live as the flicker closing Filters.
      const replacing = pendingReplace.current;
      setQueue((q) => {
        if (replacing) return data.items;
        const seen = new Set(q.map((item) => item.id));
        return [...q, ...data.items.filter((item) => !seen.has(item.id))];
      });
      if (replacing) {
        setIndex(0);
        pendingReplace.current = false;
      }
      if (engineMode.current === 'v2') {
        setDeckExhausted(data.items.length === 0 && Boolean(data.reason));
      } else {
        setCursor(data.cursor ?? null);
        setSessionId(data.sessionId ?? null);
      }
      setLoadError(null);

      batchesServedThisSession.current += 1;
      const filtered = hasFilterValues(filters);
      const keys = filterKeys(filters);
      apiClient.trackEvent({
        event: 'deck_batch_served',
        properties: {
          count: data.items.length,
          latency_ms: latencyMs,
          filtered,
          filter_keys: keys,
          cursor_null: engineMode.current === 'v1' ? data.cursor == null : false,
          source: overrides ? 'cold' : 'prefetch',
        },
      });
      if (reason === 'filter_change') {
        apiClient.trackEvent({
          event: 'filter_applied',
          properties: { filter_keys: keys, preset: false, latency_ms: latencyMs, result_count: data.items.length },
        });
      }
      if (data.items.length === 0) {
        apiClient.trackEvent({
          event: 'deck_empty',
          properties: { filtered, filter_keys: keys, batches_served_this_session: batchesServedThisSession.current },
        });
      }
    } catch (err) {
      // Only surface the error if we have nothing cached to show instead —
      // a mid-session hiccup with an already-loaded queue shouldn't interrupt.
      setQueue((q) => {
        if (q.length === 0) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load deck');
        }
        return q;
      });
    } finally {
      fetching.current = false;
      setInitialLoadDone(true);
      if (queuedReload.current) {
        queuedReload.current = false;
        loadDeckRef.current({ cursor: null, sessionId: null }, 'filter_change');
      }
    }
  }, [cursor, sessionId, friendId, friendMode, filters]);

  loadDeckRef.current = loadDeck;

  useEffect(() => {
    // The queue is intentionally left alone here — emptying it is what made
    // the Deck flash its empty state while the new filter set loaded. It gets
    // replaced atomically in `loadDeck` once the replacement data lands.
    pendingReplace.current = true;
    setCursor(null);
    setSessionId(null);
    setDeckExhausted(false);
    setLoadError(null);
    engineMode.current = null;
    batchesServedThisSession.current = 0;
    loadDeck({ cursor: null, sessionId: null }, filtersApplied.current ? 'filter_change' : 'initial');
    filtersApplied.current = true;
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fetching.current) return;
    if (engineMode.current === 'v2') {
      if (index >= queue.length - 15 && !deckExhausted) loadDeck();
      return;
    }
    if (index >= queue.length - 5) loadDeck();
  }, [index, queue.length, deckExhausted, loadDeck]);

  const advanceAfterExit = useCallback(
    () => {
      tx.value = 0;
      ty.value = 0;
      dragOpacity.value = 1;
      enterOpacity.value = 0;
      enterScale.value = 0.94;
      enterTranslateY.value = 14;
      setExitDirection(null);
      setIndex((i) => i + 1);
      busy.current = false;
      busyShared.value = false;
      // Opacity fades in on a smooth deceleration curve; scale/position
      // settle with a (non-bouncy) spring instead — springs read as more
      // natural/smooth than a timing curve for this kind of "settle into
      // place" motion, confirmed live the old shared-with-exit easing felt
      // "snappy" here specifically.
      enterOpacity.value = withTiming(1, { duration: motion.ENTER_DURATION, easing: motion.ENTER_EASING });
      enterScale.value = withSpring(1, motion.ENTER_SPRING);
      enterTranslateY.value = withSpring(0, motion.ENTER_SPRING);
    },
    [busyShared, dragOpacity, enterOpacity, enterScale, enterTranslateY, tx, ty],
  );

  const performAction = useCallback(
    async (action: Action, input: 'swipe' | 'button' = 'button') => {
      if (!current) return;
      const prevStatus = current.userStatus ?? 'unwatched';
      const prevReview = current.userReviewStatus ?? 'none';
      const msSinceCardShown = Date.now() - cardShownAt.current;
      setUndoStack((s) =>
        [
          {
            mediaId: current.id,
            title: current.title,
            previousStatus: prevStatus,
            previousReviewStatus: prevReview,
            previousRejectCount: current.userRejectCount ?? 0,
            previousHiddenUntil: current.userHiddenUntil ?? null,
          },
          ...s,
        ].slice(0, MAX_UNDO_STACK),
      );

      apiClient.trackEvent({
        event: 'media_classified',
        properties: {
          media_id: current.id,
          status: action,
          input,
          ms_since_card_shown: msSinceCardShown,
          platform: 'mobile',
        },
      });

      fireActionHaptic(action);

      try {
        if (action === 'review_later') {
          await apiClient.reviewLater(current.id);
        } else if (action === 'watch_later') {
          await apiClient.watchLater(current.id);
        } else {
          await apiClient.updateUserMedia(current.id, { status: action, review_status: prevReview });
        }
      } catch {
        fireErrorHaptic();
        await enqueueOfflineAction({
          mediaId: current.id,
          status: action === 'review_later' ? 'watched' : action,
          reviewStatus: action === 'review_later' ? 'pending' : 'none',
          timestamp: new Date().toISOString(),
        });
        showToast({ message: 'Saved offline — will sync when back online', tone: 'warning' });
      }
    },
    [current, showToast],
  );

  const commitExit = useCallback(
    (action: Action, input: 'swipe' | 'button' = 'swipe') => {
      if (!current || busy.current) return;
      busy.current = true;
      busyShared.value = true;
      setExitDirection(ACTION_META[action].dir);

      const { width, height } = Dimensions.get('window');
      const cfg = { duration: motion.EXIT_DURATION, easing: motion.EXIT_EASING };
      const dir = ACTION_META[action].dir;
      if (dir === 'left' || dir === 'right') {
        tx.value = withTiming((dir === 'right' ? 1 : -1) * width * 1.25, cfg);
      } else {
        ty.value = withTiming((dir === 'down' ? 1 : -1) * height * 0.9, cfg);
      }
      dragOpacity.value = withTiming(0, { duration: 180 }, (done) => {
        if (done) runOnJS(advanceAfterExit)();
      });

      performAction(action, input);
    },
    [advanceAfterExit, busyShared, current, dragOpacity, performAction, tx, ty],
  );

  const openImdb = async () => {
    if (!current || imdbLoading) return;
    setImdbLoading(true);
    try {
      const { imdbUrl } = await apiClient.getImdbLink(current.id);
      if (imdbUrl) await Linking.openURL(imdbUrl);
    } catch {
      // silently ignore — non-critical, secondary action
    } finally {
      setImdbLoading(false);
    }
  };

  const handleUndo = async () => {
    const lastAction = undoStack[0];
    if (!lastAction || undoing) return;
    const depth = undoStack.length;
    setUndoing(true);
    fireUndoHaptic();
    setIndex((i) => Math.max(0, i - 1));
    try {
      await apiClient.undo({
        media_id: lastAction.mediaId,
        previous_status: lastAction.previousStatus,
        previous_review_status: lastAction.previousReviewStatus,
        previous_reject_count: lastAction.previousRejectCount,
        previous_hidden_until: lastAction.previousHiddenUntil,
      });
      apiClient.trackEvent({
        event: 'undo_used',
        properties: { depth, restored_status: lastAction.previousStatus, platform: 'mobile' },
      });
      showToast({ message: 'Undone', tone: 'neutral' });
    } catch {
      await enqueueOfflineAction({
        mediaId: lastAction.mediaId,
        status: lastAction.previousStatus,
        reviewStatus: lastAction.previousReviewStatus,
        timestamp: new Date().toISOString(),
      });
      showToast({ message: 'Undo saved offline — will sync when back online', tone: 'warning' });
    } finally {
      setUndoStack((s) => s.slice(1));
      setUndoing(false);
    }
  };

  // Undo used to be a chip sitting on top of the poster — moved into the
  // header next to Filters instead, per explicit ask, so it's not on the
  // artwork itself. Overrides the Tabs.Screen's static headerRight
  // (defined in (tabs)/_layout.tsx) with one that also knows about this
  // screen's own undoStack; re-runs whenever the things it renders change.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightRow}>
          {undoStack.length > 0 && (
            <Pressable
              onPress={handleUndo}
              disabled={undoing}
              hitSlop={hitSlopFor(28)}
              style={({ pressed }) => [styles.headerUndoBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Undo marking ${undoStack[0].title}`}
              accessibilityState={{ disabled: undoing }}
            >
              <Feather name="rotate-ccw" size={15} color={color.primary} />
              <Text style={styles.headerUndoText}>{undoing ? 'Undoing…' : 'Undo'}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/filters')}
            hitSlop={8}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
          >
            <Feather name="sliders" color={color.text} size={20} />
            {activeCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{activeCount > 9 ? '9+' : activeCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, undoStack, undoing, activeCount, router]);

  const pan = Gesture.Pan()
    // Used to also fire a `selectionAsync` haptic here the moment a drag
    // crossed the cue threshold, on top of `fireActionHaptic` on commit —
    // confirmed live that read as "two separate haptics" for one swipe,
    // not the intended cue-then-commit sequence. Now exactly one haptic
    // per action, fired only on commit; the visual cue (corner stamps
    // fading in) is untouched, since that's driven by tx/ty directly.
    .onUpdate((e) => {
      if (busyShared.value) return;
      tx.value = e.translationX;
      ty.value = e.translationY;
      dragOpacity.value = 1 - Math.min(Math.abs(e.translationX) / 300, 0.3);
    })
    .onEnd((e) => {
      if (busyShared.value) return;
      // A fast flick commits even short of the distance threshold — a
      // quick flick and a slow deliberate drag both read as "intentional"
      // to a person, so both should be able to commit; requiring flicks to
      // travel just as far as a slow drag is what made this feel tiring.
      // `horizontalDominant` picks which axis's thresholds apply so a
      // mostly-vertical flick can't accidentally register a stray
      // horizontal velocity component as a left/right commit, and vice
      // versa.
      const horizontalDominant = Math.abs(e.translationX) >= Math.abs(e.translationY);
      if (horizontalDominant) {
        const fastRight = e.velocityX > motion.VELOCITY_THRESHOLD && e.translationX > 20;
        const fastLeft = e.velocityX < -motion.VELOCITY_THRESHOLD && e.translationX < -20;
        if (e.translationX > motion.SWIPE_THRESHOLD_X || fastRight) {
          runOnJS(commitExit)('watched', 'swipe');
          return;
        }
        if (e.translationX < -motion.SWIPE_THRESHOLD_X || fastLeft) {
          runOnJS(commitExit)('unwatched', 'swipe');
          return;
        }
      } else {
        const fastUp = e.velocityY < -motion.VELOCITY_THRESHOLD && e.translationY < -20;
        const fastDown = e.velocityY > motion.VELOCITY_THRESHOLD && e.translationY > 20;
        if (e.translationY < -motion.SWIPE_THRESHOLD_Y || fastUp) {
          runOnJS(commitExit)('watch_later', 'swipe');
          return;
        }
        if (e.translationY > motion.SWIPE_THRESHOLD_Y || fastDown) {
          runOnJS(commitExit)('review_later', 'swipe');
          return;
        }
      }
      tx.value = withSpring(0, motion.SPRING);
      ty.value = withSpring(0, motion.SPRING);
      dragOpacity.value = withTiming(1, { duration: 150 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + enterTranslateY.value },
      { rotate: `${tx.value * motion.ROTATION_FACTOR}deg` },
      { scale: enterScale.value },
    ],
    opacity: dragOpacity.value * enterOpacity.value,
  }));

  const rightCueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [motion.CUE_THRESHOLD_X, motion.SWIPE_THRESHOLD_X], [0, 1], Extrapolation.CLAMP),
  }));
  const leftCueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [motion.CUE_THRESHOLD_X, motion.SWIPE_THRESHOLD_X], [0, 1], Extrapolation.CLAMP),
  }));
  const upCueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-ty.value, [motion.CUE_THRESHOLD_Y, motion.SWIPE_THRESHOLD_Y], [0, 1], Extrapolation.CLAMP),
  }));
  const downCueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [motion.CUE_THRESHOLD_Y, motion.SWIPE_THRESHOLD_Y], [0, 1], Extrapolation.CLAMP),
  }));

  if (!current) {
    if (!initialLoadDone) {
      return (
        <View style={[styles.center, { paddingTop: insets.top + HEADER_HEIGHT }]} accessibilityLabel="Loading deck">
          <Text style={styles.muted}>Loading deck…</Text>
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={[styles.center, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            onPress={() => {
              setLoadError(null);
              setInitialLoadDone(false);
              loadDeck();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the deck"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={[styles.center, { paddingTop: insets.top + HEADER_HEIGHT }]}>
        <Text style={styles.muted}>No titles match — try again later</Text>
      </View>
    );
  }

  const poster = tmdbPosterUrl(current.posterPath, 'deck');

  // Solely gesture-driven by design (no button fallback) — the hint text
  // below is the one piece of UI carrying that entire burden, which is why
  // it's brighter/bolder than a typical caption instead of the usual quiet
  // mnemonic row.
  return (
    <View style={styles.container}>
      {/* A plain black background read as "off" — this is the poster's own
          artwork blurred into an ambient backdrop (RN Image's native
          blurRadius, no extra processing needed) with a frosted BlurView
          on top for the actual "glass" quality, instead of a separate
          color-extraction step. Every card gets its own backdrop for free
          since it's just the same image, blurred. Deliberately NOT inside
          `content` below — it fills the entire screen, unpadded, so it
          shows through behind the now-transparent header and floating tab
          bar instead of stopping at their old solid edges. */}
      {poster && (
        <>
          <Image
            source={{ uri: poster }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            blurRadius={35}
          />
          <View style={styles.backdropScrim} />
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
        </>
      )}

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: insets.bottom + TAB_BAR_HEIGHT },
        ]}
      >
        <Text style={styles.hint}>← Haven&apos;t</Text>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>↑ Watch Later</Text>
          <Text style={styles.hint}>↓ Review Later</Text>
        </View>
        <Text style={styles.hint}>Watched →</Text>

        <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          {/* Double border: a thin outer frame with a visible gap, then the
              poster's own (thicker, accent-colored) border — a picture-mat
              look instead of the poster running edge to edge. */}
          <View style={styles.frameOuter}>
            <View style={styles.posterWrap}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]} />
              )}

              {/* Tinder-style verdict stamps for the two most common
                  actions — a rotated bordered badge in the corner the card
                  is heading toward, fading in with drag distance. */}
              <Animated.View
                style={[
                  styles.stamp,
                  { top: space.sm, left: space.sm, borderColor: color.success, transform: [{ rotate: '-12deg' }] },
                  rightCueStyle,
                ]}
                pointerEvents="none"
              >
                <Feather name="check" size={18} color={color.success} />
                <Text style={[styles.stampText, { color: color.success }]}>WATCHED</Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.stamp,
                  { top: space.sm, right: space.sm, borderColor: color.danger, transform: [{ rotate: '12deg' }] },
                  leftCueStyle,
                ]}
                pointerEvents="none"
              >
                <Feather name="x" size={18} color={color.danger} />
                <Text style={[styles.stampText, { color: color.danger }]}>HAVEN&apos;T</Text>
              </Animated.View>
              <Animated.View style={[styles.cue, styles.cueUp, upCueStyle]} pointerEvents="none">
                <Feather name="clock" size={44} color={color.warning} />
              </Animated.View>
              <Animated.View style={[styles.cue, styles.cueDown, downCueStyle]} pointerEvents="none">
                <Feather name="bookmark" size={44} color={color.review} />
              </Animated.View>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {current.title}
          </Text>
          <Text style={styles.meta}>
            {current.year ?? '—'} · {current.displayType}
            {current.originalLanguage ? ` · ${current.originalLanguage.toUpperCase()}` : ''}
          </Text>
          {current.genres?.length ? (
            <View style={styles.genreRow}>
              {current.genres.slice(0, 3).map((genre) => (
                <View key={genre} style={[styles.genreChip, glassChip()]}>
                  <Text style={styles.genreChipText}>{genre}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {current.overview ? (
            <Text style={styles.premise} numberOfLines={3}>
              {current.overview}
            </Text>
          ) : null}
          <Pressable
            onPress={openImdb}
            disabled={imdbLoading}
            hitSlop={12}
            style={styles.imdbHit}
            accessibilityRole="link"
            accessibilityLabel={`Open ${current.title} on IMDb`}
          >
            <Text style={styles.imdbLink}>{imdbLoading ? 'Opening…' : 'IMDb ↗'}</Text>
          </Pressable>
        </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Unpadded — the blurred backdrop is a direct child of this so it fills
  // the literal full screen, behind the transparent header/tab bar. All
  // the actual padding/centering lives on `content` instead.
  container: { flex: 1, backgroundColor: color.bg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  posterPlaceholder: { backgroundColor: color.surfaceHigh },
  // Scrim between the blurred poster backdrop and the frosted BlurView on
  // top of it — keeps the ambient color from either washing out the frame
  // (too bright) or going fully black (defeats the point of it).
  backdropScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.45)' },
  hintRow: { flexDirection: 'row', gap: space.lg },
  hint: { color: color.textMuted, fontSize: type.caption.fontSize, fontWeight: '700', marginVertical: 2 },
  pressed: { opacity: 0.7 },
  card: { alignItems: 'center', width: '100%' },
  // Double border: a thin outer frame (`frameOuter`) with a gap around a
  // thicker, accent-colored inner border (`posterWrap`) — a picture-mat
  // look, and the gap + outer frame are exactly the "wiggle room" that a
  // plain single-border poster didn't have.
  frameOuter: {
    padding: FRAME_GAP,
    borderWidth: FRAME_BORDER,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(24,24,27,0.5)',
  },
  posterWrap: {
    width: POSTER_WIDTH,
    height: POSTER_MAX_HEIGHT,
    borderWidth: POSTER_BORDER,
    borderColor: color.primary,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  poster: { width: '100%', height: '100%' },
  // Header row (Undo + Filters) — injected via navigation.setOptions in
  // the component body, not rendered here directly, but styled here
  // alongside everything else on this screen.
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginRight: space.sm },
  // Deep-black-and-red instead of a flat gray/black block — confirmed live
  // the solid surfaceHigh fill read as a stray dark blob in the header,
  // same complaint as the hamburger's old background circle.
  headerUndoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: color.primary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  headerUndoText: { color: color.primary, fontSize: type.caption.fontSize, fontWeight: '700' },
  headerBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  errorText: { color: color.danger, fontSize: type.body.fontSize, textAlign: 'center', marginBottom: space.lg },
  retryButton: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryText: { color: color.text, fontWeight: '600' },
  cue: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  cueUp: { backgroundColor: `${color.warning}33` },
  cueDown: { backgroundColor: `${color.review}33` },
  stamp: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2.5,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(9,9,11,0.45)',
  },
  stampText: { fontSize: type.caption.fontSize, fontWeight: '800', letterSpacing: 0.5 },
  title: {
    color: color.text,
    ...type.title,
    textAlign: 'center',
    marginTop: space.md,
  },
  meta: { color: color.textMuted, fontSize: type.body.fontSize, marginTop: space.xs, textAlign: 'center' },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.sm,
    paddingHorizontal: space.lg,
  },
  genreChip: { paddingVertical: 3, paddingHorizontal: 10 },
  genreChipText: { color: color.primary, fontSize: type.caption.fontSize, fontWeight: '700' },
  premise: {
    color: color.textMuted,
    fontSize: type.caption.fontSize,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: space.sm,
    paddingHorizontal: space.xl,
  },
  imdbHit: { minHeight: 32, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  imdbLink: { color: color.textMuted, fontSize: type.caption.fontSize, fontWeight: '600' },
  muted: { color: color.textMuted },
});
