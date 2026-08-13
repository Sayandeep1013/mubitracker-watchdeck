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
import { useToast } from '@/components/Toast';
import { color, radius, space, type } from '@/lib/theme';

type MarkState = Record<string, WatchStatus | 'pending' | 'failed'>;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [marks, setMarks] = useState<MarkState>({});
  const showToast = useToast();

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
  const mark = async (id: string, status: WatchStatus, title: string) => {
    if (marks[id] === 'pending') return;
    setMarks((m) => ({ ...m, [id]: 'pending' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiClient.updateUserMedia(id, { status });
      setMarks((m) => ({ ...m, [id]: status }));
    } catch {
      setMarks((m) => ({ ...m, [id]: 'failed' }));
      showToast({ message: `Couldn't save ${title} — try again`, tone: 'error' });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={color.textMuted}
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
          {searching ? <ActivityIndicator color={color.bg} /> : <Text style={styles.btnText}>Go</Text>}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!searched && !searching && !error && (
        <Text style={styles.muted}>Search for a film or series</Text>
      )}
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
                  <Pressable
                    onPress={() => mark(item.id, 'watched', item.title)}
                    hitSlop={8}
                    style={styles.actionHit}
                    accessibilityRole="button"
                    accessibilityLabel={`Retry saving ${item.title}`}
                  >
                    <Text style={styles.failed}>Couldn&apos;t save — tap to retry</Text>
                  </Pressable>
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => mark(item.id, 'watched', item.title)}
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
                      onPress={() => mark(item.id, 'unwatched', item.title)}
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
  container: { flex: 1, backgroundColor: color.bg, padding: space.lg },
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  input: { flex: 1, backgroundColor: color.surface, borderRadius: radius.sm, padding: space.md, color: color.text },
  btn: {
    backgroundColor: color.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.xl,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  btnText: { color: color.bg, fontWeight: '600' },
  error: { color: color.danger, marginBottom: space.md },
  muted: { color: color.textMuted, marginBottom: space.md },
  item: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
    padding: space.sm,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
  },
  thumb: { width: 48, height: 72, borderRadius: radius.sm / 2 },
  thumbPlaceholder: { backgroundColor: color.surfaceHigh },
  itemBody: { flex: 1 },
  itemTitle: { color: color.text, fontWeight: '600' },
  itemMeta: { color: color.textMuted, fontSize: type.caption.fontSize, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  actionHit: { minHeight: 48, justifyContent: 'center' },
  action: { color: color.textMuted, fontSize: 13, fontWeight: '600' },
  marked: { color: color.success, fontSize: type.caption.fontSize, marginTop: space.sm },
  failed: { color: color.danger, fontSize: type.caption.fontSize, marginTop: space.sm },
});
