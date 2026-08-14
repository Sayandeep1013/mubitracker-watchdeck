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
      onPress={() => router.push('/(tabs)/watch-later')}
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
      screenOptions={({ route }) => {
        // Deck has its own blurred, poster-tinted background (see
        // deck.tsx) that's meant to read as one continuous surface —
        // a solid header bar and solid tab bar on top of it were two
        // abrupt black bands cutting across it. Scoped to Deck only
        // (via `route.name`) so every other screen's plain dark
        // background keeps its normal solid chrome — those don't have
        // a gradient for a hard edge to interrupt.
        const isDeck = route.name === 'deck';
        return {
          // Bug, confirmed live: `headerTransparent` alone did NOT stop a
          // literal `headerStyle.backgroundColor` from still painting —
          // the header looked "complete black", not blurred at all, even
          // with headerTransparent: true, because this was set
          // unconditionally for every route. Has to be transparent itself
          // on Deck, not just omitted.
          headerStyle: { backgroundColor: isDeck ? 'transparent' : themeColor.bg },
          headerTintColor: themeColor.text,
          headerLeft: HamburgerHeaderLeft,
          headerTransparent: isDeck,
          // elevation/shadowOpacity/borderTopWidth all have to be zeroed
          // explicitly — confirmed live that `borderTopColor: 'transparent'`
          // alone still left a visible seam (Android's default elevation
          // shadow draws regardless of border color, and a 0-color border
          // that still has nonzero width can still catch light/AA oddly).
          tabBarStyle: isDeck
            ? {
                position: 'absolute',
                backgroundColor: 'transparent',
                borderTopWidth: 0,
                borderTopColor: 'transparent',
                elevation: 0,
                shadowOpacity: 0,
              }
            : { backgroundColor: themeColor.bg, borderTopColor: themeColor.border },
          // No BlurView of its own here anymore — confirmed live it created
          // a visible seam right above the tab bar, because Deck's own
          // screen content already has a full-bleed blurred backdrop
          // extending behind this exact region (see deck.tsx); adding a
          // second BlurView on top double-blurred just that strip, which
          // reads as a different tone than the single-blurred area above
          // it. `tabBarStyle`'s transparent background is enough on its
          // own — the one blur layer already underneath shows through.
          tabBarActiveTintColor: themeColor.text,
          tabBarInactiveTintColor: themeColor.textMuted,
          // Bottom-tabs' `animation` defaults to 'none' — confirmed live as
          // the jarry, instant cut both opening AND returning from a hidden
          // tab (Review Later/Friends/Watch Later/About, all `href: null`
          // here), unlike the Stack modals (Filters, review, friends/add)
          // which animate natively in both directions. 'fade' is the only
          // option that reads as smooth regardless of which two tabs are
          // involved — 'shift' assumes adjacent, visually related screens,
          // which doesn't hold for e.g. Deck <-> About. bottom-tabs' own
          // default fade duration (~150ms) still read as abrupt. 300ms, not
          // the Stack's 420ms: a cross-fade has no movement to carry a long
          // duration, so past ~300ms it stops reading as "smooth" and starts
          // reading as lag — slides can afford the longer curve, fades can't.
          animation: 'fade',
          transitionSpec: { animation: 'timing', config: { duration: 300 } },
        };
      }}
    >
      <Tabs.Screen
        name="deck"
        options={{ title: 'Deck', tabBarIcon: TabIcon('layers'), headerRight: DeckHeaderRight }}
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
      {/* Watch Later and About used to be separate root-level routes with
          their own hand-rolled "Title + Close" header and a plain Stack
          push, which read as a different, less-finished screen type next
          to Review Later/Friends (shared Tabs header with the hamburger
          menu, consistent push transition). Moved in here for the same
          reason those two were: `href: null` keeps them real, deep-linkable
          routes without adding a 6th item to the tab bar. */}
      <Tabs.Screen
        name="watch-later"
        options={{ title: 'Watch Later', tabBarIcon: TabIcon('clock'), href: null }}
      />
      <Tabs.Screen name="about" options={{ title: 'About', tabBarIcon: TabIcon('info'), href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: space.lg, marginRight: space.lg },
  // No background circle — confirmed live it read as a stray dark blob
  // floating over the header, not an intentional part of the design. The
  // icon's own white/red color is legible enough against both the solid
  // headers (Search/Collection/Profile) and Deck's darkened blur backdrop.
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
