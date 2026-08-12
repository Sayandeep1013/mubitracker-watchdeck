import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { apiClient } from '@/lib/api';

export default function ReviewLaterScreen() {
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);
  const router = useRouter();

  useEffect(() => {
    apiClient.getPendingReviews().then(setItems);
  }, []);

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<Text style={styles.empty}>Nothing to review</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/review/${item.id}`)}>
          <Text style={styles.title}>{item.title}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#09090b' },
  container: { padding: 16 },
  row: { padding: 16, backgroundColor: '#18181b', borderRadius: 8, marginBottom: 8 },
  title: { color: '#fff' },
  empty: { color: '#71717a', textAlign: 'center', marginTop: 40 },
});
