import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { color, radius, space, type } from '@/lib/theme';

interface SearchHit {
  id: string;
  username: string;
}

export default function AddFriendScreen() {
  const router = useRouter();
  const showToast = useToast();
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      apiClient
        .searchFriends(query.trim())
        .then((r) => setHits(r.results))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const sendByUsername = async () => {
    if (!username.trim() || sending) return;
    setSending(true);
    try {
      await apiClient.sendFriendRequest({ username: username.trim() });
      showToast({ message: `Request sent to @${username.trim()}`, tone: 'success' });
      router.back();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Request failed — try again', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  const sendById = async (hit: SearchHit) => {
    if (addingId) return;
    setAddingId(hit.id);
    try {
      await apiClient.sendFriendRequest({ user_id: hit.id });
      showToast({ message: `Request sent to @${hit.username}`, tone: 'success' });
      router.back();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Request failed — try again', tone: 'error' });
      setAddingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add a friend</Text>
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

      <View style={styles.body}>
        <Text style={styles.label}>Add by exact handle</Text>
        <View style={styles.row}>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="@username"
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel="Friend's username"
          />
          <Pressable
            onPress={sendByUsername}
            disabled={!username.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              (pressed || sending || !username.trim()) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send request"
          >
            <Text style={styles.sendBtnText}>{sending ? '…' : 'Send'}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Search public profiles</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Type at least 2 letters…"
          placeholderTextColor={color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Search public profiles"
        />

        <FlatList
          data={hits}
          keyExtractor={(h) => h.id}
          style={styles.hitsList}
          renderItem={({ item }) => (
            <View style={styles.hitRow}>
              <Text style={styles.hitText}>@{item.username}</Text>
              <Pressable
                onPress={() => sendById(item)}
                disabled={addingId === item.id}
                hitSlop={8}
                style={styles.addHit}
                accessibilityRole="button"
                accessibilityLabel={`Add @${item.username}`}
              >
                <Text style={styles.addText}>{addingId === item.id ? 'Adding…' : 'Add'}</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
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
  body: { flex: 1, paddingHorizontal: space.lg },
  label: { color: color.textMuted, fontSize: type.caption.fontSize, marginBottom: space.sm, marginTop: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
  input: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    padding: space.md,
    color: color.text,
    minHeight: 48,
  },
  sendBtn: {
    backgroundColor: color.primary,
    borderRadius: radius.sm,
    paddingHorizontal: space.xl,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  sendBtnText: { color: color.onPrimary, fontWeight: '600' },
  hitsList: { marginTop: space.md },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  hitText: { color: color.text },
  addHit: { minHeight: 44, justifyContent: 'center' },
  addText: { color: color.primary, fontWeight: '700', fontSize: 13 },
});
