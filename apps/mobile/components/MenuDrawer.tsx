import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMenu } from '@/lib/menu';
import { useNotifications } from '@/lib/notifications';
import { color, radius, space, type } from '@/lib/theme';

type FeatherName = keyof typeof Feather.glyphMap;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

interface MenuItem {
  label: string;
  href: '/(tabs)/review-later' | '/(tabs)/friends' | '/watch-later' | '/about';
  icon: FeatherName;
  badge?: number;
}

/**
 * A side-sliding drawer (not a separate routed screen) so opening it never
 * navigates away from — or covers — the current tab as a full page. Rendered
 * once at the root, above the Stack, so it overlays the tab bar too.
 *
 * Only the items that moved OUT of the bottom tab bar live here (Review
 * Later, Friends) plus the two that were never tabs to begin with (Watch
 * Later, About) — Deck/Search/Collection/Profile stay as real tabs.
 */
export function MenuDrawer() {
  const { isOpen, close } = useMenu();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: 200, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOpen, translateX, backdropOpacity]);

  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const items: MenuItem[] = [
    { label: 'Review Later', href: '/(tabs)/review-later', icon: 'bookmark' },
    { label: 'Friends', href: '/(tabs)/friends', icon: 'users', badge: unreadCount },
    { label: 'Watch Later', href: '/watch-later', icon: 'clock' },
    { label: 'About', href: '/about', icon: 'info' },
  ];

  return (
    <>
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[styles.backdrop, backdropStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[styles.drawer, { width: DRAWER_WIDTH, paddingTop: insets.top + space.lg }, drawerStyle]}
      >
        <Text style={styles.title}>Menu</Text>
        {items.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => {
              close();
              router.push(item.href);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Feather name={item.icon} size={20} color={color.text} />
            <Text style={styles.rowText}>{item.label}</Text>
            {!!item.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: color.bg,
    borderRightWidth: 1,
    borderRightColor: color.border,
    paddingHorizontal: space.lg,
    elevation: 16,
  },
  title: { color: color.text, ...type.headline, marginBottom: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: color.surface,
    marginBottom: space.sm,
  },
  pressed: { opacity: 0.7 },
  rowText: { color: color.text, fontSize: type.body.fontSize, fontWeight: '600', flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
