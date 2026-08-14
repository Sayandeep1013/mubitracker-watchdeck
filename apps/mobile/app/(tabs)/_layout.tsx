import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNotifications } from '@/lib/notifications';
import { useFilters } from '@/lib/filters';
import { useMenu } from '@/lib/menu';
import { color as themeColor, space } from '@/lib/theme';

type FeatherName = keyof typeof Feather.glyphMap;

function TabIcon(name: FeatherName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} color={color} size={size} />
  );
}

function HamburgerHeaderLeft() {
  const { open } = useMenu();

  return (
    <Pressable
      onPress={open}
      hitSlop={8}
      style={styles.headerBtn}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <Feather name="menu" color={themeColor.text} size={22} />
    </Pressable>
  );
}

function DeckHeaderRight() {
  const router = useRouter();
  const { activeCount } = useFilters();

  return (
    <Pressable
      onPress={() => router.push('/filters')}
      hitSlop={8}
      style={styles.headerBtn}
      accessibilityRole="button"
      accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
    >
      <Feather name="sliders" color={themeColor.text} size={20} />
      {activeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activeCount > 9 ? '9+' : activeCount}</Text>
        </View>
      )}
    </Pressable>
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
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: themeColor.bg },
        headerTintColor: themeColor.text,
        headerLeft: HamburgerHeaderLeft,
        tabBarStyle: { backgroundColor: themeColor.bg, borderTopColor: themeColor.border },
        tabBarActiveTintColor: themeColor.text,
        tabBarInactiveTintColor: themeColor.textMuted,
      }}
    >
      {/* The poster is the whole page here — headerTransparent means the
          header bar itself has no background, and the screen's own content
          isn't pushed down to make room for it, so the poster renders full
          height with the hamburger and Filters icons floating on top of it
          at their usual spot instead of sitting on a separate solid bar
          above it. */}
      <Tabs.Screen
        name="deck"
        options={{
          title: 'Deck',
          headerTransparent: true,
          headerTitle: '',
          tabBarIcon: TabIcon('layers'),
          headerRight: DeckHeaderRight,
        }}
      />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: TabIcon('search') }} />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: TabIcon('grid'),
          headerRight: CollectionHeaderRight,
        }}
      />
      {/* Review Later and Friends moved into the side drawer (MenuDrawer) —
          the dock stays at 4 items (Deck, Search, Collection, Profile), the
          ones actually tapped often. `href: null` keeps them real,
          deep-linkable routes; it only drops their button from the bar. */}
      <Tabs.Screen
        name="review-later"
        options={{ title: 'Review Later', tabBarIcon: TabIcon('bookmark'), href: null }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: TabIcon('users'),
          headerRight: FriendsHeaderRight,
          href: null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: TabIcon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: space.lg, marginRight: space.lg },
  // The translucent circle keeps these legible over any poster art on Deck
  // (its header has no background of its own anymore) without looking out
  // of place on the other screens' solid header bars.
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
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
