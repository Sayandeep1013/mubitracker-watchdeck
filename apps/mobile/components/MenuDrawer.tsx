import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMenu } from '@/lib/menu';
import { useNotifications } from '@/lib/notifications';
import { color, space, type } from '@/lib/theme';

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
        style={[styles.drawer, { width: DRAWER_WIDTH }, drawerStyle]}
      >
        {/* Deep black + red, matching Profile's own look (its segmented
            control / primary button both use the same solid color.bg +
            color.primary language) — swapped back from a glass/blur
            treatment per explicit preference. */}
        <View style={[styles.drawerContent, { paddingTop: insets.top + space.lg }]}>
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
              <View style={styles.iconBadge}>
                <Feather name={item.icon} size={15} color={color.primary} />
              </View>
              <Text style={styles.rowText}>{item.label}</Text>
              {!!item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  // Deep black — matches Profile's own container background exactly
  // (color.bg), not a translucent/blurred fill.
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: color.bg,
    borderRightWidth: 1,
    borderRightColor: color.border,
    elevation: 16,
  },
  drawerContent: { flex: 1, paddingHorizontal: space.lg },
  title: { color: color.text, ...type.headline, marginBottom: space.lg },
  // A muted version of the "Undo button" glass look — confirmed live the
  // full-opacity red border + 56dp rows read as "too bright and big" for
  // four rows stacked in a list (the Undo pill is a single small one-off
  // accent, not meant to tile). Lower alpha border, smaller fill, more
  // compact sizing; still recognizably the same red-glass language.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    marginBottom: space.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${color.primary}40`,
    backgroundColor: `${color.primary}0F`,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  pressed: { opacity: 0.7 },
  rowText: { color: color.text, fontSize: type.label.fontSize, fontWeight: '600', flex: 1 },
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
