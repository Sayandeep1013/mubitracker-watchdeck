import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { MediaSummary, WatchStatus } from '@mubitracker/shared';
import { tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';

type MarkState = Record<string, WatchStatus | 'pending' | 'failed'>;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [marks, setMarks] = useState<MarkState>({});

  const search = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const data = await apiClient.search(query.trim());
      setResults(data.results);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Previously fire-and-forget: no await, no state change, no catch. The write
  // persisted but was invisible, and a failure was silent too.
  const mark = async (id: string, status: WatchStatus) => {
    if (marks[id] === 'pending') return;
    setMarks((m) => ({ ...m, [id]: 'pending' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiClient.updateUserMedia(id, { status });
      setMarks((m) => ({ ...m, [id]: status }));
    } catch {
      setMarks((m) => ({ ...m, [id]: 'failed' }));
    }
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
          returnKeyType="search"
          accessibilityLabel="Search for a title"
        />
        <Pressable
          onPress={search}
          disabled={searching}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          {searching ? <ActivityIndicator color="#09090b" /> : <Text style={styles.btnText}>Go</Text>}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {searched && !error && results.length === 0 && !searching && (
        <Text style={styles.muted}>No results for “{query.trim()}”.</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const poster = tmdbPosterUrl(item.posterPath, 'card');
          const mark_ = marks[item.id];
          return (
            <View style={styles.item}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.year ?? '—'} · {item.displayType}
                </Text>

                {mark_ === 'watched' || mark_ === 'unwatched' ? (
                  <Text style={styles.marked}>
                    ✓ Saved as {mark_ === 'watched' ? 'Watched' : "Haven't watched"}
                  </Text>
                ) : mark_ === 'failed' ? (
                  <Pressable onPress={() => mark(item.id, 'watched')} hitSlop={8}>
                    <Text style={styles.failed}>Couldn&apos;t save — tap to retry</Text>
                  </Pressable>
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => mark(item.id, 'watched')}
                      disabled={mark_ === 'pending'}
                      hitSlop={8}
                      style={styles.actionHit}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${item.title} as watched`}
                    >
                      <Text style={styles.action}>
                        {mark_ === 'pending' ? 'Saving…' : 'Watched'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => mark(item.id, 'unwatched')}
                      disabled={mark_ === 'pending'}
                      hitSlop={8}
                      style={styles.actionHit}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${item.title} as not watched`}
                    >
                      <Text style={styles.action}>Haven&apos;t</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, backgroundColor: '#18181b', borderRadius: 8, padding: 12, color: '#fafafa' },
  btn: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  btnText: { color: '#09090b', fontWeight: '600' },
  error: { color: '#f87171', marginBottom: 12 },
  muted: { color: '#71717a', marginBottom: 12 },
  item: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#18181b',
    borderRadius: 8,
  },
  thumb: { width: 48, height: 72, borderRadius: 4 },
  thumbPlaceholder: { backgroundColor: '#27272a' },
  itemBody: { flex: 1 },
  itemTitle: { color: '#fafafa', fontWeight: '600' },
  itemMeta: { color: '#71717a', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  actionHit: { minHeight: 44, justifyContent: 'center' },
  action: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },
  marked: { color: '#4ade80', fontSize: 12, marginTop: 8 },
  failed: { color: '#f87171', fontSize: 12, marginTop: 8 },
});
