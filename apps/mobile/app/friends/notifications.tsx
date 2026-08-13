import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '@/lib/notifications';
import { ScreenState } from '@/components/ScreenState';
import { color, space, type } from '@/lib/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, unreadCount, markAllRead } = useNotifications();

  const openIncoming = () => {
    router.replace('/(tabs)/friends?tab=incoming');
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable
              onPress={markAllRead}
              hitSlop={8}
              style={styles.markAllHit}
              accessibilityRole="button"
              accessibilityLabel="Mark all read"
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          )}
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
              <Text style={[styles.rowText, item.readAt && styles.rowTextRead]}>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  markAllHit: { minHeight: 44, justifyContent: 'center' },
  markAllText: { color: color.textMuted, fontSize: type.caption.fontSize, fontWeight: '600' },
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
  rowTextRead: { color: color.textMuted },
  pressed: { opacity: 0.6 },
});
