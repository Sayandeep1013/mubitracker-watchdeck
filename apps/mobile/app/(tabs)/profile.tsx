import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { color, radius, space, type } from '@/lib/theme';

interface ProfileData {
  username: string;
  watchedCount: number;
  unwatchedCount: number;
  watchLaterCount: number;
  reviewCount: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const showToast = useToast();
  const [exporting, setExporting] = useState(false);
  const fetcher = useCallback(async () => (await apiClient.getProfile()) as ProfileData, []);
  const { data, loading, error, reload } = useFocusFetch<ProfileData>(fetcher);

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const payload = await apiClient.exportData();
      await Share.share({
        title: 'Mubitracker export',
        message: JSON.stringify(payload, null, 2),
      });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Export failed — try again', tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch {
      showToast({ message: 'Sign out failed — try again', tone: 'error' });
    }
  };

  const state = <ScreenState loading={loading && !data} error={error} onRetry={reload} />;
  if (state) return <View style={styles.container}>{state}</View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.username}>@{data?.username}</Text>

      <View style={[styles.stats, styles.statsRowGap]}>
        <Stat label="Watched" value={data?.watchedCount ?? 0} />
        <Stat label="Haven't" value={data?.unwatchedCount ?? 0} />
      </View>
      <View style={styles.stats}>
        <Stat label="Watch Later" value={data?.watchLaterCount ?? 0} />
        <Stat label="Reviews" value={data?.reviewCount ?? 0} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, styles.primaryBtn, pressed && styles.pressed]}
        onPress={exportData}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="Export your collection"
        accessibilityState={{ disabled: exporting }}
      >
        <Text style={styles.primaryBtnText}>{exporting ? 'Exporting…' : 'Export'}</Text>
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
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg },
  username: { color: color.text, ...type.headline, marginBottom: space.xl },
  stats: { flexDirection: 'row', gap: space.md, marginBottom: space.xl },
  statsRowGap: { marginBottom: space.md },
  stat: {
    flex: 1,
    padding: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  statValue: { color: color.text, fontSize: 22, fontWeight: '700' },
  statLabel: { color: color.textMuted, fontSize: type.caption.fontSize, marginTop: 2 },
  btn: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: color.surfaceHigh,
    padding: space.lg,
    borderRadius: radius.sm,
    marginBottom: space.md,
  },
  primaryBtn: { backgroundColor: color.primary },
  pressed: { opacity: 0.6 },
  btnText: { color: color.text, textAlign: 'center', fontWeight: '600' },
  primaryBtnText: { color: color.onPrimary, textAlign: 'center', fontWeight: '600' },
});
