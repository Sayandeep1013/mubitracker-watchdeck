import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '@/lib/api';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';
import { color, radius, space, type } from '@/lib/theme';

interface PendingItem {
  id: string;
  title: string;
  year: number | null;
  displayType: string;
}

export default function ReviewLaterScreen() {
  const router = useRouter();
  const fetcher = useCallback(async () => (await apiClient.getPendingReviews()) as PendingItem[], []);
  const { data, loading, error, reload } = useFocusFetch<PendingItem[]>(fetcher);
  const items = data ?? [];

  // Bug, confirmed live (see collection.tsx / profile.tsx for the same
  // fix): `if (state)` where state is a created JSX element is always
  // truthy, hiding the real list every time there was real data to show.
  const showState = !!error || items.length === 0;
  if (showState) {
    return (
      <View style={styles.list}>
        <ScreenState
          loading={loading && items.length === 0}
          error={error}
          empty={!loading && !error && items.length === 0}
          emptyText="Nothing queued for review — swipe down on a title to add one."
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshing={loading}
      onRefresh={reload}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Write a review for ${item.title}`}
          onPress={() => router.push(`/review/${item.id}`)}
        >
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.year ?? '—'} · {item.displayType}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: color.bg },
  container: { padding: space.lg },
  row: {
    minHeight: 48,
    padding: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    marginBottom: space.sm,
  },
  pressed: { opacity: 0.6 },
  title: { color: color.text, fontWeight: '600' },
  meta: { color: color.textMuted, fontSize: type.caption.fontSize, marginTop: 2 },
});
