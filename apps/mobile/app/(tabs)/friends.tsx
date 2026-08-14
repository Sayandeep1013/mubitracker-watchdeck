import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/lib/api';
import { useFocusFetch } from '@/lib/useFocusFetch';
import { useNotifications } from '@/lib/notifications';
import { ScreenState } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { color, glassCard, glassChip, radius, space, type } from '@/lib/theme';

type Tab = 'friends' | 'incoming' | 'outgoing' | 'blocked';

interface Friendship {
  id: string;
  status: string;
  blockedBy?: string | null;
  friend?: { id: string; username: string };
}

interface FriendsData {
  friends: Friendship[];
  incoming: Friendship[];
  outgoing: Friendship[];
  blocked: Friendship[];
  myId: string;
  myUsername: string;
  profileVisibility: string;
}

const NUDGE_KEY_PREFIX = 'mubitracker:discoverable-nudge-dismissed:';

export default function FriendsScreen() {
  const router = useRouter();
  const showToast = useToast();
  const { markIncomingRead, markFriendshipRead } = useNotifications();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(tabParam === 'incoming' ? 'incoming' : 'friends');

  useEffect(() => {
    if (tabParam === 'incoming') setTab('incoming');
  }, [tabParam]);

  // Spec 40 §7: viewing Incoming — not opening the notifications modal —
  // is what clears friend-request unreads.
  useEffect(() => {
    if (tab === 'incoming') markIncomingRead();
  }, [tab, markIncomingRead]);
  const [copied, setCopied] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetcher = useCallback(async (): Promise<FriendsData> => {
    const [friends, incoming, outgoing, blocked, profile] = await Promise.all([
      apiClient.getFriends('accepted'),
      apiClient.getFriends('pending_in'),
      apiClient.getFriends('pending_out'),
      apiClient.getFriends('blocked'),
      apiClient.getProfile(),
    ]);
    return {
      friends: friends as Friendship[],
      incoming: incoming as Friendship[],
      outgoing: outgoing as Friendship[],
      blocked: blocked as Friendship[],
      myId: (profile as { id: string }).id,
      myUsername: (profile as { username: string }).username,
      profileVisibility: (profile as { profileVisibility: string }).profileVisibility,
    };
  }, []);

  const { data, loading, error, reload } = useFocusFetch<FriendsData>(fetcher);

  useEffect(() => {
    if (!data) return;
    if (data.profileVisibility !== 'private') {
      setShowNudge(false);
      return;
    }
    AsyncStorage.getItem(`${NUDGE_KEY_PREFIX}${data.myId}`).then((dismissed) => {
      setShowNudge(!dismissed);
    });
  }, [data]);

  const dismissNudge = async (persist: boolean) => {
    setShowNudge(false);
    if (persist && data) await AsyncStorage.setItem(`${NUDGE_KEY_PREFIX}${data.myId}`, '1');
  };

  const makeDiscoverable = async () => {
    try {
      await apiClient.updateProfile({ profile_visibility: 'public' });
      showToast({ message: "You're now discoverable by username", tone: 'success' });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Failed to save — try again', tone: 'error' });
    } finally {
      await dismissNudge(true);
    }
  };

  const copyHandle = async () => {
    if (!data?.myUsername) return;
    try {
      await Clipboard.setStringAsync(data.myUsername);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast({ message: 'Could not copy — try again', tone: 'error' });
    }
  };

  const withBusy = async (id: string, action: () => Promise<unknown>, successMessage: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await action();
      showToast({ message: successMessage, tone: 'success' });
      markFriendshipRead(id);
      reload();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Action failed — try again', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const rows: Friendship[] =
    tab === 'friends'
      ? (data?.friends ?? [])
      : tab === 'incoming'
        ? (data?.incoming ?? [])
        : tab === 'outgoing'
          ? (data?.outgoing ?? [])
          : (data?.blocked ?? []);

  const emptyText =
    tab === 'friends'
      ? 'No friends yet — tap + to add one.'
      : tab === 'incoming'
        ? 'No incoming requests'
        : tab === 'outgoing'
          ? 'No outgoing requests'
          : 'No blocked users';

  // Bug, confirmed live (same root cause fixed elsewhere this session):
  // `state ?? (<FlatList/>)` never falls through since `state` holds a
  // created JSX element — always truthy/non-null — regardless of what
  // ScreenState renders once mounted. Mirrors the same three conditions
  // ScreenState itself branches on.
  const showState = (loading && !data) || !!error || (!loading && !error && rows.length === 0);

  return (
    <View style={styles.container}>
      {data?.myUsername && (
        <Pressable
          style={({ pressed }) => [styles.handleRow, pressed && styles.pressed]}
          onPress={copyHandle}
          accessibilityRole="button"
          accessibilityLabel="Copy your handle"
        >
          <Text style={styles.handleText}>@{data.myUsername}</Text>
          <Text style={styles.handleAction}>{copied ? 'Copied!' : 'Copy handle'}</Text>
        </Pressable>
      )}

      {showNudge && (
        <View style={[styles.nudge, glassCard()]}>
          <Text style={styles.nudgeText}>Let people find you by username?</Text>
          <View style={styles.nudgeActions}>
            <Pressable
              style={({ pressed }) => [styles.nudgeBtn, glassChip(), pressed && styles.pressed]}
              onPress={makeDiscoverable}
              accessibilityRole="button"
              accessibilityLabel="Make me discoverable"
            >
              <Text style={styles.nudgePrimaryText}>Make me discoverable</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.nudgeBtn, pressed && styles.pressed]}
              onPress={() => dismissNudge(true)}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={styles.nudgeSecondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.segmented}>
        {(
          [
            ['friends', 'Friends'],
            ['incoming', `Incoming${data && data.incoming.length > 0 ? ` (${data.incoming.length})` : ''}`],
            ['outgoing', 'Outgoing'],
            ['blocked', 'Blocked'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            style={({ pressed }) => [
              styles.segment,
              tab === id && styles.segmentActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setTab(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === id }}
            accessibilityLabel={label}
          >
            <Text style={[styles.segmentText, tab === id && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {showState ? (
        <ScreenState
          loading={loading && !data}
          error={error}
          empty={!loading && !error && rows.length === 0}
          emptyText={emptyText}
          onRetry={reload}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={reload}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const username = item.friend?.username ?? 'Unknown';
            const isBusy = busyId === item.id;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, glassCard(), pressed && styles.pressed]}
                onPress={() =>
                  item.friend &&
                  router.push(
                    `/friends/${item.friend.id}?friendship_id=${item.id}&status=${item.status}`,
                  )
                }
                disabled={!item.friend}
                accessibilityRole="button"
                accessibilityLabel={`Open @${username}`}
              >
                <Text style={styles.rowTitle}>@{username}</Text>
                <View style={styles.rowActions}>
                  {tab === 'incoming' && (
                    <>
                      <ActionBtn
                        label="Accept"
                        tint={color.success}
                        disabled={isBusy}
                        onPress={() => withBusy(item.id, () => apiClient.acceptFriend(item.id), `You and @${username} are now friends`)}
                      />
                      <ActionBtn
                        label="Decline"
                        tint={color.textMuted}
                        disabled={isBusy}
                        onPress={() => withBusy(item.id, () => apiClient.declineFriend(item.id), 'Request declined')}
                      />
                      <ActionBtn
                        label="Block"
                        tint={color.danger}
                        disabled={isBusy}
                        onPress={() => withBusy(item.id, () => apiClient.blockFriend(item.id), `@${username} blocked`)}
                      />
                    </>
                  )}
                  {tab === 'outgoing' && (
                    <ActionBtn
                      label="Cancel"
                      tint={color.textMuted}
                      disabled={isBusy}
                      onPress={() => withBusy(item.id, () => apiClient.cancelFriend(item.id), 'Request canceled')}
                    />
                  )}
                  {tab === 'blocked' &&
                    (item.blockedBy === data?.myId ? (
                      <ActionBtn
                        label="Unblock"
                        tint={color.text}
                        disabled={isBusy}
                        onPress={() => withBusy(item.id, () => apiClient.unblockFriend(item.id), `@${username} unblocked`)}
                      />
                    ) : (
                      <Text style={styles.blockedByThem}>Blocked you</Text>
                    ))}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function ActionBtn({
  label,
  tint,
  onPress,
  disabled,
}: {
  label: string;
  tint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={styles.actionHit}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.actionText, { color: tint }, disabled && styles.actionDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.lg },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    minHeight: 44,
  },
  handleText: { color: color.text, fontWeight: '600' },
  handleAction: { color: color.textMuted, fontSize: type.caption.fontSize },
  nudge: {
    padding: space.lg,
    marginBottom: space.lg,
  },
  nudgeText: { color: color.text, marginBottom: space.md },
  nudgeActions: { flexDirection: 'row', gap: space.md },
  nudgeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.sm },
  nudgePrimaryText: { color: color.primary, fontWeight: '700', fontSize: type.caption.fontSize },
  nudgeSecondaryText: { color: color.textMuted, fontWeight: '600', fontSize: type.caption.fontSize },
  segmented: {
    flexDirection: 'row',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.sm,
    padding: 2,
    marginBottom: space.lg,
  },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: `${color.primary}1F`, borderWidth: 1, borderColor: color.primary },
  segmentText: { color: color.textMuted, fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: color.primary },
  list: { paddingBottom: space.xl },
  row: {
    minHeight: 48,
    padding: space.lg,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.6 },
  rowTitle: { color: color.text, fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: space.lg },
  actionHit: { minHeight: 44, justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '700' },
  actionDisabled: { opacity: 0.4 },
  blockedByThem: { color: color.textMuted, fontSize: type.caption.fontSize },
});
