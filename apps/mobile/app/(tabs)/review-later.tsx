import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '@/lib/api';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';

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

  const state = (
    <ScreenState
      loading={loading && items.length === 0}
      error={error}
      empty={!loading && !error && items.length === 0}
      emptyText="Nothing queued for review — swipe down on a title to add one."
      onRetry={reload}
    />
  );
  if (state) return <View style={styles.list}>{state}</View>;

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
  list: { flex: 1, backgroundColor: '#09090b' },
  container: { padding: 16 },
  row: {
    minHeight: 48,
    padding: 16,
    backgroundColor: '#18181b',
    borderRadius: 8,
    marginBottom: 8,
  },
  pressed: { opacity: 0.6 },
  title: { color: '#fafafa', fontWeight: '600' },
  meta: { color: '#71717a', fontSize: 12, marginTop: 2 },
});
