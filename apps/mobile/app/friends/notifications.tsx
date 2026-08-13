import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '@/lib/notifications';
import { ScreenState } from '@/components/ScreenState';
import { color, radius, space, type } from '@/lib/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, markAllRead } = useNotifications();

  // Opening this screen is the mark-read trigger, matching web's
  // NotificationBell (marks all read the moment the dropdown opens).
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  const openIncoming = () => {
    router.replace('/(tabs)/friends?tab=incoming');
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
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

      {items.length === 0 ? (
        <ScreenState empty emptyText="No notifications" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={item.type === 'friend_request' ? openIncoming : undefined}
              accessibilityRole="button"
              accessibilityLabel={
                item.type === 'friend_request'
                  ? `Friend request from @${item.actor?.username ?? 'someone'}`
                  : `@${item.actor?.username ?? 'someone'} accepted your request`
              }
            >
              <Text style={styles.rowText}>
                {item.type === 'friend_request'
                  ? `@${item.actor?.username ?? 'someone'} sent a friend request`
                  : `@${item.actor?.username ?? 'someone'} accepted your request`}
              </Text>
            </Pressable>
          )}
        />
      )}
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
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  row: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowText: { color: color.text },
  pressed: { opacity: 0.6 },
});
