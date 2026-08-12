import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MediaSummary } from '@mubitracker/shared';
import { tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);

  const search = async () => {
    if (!query.trim()) return;
    const data = await apiClient.search(query.trim());
    setResults(data.results);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor="#71717a"
          style={styles.input}
          onSubmitEditing={search}
        />
        <Pressable onPress={search} style={styles.btn}>
          <Text style={styles.btnText}>Go</Text>
        </Pressable>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            {item.posterPath && (
              <Image source={{ uri: tmdbPosterUrl(item.posterPath, 'card')! }} style={styles.thumb} />
            )}
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => apiClient.updateUserMedia(item.id, { status: 'watched' })}>
                  <Text style={styles.action}>Watched</Text>
                </Pressable>
                <Pressable onPress={() => apiClient.updateUserMedia(item.id, { status: 'unwatched' })}>
                  <Text style={styles.action}>Unwatched</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, backgroundColor: '#18181b', borderRadius: 8, padding: 12, color: '#fff' },
  btn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  btnText: { color: '#000', fontWeight: '600' },
  item: { flexDirection: 'row', gap: 12, marginBottom: 12, padding: 8, backgroundColor: '#18181b', borderRadius: 8 },
  thumb: { width: 48, height: 72, borderRadius: 4 },
  itemBody: { flex: 1 },
  itemTitle: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  action: { color: '#a1a1aa', fontSize: 12 },
});
