import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { color, radius, space, type } from '@/lib/theme';

type Visibility = 'public' | 'friends' | 'private';

interface ProfileData {
  username: string;
  watchedCount: number;
  unwatchedCount: number;
  watchLaterCount: number;
  reviewCount: number;
  profileVisibility: Visibility;
  collectionVisibility: Visibility;
  reviewsVisibility: Visibility;
}

export default function ProfileScreen() {
  const router = useRouter();
  const showToast = useToast();
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const fetcher = useCallback(async () => (await apiClient.getProfile()) as ProfileData, []);
  const { data, loading, error, reload } = useFocusFetch<ProfileData>(fetcher);
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const shownVisibility = visibility ?? data?.profileVisibility ?? 'private';

  const setDiscoverable = async (next: Visibility) => {
    if (shownVisibility === next) return;
    const previous = shownVisibility;
    setVisibility(next);
    try {
      await apiClient.updateProfile({ profile_visibility: next });
    } catch (e) {
      setVisibility(previous);
      showToast({ message: e instanceof Error ? e.message : 'Failed to save — try again', tone: 'error' });
    }
  };

  const copyHandle = async () => {
    if (!data?.username) return;
    await Clipboard.setStringAsync(data.username);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
      <View style={styles.usernameRow}>
        <Text style={styles.username}>@{data?.username}</Text>
        <Pressable
          style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
          onPress={copyHandle}
          accessibilityRole="button"
          accessibilityLabel="Copy your handle"
        >
          <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy handle'}</Text>
        </Pressable>
      </View>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyLabel}>Profile visibility</Text>
        <View style={styles.segmented}>
          <Pressable
            style={({ pressed }) => [
              styles.segment,
              shownVisibility === 'private' && styles.segmentActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setDiscoverable('private')}
            accessibilityRole="button"
            accessibilityState={{ selected: shownVisibility === 'private' }}
            accessibilityLabel="Set profile to private"
          >
            <Text style={[styles.segmentText, shownVisibility === 'private' && styles.segmentTextActive]}>
              Private
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.segment,
              shownVisibility === 'public' && styles.segmentActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setDiscoverable('public')}
            accessibilityRole="button"
            accessibilityState={{ selected: shownVisibility === 'public' }}
            accessibilityLabel="Set profile to public"
          >
            <Text style={[styles.segmentText, shownVisibility === 'public' && styles.segmentTextActive]}>
              Public
            </Text>
          </Pressable>
        </View>
        <Text style={styles.privacyHelper}>
          Public lets people find you by typing part of your username. Anyone who knows your exact
          handle can always send a request.
        </Text>
      </View>

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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  username: { color: color.text, ...type.headline },
  copyBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.surfaceHigh,
  },
  copyBtnText: { color: color.textMuted, fontSize: type.caption.fontSize, fontWeight: '600' },
  privacyCard: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.xl,
  },
  privacyLabel: { color: color.text, fontWeight: '600', marginBottom: space.md },
  segmented: {
    flexDirection: 'row',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.sm,
    padding: 2,
    marginBottom: space.md,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: color.primary },
  segmentText: { color: color.textMuted, fontWeight: '600' },
  segmentTextActive: { color: color.onPrimary },
  privacyHelper: { color: color.textMuted, fontSize: type.caption.fontSize },
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
