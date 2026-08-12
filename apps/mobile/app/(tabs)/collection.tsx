import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { tmdbPosterUrl } from '@watchdeck/shared';
import { apiClient } from '@/lib/api';

export default function CollectionScreen() {
  const [items, setItems] = useState<Array<{ id: string; title: string; posterPath: string | null; status: string }>>([]);

  useEffect(() => {
    apiClient.getCollection().then((d) => setItems(d.items as typeof items));
  }, []);

  return (
    <FlatList
      style={styles.list}
      data={items}
      numColumns={2}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.posterPath && (
            <Image source={{ uri: tmdbPosterUrl(item.posterPath, 'card')! }} style={styles.poster} />
          )}
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.status}>{item.status}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#09090b' },
  container: { padding: 8 },
  card: { flex: 1, margin: 4, padding: 8, backgroundColor: '#18181b', borderRadius: 8 },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 4, marginBottom: 4 },
  title: { color: '#fff', fontSize: 12 },
  status: { color: '#71717a', fontSize: 10, textTransform: 'capitalize' },
});
