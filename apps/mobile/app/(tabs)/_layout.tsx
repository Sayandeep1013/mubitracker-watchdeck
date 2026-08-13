import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNotifications } from '@/lib/notifications';
import { color as themeColor, space } from '@/lib/theme';

type FeatherName = keyof typeof Feather.glyphMap;

function TabIcon(name: FeatherName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} color={color} size={size} />
  );
}

function CollectionHeaderRight() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/watch-later')}
      hitSlop={8}
      style={styles.headerBtn}
      accessibilityRole="button"
      accessibilityLabel="Watch Later"
    >
      <Feather name="clock" color={themeColor.warning} size={20} />
    </Pressable>
  );
}

function FriendsHeaderRight() {
  const router = useRouter();
  const { unreadCount } = useNotifications();

  return (
    <View style={styles.headerButtons}>
      <Pressable
        onPress={() => router.push('/friends/notifications')}
        hitSlop={8}
        style={styles.headerBtn}
        accessibilityRole="button"
        accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Feather name="bell" color={themeColor.text} size={20} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Pressable>
      <Pressable
        onPress={() => router.push('/friends/add')}
        hitSlop={8}
        style={styles.headerBtn}
        accessibilityRole="button"
        accessibilityLabel="Add a friend"
      >
        <Feather name="user-plus" color={themeColor.text} size={20} />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: themeColor.bg },
        headerTintColor: themeColor.text,
        tabBarStyle: { backgroundColor: themeColor.bg, borderTopColor: themeColor.border },
        tabBarActiveTintColor: themeColor.text,
        tabBarInactiveTintColor: themeColor.textMuted,
      }}
    >
      <Tabs.Screen name="deck" options={{ title: 'Deck', tabBarIcon: TabIcon('layers') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: TabIcon('search') }} />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: TabIcon('grid'),
          headerRight: CollectionHeaderRight,
        }}
      />
      <Tabs.Screen
        name="review-later"
        options={{ title: 'Review Later', tabBarIcon: TabIcon('bookmark') }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: TabIcon('users'),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          headerRight: FriendsHeaderRight,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: TabIcon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: space.lg, marginRight: space.lg },
  headerBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: themeColor.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
