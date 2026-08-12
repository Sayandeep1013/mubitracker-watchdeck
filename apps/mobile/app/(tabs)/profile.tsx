import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';

interface ProfileData {
  username: string;
  watchedCount: number;
  reviewCount: number;
  friendsCount: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const fetcher = useCallback(async () => (await apiClient.getProfile()) as ProfileData, []);
  const { data, loading, error, reload } = useFocusFetch<ProfileData>(fetcher);

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const payload = await apiClient.exportData();
      Alert.alert('Export ready', `${payload.media.length} items. Download the file from the web app.`);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const state = (
    <ScreenState loading={loading && !data} error={error} onRetry={reload} />
  );
  if (state) return <View style={styles.container}>{state}</View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.username}>@{data?.username}</Text>

      <View style={styles.stats}>
        <Stat label="Watched" value={data?.watchedCount ?? 0} />
        <Stat label="Reviews" value={data?.reviewCount ?? 0} />
        <Stat label="Friends" value={data?.friendsCount ?? 0} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={exportData}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="Export your collection"
      >
        <Text style={styles.btnText}>{exporting ? 'Exporting…' : 'Export'}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.btnText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat} accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 16 },
  username: { color: '#fafafa', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: {
    flex: 1,
    padding: 16,
    backgroundColor: '#18181b',
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: { color: '#fafafa', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#71717a', fontSize: 12, marginTop: 2 },
  btn: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#27272a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  pressed: { opacity: 0.6 },
  btnText: { color: '#fafafa', textAlign: 'center', fontWeight: '600' },
});
