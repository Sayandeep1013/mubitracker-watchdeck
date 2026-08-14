import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { color, glassCard, radius, space, type } from '@/lib/theme';

interface WatchLaterItem {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  displayType: string;
}

export default function WatchLaterScreen() {
  const router = useRouter();
  const showToast = useToast();
  const fetcher = useCallback(async () => (await apiClient.getWatchLater()) as WatchLaterItem[], []);
  const { data, loading, error, reload } = useFocusFetch<WatchLaterItem[]>(fetcher);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const items = data ?? [];

  const markWatched = async (item: WatchLaterItem) => {
    if (markingId) return;
    setMarkingId(item.id);
    try {
      await apiClient.updateUserMedia(item.id, { status: 'watched', review_status: 'none' });
      showToast({ message: `Marked ${item.title} as watched`, tone: 'success' });
      reload();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : "Couldn't save — try again", tone: 'error' });
    } finally {
      setMarkingId(null);
    }
  };

  // Bug, confirmed live (same root cause fixed elsewhere this session):
  // `state ?? (<FlatList/>)` never falls through, because `state` holds a
  // created JSX element — always a truthy, non-null object — regardless
  // of what ScreenState renders once mounted. `??` only falls through on
  // null/undefined, so the FlatList was dead code; this screen could
  // never show anything but ScreenState's own loading/error/empty output
  // (or blank, when none of those applied). This IS "Watch Later isn't
  // loading" — not a network/fetch problem, just this render bug.
  const showState = !!error || items.length === 0;

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Watch Later</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.closeHit}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      {showState ? (
        <ScreenState
          loading={loading && items.length === 0}
          error={error}
          empty={!loading && !error && items.length === 0}
          emptyText="Nothing saved yet — on the deck, swipe up for Watch Later."
          onRetry={reload}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={reload}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const poster = tmdbPosterUrl(item.posterPath, 'card');
            const busy = markingId === item.id;
            return (
              <View style={[styles.row, glassCard()]}>
                {poster ? (
                  <Image source={{ uri: poster }} style={styles.poster} />
                ) : (
                  <View style={[styles.poster, styles.posterPlaceholder]} />
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta}>
                    {item.year ?? '—'} · {item.displayType}
                  </Text>
                  <Pressable
                    onPress={() => markWatched(item)}
                    disabled={busy}
                    hitSlop={8}
                    style={styles.markHit}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${item.title} as watched`}
                    accessibilityState={{ disabled: busy }}
                  >
                    <Text style={styles.markText}>{busy ? 'Saving…' : 'Mark watched'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
  },
  headerTitle: { color: color.text, ...type.title, fontSize: 18 },
  closeHit: { minHeight: 44, justifyContent: 'center' },
  closeText: { color: color.textMuted, fontWeight: '600' },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  row: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
    padding: space.sm,
  },
  poster: { width: 56, height: 84, borderRadius: radius.sm / 2 },
  posterPlaceholder: { backgroundColor: color.surfaceHigh },
  rowBody: { flex: 1, justifyContent: 'center' },
  title: { color: color.text, fontWeight: '600' },
  meta: { color: color.textMuted, fontSize: type.caption.fontSize, marginTop: 2 },
  markHit: { minHeight: 44, justifyContent: 'center', marginTop: space.sm, alignSelf: 'flex-start' },
  markText: { color: color.success, fontSize: 13, fontWeight: '700' },
});
