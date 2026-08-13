import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { color, motion, radius, space, type } from '@/lib/theme';

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

function hasFilterValues(filters: ReturnType<typeof useFilters>['filters']): boolean {
  return Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ''));
}

function filterKeys(filters: ReturnType<typeof useFilters>['filters']): string[] {
  return Object.entries(filters)
    .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ''))
    .map(([k]) => k);
}

export default function DeckScreen() {
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  // Friends → Their Deck (spec 40 §3) navigates here with these params —
  // matches web's `?friend_id=&friend_mode=` handling in DeckView.tsx.
  const { friend_id: friendId, friend_mode: friendMode } = useLocalSearchParams<{
    friend_id?: string;
    friend_mode?: string;
  }>();
  const { filters } = useFilters();
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
  const [selectedAction, setSelectedAction] = useState<Action>('unwatched');
  const stickyAction = useRef<Action>('unwatched');
  const [exitDirection, setExitDirection] = useState<ExitDirection | null>(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragOpacity = useSharedValue(1);
  const enterOpacity = useSharedValue(1);
  const enterScale = useSharedValue(1);
  const enterTranslateY = useSharedValue(0);
  const cueLatched = useSharedValue(false);
  // Mirrors `busy.current` but readable from the gesture worklet (UI
  // thread) — a ref can't be read there. Without this, starting a new drag
  // while the previous card is still mid-exit would overwrite tx/ty out
  // from under the in-flight withTiming animation.
  const busyShared = useSharedValue(false);

  const fetching = useRef(false);
  const busy = useRef(false);
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
    if (fetching.current) return;
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

      setQueue((q) => {
        const seen = new Set(q.map((item) => item.id));
        return [...q, ...data.items.filter((item) => !seen.has(item.id))];
      });
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
    }
  }, [cursor, sessionId, friendId, friendMode, filters]);

  useEffect(() => {
    setQueue([]);
    setIndex(0);
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
    (action: Action) => {
      tx.value = 0;
      ty.value = 0;
      dragOpacity.value = 1;
      enterOpacity.value = 0;
      enterScale.value = 0.94;
      enterTranslateY.value = 12;
      setExitDirection(null);
      setIndex((i) => i + 1);
      // Sticky: keep the last ←/→ selection across ↑/↓ actions too (matches
      // web DeckView.tsx's advance()) — only watched/unwatched update the
      // sticky ref itself, read here rather than derived from `action`.
      const sticky =
        stickyAction.current === 'watched' || stickyAction.current === 'unwatched'
          ? stickyAction.current
          : 'unwatched';
      setSelectedAction(sticky);
      busy.current = false;
      busyShared.value = false;
      enterOpacity.value = withTiming(1, { duration: motion.ENTER_DURATION, easing: motion.EXIT_EASING });
      enterScale.value = withTiming(1, { duration: motion.ENTER_DURATION, easing: motion.EXIT_EASING });
      enterTranslateY.value = withTiming(0, { duration: motion.ENTER_DURATION, easing: motion.EXIT_EASING });
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

      Haptics.impactAsync(
        action === 'watched' || action === 'unwatched'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );

      try {
        if (action === 'review_later') {
          await apiClient.reviewLater(current.id);
        } else if (action === 'watch_later') {
          await apiClient.watchLater(current.id);
        } else {
          await apiClient.updateUserMedia(current.id, { status: action, review_status: prevReview });
        }
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
    (action: Action, input: 'swipe' | 'button' = 'button') => {
      if (!current || busy.current) return;
      busy.current = true;
      busyShared.value = true;
      if (action === 'watched' || action === 'unwatched') stickyAction.current = action;
      setExitDirection(ACTION_META[action].dir);
      cueLatched.value = false;

      const { width, height } = Dimensions.get('window');
      const cfg = { duration: motion.EXIT_DURATION, easing: motion.EXIT_EASING };
      const dir = ACTION_META[action].dir;
      if (dir === 'left' || dir === 'right') {
        tx.value = withTiming((dir === 'right' ? 1 : -1) * width * 1.25, cfg);
      } else {
        ty.value = withTiming((dir === 'down' ? 1 : -1) * height * 0.9, cfg);
      }
      dragOpacity.value = withTiming(0, { duration: 180 }, (done) => {
        if (done) runOnJS(advanceAfterExit)(action);
      });

      performAction(action, input);
    },
    [advanceAfterExit, busyShared, current, dragOpacity, performAction, tx, ty, cueLatched],
  );

  const handleConfirm = useCallback(() => {
    commitExit(selectedAction, 'button');
  }, [commitExit, selectedAction]);

  const handleSelectAction = useCallback((action: Action) => {
    if (action === 'watched' || action === 'unwatched') stickyAction.current = action;
    setSelectedAction(action);
  }, []);

  const triggerCueHaptic = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const pan = Gesture.Pan()
    .onBegin(() => {
      cueLatched.value = false;
    })
    .onUpdate((e) => {
      if (busyShared.value) return;
      tx.value = e.translationX;
      ty.value = e.translationY;
      dragOpacity.value = 1 - Math.min(Math.abs(e.translationX) / 300, 0.3);
      const crossed =
        Math.abs(e.translationX) > motion.CUE_THRESHOLD_X ||
        Math.abs(e.translationY) > motion.CUE_THRESHOLD_Y;
      if (crossed && !cueLatched.value) {
        cueLatched.value = true;
        runOnJS(triggerCueHaptic)();
      }
    })
    .onEnd((e) => {
      if (busyShared.value) return;
      if (e.translationX > motion.SWIPE_THRESHOLD_X) {
        runOnJS(commitExit)('watched', 'swipe');
        return;
      }
      if (e.translationX < -motion.SWIPE_THRESHOLD_X) {
        runOnJS(commitExit)('unwatched', 'swipe');
        return;
      }
      if (e.translationY < -motion.SWIPE_THRESHOLD_Y) {
        runOnJS(commitExit)('watch_later', 'swipe');
        return;
      }
      if (e.translationY > motion.SWIPE_THRESHOLD_Y) {
        runOnJS(commitExit)('review_later', 'swipe');
        return;
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
        <View style={[styles.center, { paddingTop: insets.top }]} accessibilityLabel="Loading deck">
          <Text style={styles.muted}>Loading deck…</Text>
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={[styles.center, { paddingTop: insets.top }]}>
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
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>No titles match — try again later</Text>
      </View>
    );
  }

  const poster = tmdbPosterUrl(current.posterPath, 'deck');

  return (
    <View style={[styles.container, { paddingTop: insets.top + space.lg }]}>
      <Text style={styles.hint}>← Haven&apos;t · Watched → · ↑ Watch Later · ↓ Review Later</Text>
      {undoStack.length > 0 && (
        <Pressable
          onPress={handleUndo}
          disabled={undoing}
          style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Undo marking ${undoStack[0].title}`}
          accessibilityState={{ disabled: undoing }}
        >
          <Text style={styles.undoButtonText}>
            {undoing ? 'Undoing…' : `↺ Undo "${undoStack[0].title}"`}
          </Text>
        </Pressable>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.posterWrap}>
            {poster ? (
              <Image source={{ uri: poster }} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]} />
            )}
            <Animated.View style={[styles.cue, styles.cueRight, rightCueStyle]} pointerEvents="none">
              <Feather name="check" size={64} color={color.success} />
            </Animated.View>
            <Animated.View style={[styles.cue, styles.cueLeft, leftCueStyle]} pointerEvents="none">
              <Feather name="x" size={64} color={color.danger} />
            </Animated.View>
            <Animated.View style={[styles.cue, styles.cueUp, upCueStyle]} pointerEvents="none">
              <Feather name="clock" size={64} color={color.warning} />
            </Animated.View>
            <Animated.View style={[styles.cue, styles.cueDown, downCueStyle]} pointerEvents="none">
              <Feather name="bookmark" size={64} color={color.review} />
            </Animated.View>
          </View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.meta}>
            {current.year ?? '—'} · {current.displayType}
          </Text>
        </Animated.View>
      </GestureDetector>

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

      <View style={[styles.actionsRow, { paddingBottom: insets.bottom + space.md }]}>
        <ActionButton action="unwatched" selected={selectedAction} onPress={handleSelectAction} title={current.title} disabled={!!exitDirection} />
        <ActionButton action="watched" selected={selectedAction} onPress={handleSelectAction} title={current.title} disabled={!!exitDirection} />
      </View>
      <View style={styles.actionsRow}>
        <ActionButton action="watch_later" selected={selectedAction} onPress={handleSelectAction} title={current.title} disabled={!!exitDirection} />
        <ActionButton action="review_later" selected={selectedAction} onPress={handleSelectAction} title={current.title} disabled={!!exitDirection} />
      </View>
      <Pressable
        onPress={handleConfirm}
        disabled={!!exitDirection}
        style={({ pressed }) => [styles.confirmBtn, (pressed || exitDirection) && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Confirm ${ACTION_META[selectedAction].label} for ${current.title}`}
        accessibilityState={{ disabled: !!exitDirection }}
      >
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </View>
  );
}

function ActionButton({
  action,
  selected,
  onPress,
  title,
  disabled,
}: {
  action: Action;
  selected: Action;
  onPress: (a: Action) => void;
  title: string;
  disabled?: boolean;
}) {
  const meta = ACTION_META[action];
  const isSelected = selected === action;
  return (
    <Pressable
      onPress={() => onPress(action)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        isSelected && { borderColor: meta.tint, backgroundColor: `${meta.tint}22` },
        (pressed || disabled) && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${meta.label} for ${title}`}
      accessibilityState={{ selected: isSelected, disabled }}
    >
      <Feather name={meta.icon} size={16} color={isSelected ? meta.tint : color.textMuted} />
      <Text style={[styles.actionBtnText, isSelected && { color: meta.tint }]}>{meta.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, alignItems: 'center', paddingHorizontal: space.lg },
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  hint: { color: color.textMuted, fontSize: type.caption.fontSize, marginBottom: space.sm, textAlign: 'center' },
  undoButton: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  pressed: { opacity: 0.7 },
  undoButtonText: { color: color.text, fontSize: type.label.fontSize, fontWeight: '600' },
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
  card: { alignItems: 'center', width: '100%', flexShrink: 1 },
  posterWrap: { width: 220, height: 330, borderRadius: radius.md, overflow: 'hidden', marginBottom: space.md },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: { backgroundColor: color.surfaceHigh },
  cue: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  cueRight: { backgroundColor: `${color.success}33` },
  cueLeft: { backgroundColor: `${color.danger}33` },
  cueUp: { backgroundColor: `${color.warning}33` },
  cueDown: { backgroundColor: `${color.review}33` },
  title: { color: color.text, ...type.title, textAlign: 'center' },
  meta: { color: color.textMuted, fontSize: type.body.fontSize, marginTop: space.xs },
  imdbHit: { minHeight: 48, justifyContent: 'center', marginTop: space.sm },
  imdbLink: { color: color.textMuted, fontSize: type.caption.fontSize, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: space.sm, width: '100%', marginTop: space.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  actionBtnText: { color: color.textMuted, fontSize: type.label.fontSize, fontWeight: '600' },
  confirmBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  confirmText: { color: color.onPrimary, fontSize: type.label.fontSize, fontWeight: '700' },
  muted: { color: color.textMuted },
});
