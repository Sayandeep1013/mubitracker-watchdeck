import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CollectionComparison, Profile } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { ScreenState } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { color, glassChip, radius, space, type } from '@/lib/theme';

export default function FriendDetailScreen() {
  const {
    id,
    friendship_id: friendshipId,
    status: initialStatus,
  } = useLocalSearchParams<{
    id: string;
    friendship_id?: string;
    status?: string;
  }>();
  const router = useRouter();
  const showToast = useToast();
  const [comparison, setComparison] = useState<CollectionComparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blocked, setBlocked] = useState(initialStatus === 'blocked');

  const fetcher = useCallback(async () => (await apiClient.getFriendProfile(id)) as Profile, [id]);
  const { data, loading, error, reload } = useFocusFetch<Profile>(fetcher);

  const compare = async () => {
    if (comparing) return;
    setComparing(true);
    try {
      setComparison(await apiClient.compareWithFriend(id));
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Comparison failed — try again', tone: 'error' });
    } finally {
      setComparing(false);
    }
  };

  const block = async () => {
    if (!friendshipId || blockBusy) return;
    setBlockBusy(true);
    try {
      await apiClient.blockFriend(friendshipId);
      setBlocked(true);
      showToast({ message: `@${data?.username ?? 'User'} blocked`, tone: 'success' });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Failed to block — try again', tone: 'error' });
    } finally {
      setBlockBusy(false);
    }
  };

  const unblock = async () => {
    if (!friendshipId || blockBusy) return;
    setBlockBusy(true);
    try {
      await apiClient.unblockFriend(friendshipId);
      setBlocked(false);
      showToast({ message: `@${data?.username ?? 'User'} unblocked`, tone: 'success' });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Failed to unblock — try again', tone: 'error' });
    } finally {
      setBlockBusy(false);
    }
  };

  // Bug, confirmed live (see collection.tsx / profile.tsx for the same
  // fix): `if (state)` where state is a created JSX element is always
  // truthy, hiding the real profile every time it actually loaded.
  if ((loading && !data) || error) {
    return (
      <View style={styles.container}>
        <ScreenState loading={loading && !data} error={error} onRetry={reload} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.username}>@{data?.username}</Text>
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

      <View style={styles.stats}>
        <Stat label="Watched" value={data?.watchedCount ?? 0} />
        <Stat label="Reviews" value={data?.reviewCount ?? 0} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, glassChip(), pressed && styles.pressed]}
        onPress={compare}
        disabled={comparing}
        accessibilityRole="button"
        accessibilityLabel="Compare collections"
      >
        <Text style={styles.primaryBtnText}>{comparing ? 'Comparing…' : 'Compare'}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btn, glassChip(color.textMuted), pressed && styles.pressed]}
        onPress={() => router.push(`/deck?friend_id=${id}&friend_mode=watched_not_me`)}
        accessibilityRole="button"
        accessibilityLabel="View their deck"
      >
        <Text style={styles.btnText}>Their Deck</Text>
      </Pressable>

      {comparison && (
        <View style={styles.compareCard}>
          <Text style={styles.compareLine}>Both watched: {comparison.bothWatched}</Text>
          <Text style={styles.compareLine}>You only: {comparison.youOnly}</Text>
          <Text style={styles.compareLine}>Friend only: {comparison.friendOnly}</Text>
        </View>
      )}

      {friendshipId && (
        <Pressable
          style={({ pressed }) => [styles.btn, glassChip(color.danger), pressed && styles.pressed]}
          onPress={blocked ? unblock : block}
          disabled={blockBusy}
          accessibilityRole="button"
          accessibilityLabel={blocked ? 'Unblock this friend' : 'Block this friend'}
        >
          <Text style={styles.dangerBtnText}>
            {blockBusy ? '…' : blocked ? 'Unblock' : 'Block'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xl },
  username: { color: color.text, ...type.headline },
  closeHit: { minHeight: 44, justifyContent: 'center' },
  closeText: { color: color.textMuted, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: space.md, marginBottom: space.xl },
  stat: { flex: 1, padding: space.lg, backgroundColor: color.surface, borderRadius: radius.lg, alignItems: 'center' },
  statValue: { color: color.text, fontSize: 22, fontWeight: '700' },
  statLabel: { color: color.textMuted, fontSize: type.caption.fontSize, marginTop: 2 },
  btn: {
    minHeight: 48,
    justifyContent: 'center',
    padding: space.lg,
    marginBottom: space.md,
  },
  pressed: { opacity: 0.6 },
  btnText: { color: color.textMuted, textAlign: 'center', fontWeight: '700' },
  primaryBtnText: { color: color.primary, textAlign: 'center', fontWeight: '700' },
  dangerBtnText: { color: color.danger, textAlign: 'center', fontWeight: '700' },
  compareCard: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
  },
  compareLine: { color: color.textMuted, marginBottom: space.sm },
});
