import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { DeckItem, ReviewStatus, WatchStatus } from '@mubitracker/shared';
import { tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { enqueueOfflineAction, syncOfflineQueue } from '@/lib/offline-queue';

interface LastAction {
  mediaId: string;
  title: string;
  previousStatus: WatchStatus;
  previousReviewStatus: ReviewStatus;
}

export default function DeckScreen() {
  const [queue, setQueue] = useState<DeckItem[]>([]);
  const [index, setIndex] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [imdbLoading, setImdbLoading] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const fetching = useRef(false);

  const current = queue[index];

  const loadDeck = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      await syncOfflineQueue();
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (sessionId) params.set('session_id', sessionId);
      const data = await apiClient.getDeck(params);
      setQueue((q) => {
        const seen = new Set(q.map((item) => item.id));
        return [...q, ...data.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(data.cursor);
      setSessionId(data.sessionId);
      setLoadError(null);
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
  }, [cursor, sessionId]);

  useEffect(() => {
    loadDeck();
  }, []);

  useEffect(() => {
    if (index >= queue.length - 5) loadDeck();
  }, [index, queue.length, loadDeck]);

  const performAction = async (status: 'watched' | 'unwatched', reviewLater = false) => {
    if (!current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const prevStatus = current.userStatus ?? 'unwatched';
    const prevReview = current.userReviewStatus ?? 'none';
    // Record for EVERY action, review-later included. Previously this was
    // skipped for review-later while the index still advanced, so the undo pill
    // kept naming the prior card and undoing restored the wrong title.
    setLastAction({
      mediaId: current.id,
      title: current.title,
      previousStatus: prevStatus,
      previousReviewStatus: prevReview,
    });
    setIndex((i) => i + 1);
    try {
      if (reviewLater) {
        await apiClient.reviewLater(current.id);
      } else {
        await apiClient.updateUserMedia(current.id, {
          status,
          review_status: prevReview,
        });
      }
    } catch {
      await enqueueOfflineAction({
        mediaId: current.id,
        status: reviewLater ? 'watched' : status,
        reviewStatus: reviewLater ? 'pending' : 'none',
        timestamp: new Date().toISOString(),
      });
    }
  };

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
    if (!lastAction || undoing) return;
    setUndoing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIndex((i) => Math.max(0, i - 1));
    try {
      await apiClient.undo({
        media_id: lastAction.mediaId,
        previous_status: lastAction.previousStatus,
        previous_review_status: lastAction.previousReviewStatus,
      });
    } catch {
      await enqueueOfflineAction({
        mediaId: lastAction.mediaId,
        status: lastAction.previousStatus,
        reviewStatus: lastAction.previousReviewStatus,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLastAction(null);
      setUndoing(false);
    }
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationX > 120) {
        runOnJS(performAction)('watched');
      } else if (e.translationX < -120) {
        runOnJS(performAction)('unwatched');
      } else if (e.translationY < -100) {
        runOnJS(performAction)('watched', true);
      }
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value * 0.05}deg` },
    ],
  }));

  if (!current) {
    if (!initialLoadDone) {
      return (
        <View style={styles.center}>
          <Text style={styles.muted}>Loading deck…</Text>
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.undoButtonPressed]}
            onPress={() => {
              setLoadError(null);
              setInitialLoadDone(false);
              loadDeck();
            }}
          >
            <Text style={styles.undoButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No titles match — try again later</Text>
      </View>
    );
  }

  const poster = tmdbPosterUrl(current.posterPath, 'deck');

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>← Haven&apos;t · Watched → · ↑ Review Later</Text>
      {lastAction && (
        <Pressable
          onPress={handleUndo}
          disabled={undoing}
          style={({ pressed }) => [styles.undoButton, pressed && styles.undoButtonPressed]}
        >
          <Text style={styles.undoButtonText}>
            {undoing ? 'Undoing…' : `↺ Undo "${lastAction.title}"`}
          </Text>
        </Pressable>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, animatedStyle]}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]} />
          )}
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.meta}>
            {current.year ?? '—'} · {current.displayType}
          </Text>
        </Animated.View>
      </GestureDetector>
      <Pressable onPress={openImdb} disabled={imdbLoading} hitSlop={12}>
        <Text style={styles.imdbLink}>{imdbLoading ? 'Opening…' : 'IMDb ↗'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center', padding: 16 },
  center: { flex: 1, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', top: 60, color: '#71717a', fontSize: 12 },
  undoButton: {
    position: 'absolute',
    top: 90,
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  undoButtonPressed: { opacity: 0.6 },
  undoButtonText: { color: '#f4f4f5', fontSize: 13, fontWeight: '600' },
  errorText: { color: '#f87171', fontSize: 14, textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
  retryButton: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  card: { alignItems: 'center', width: '100%' },
  poster: { width: 220, height: 330, borderRadius: 12, marginBottom: 16 },
  posterPlaceholder: { backgroundColor: '#27272a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  meta: { color: '#71717a', fontSize: 14, marginTop: 4 },
  imdbLink: { color: '#71717a', fontSize: 13, marginTop: 16, fontWeight: '600' },
  muted: { color: '#71717a' },
});
