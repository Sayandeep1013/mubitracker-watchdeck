import { useCallback } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';

interface CollectionItem {
  id: string;
  title: string;
  posterPath: string | null;
  status: string;
}

export default function CollectionScreen() {
  const fetcher = useCallback(
    async () => (await apiClient.getCollection()).items as CollectionItem[],
    [],
  );
  const { data, loading, error, reload } = useFocusFetch<CollectionItem[]>(fetcher);
  const items = data ?? [];

  const state = (
    <ScreenState
      loading={loading && items.length === 0}
      error={error}
      empty={!loading && !error && items.length === 0}
      emptyText="Nothing tracked yet — classify a few titles on the Deck."
      onRetry={reload}
    />
  );
  if (state) return <View style={styles.list}>{state}</View>;

  return (
    <FlatList
      style={styles.list}
      data={items}
      numColumns={2}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshing={loading}
      onRefresh={reload}
      renderItem={({ item }) => {
        const poster = tmdbPosterUrl(item.posterPath, 'card');
        return (
          <View style={styles.card} accessibilityLabel={`${item.title}, ${item.status}`}>
            {poster ? (
              <Image source={{ uri: poster }} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.status}>{item.status.replace('_', ' ')}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#09090b' },
  container: { padding: 8 },
  card: { flex: 1, margin: 4, padding: 8, backgroundColor: '#18181b', borderRadius: 8 },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 4, marginBottom: 4 },
  posterPlaceholder: { backgroundColor: '#27272a' },
  title: { color: '#fafafa', fontSize: 12 },
  status: { color: '#71717a', fontSize: 10, textTransform: 'capitalize' },
});
