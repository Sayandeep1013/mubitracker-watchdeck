import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
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
  tint: string;
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
    { label: 'Review Later', href: '/(tabs)/review-later', icon: 'bookmark', tint: color.review },
    { label: 'Friends', href: '/(tabs)/friends', icon: 'users', tint: color.friends, badge: unreadCount },
    { label: 'Watch Later', href: '/watch-later', icon: 'clock', tint: color.warning },
    { label: 'About', href: '/about', icon: 'info', tint: color.info },
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
        {/* Frosted glass instead of a solid fill — blurs whatever's behind
            the drawer (the current screen's own content, already dimmed by
            the backdrop above), with a dark scrim on top so the menu stays
            legible regardless of what that content is. */}
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.drawerScrim} />
        <View style={[styles.drawerContent, { paddingTop: insets.top + space.lg }]}>
          <Text style={styles.title}>Menu</Text>
          {items.map((item) => (
            <Pressable
              key={item.href}
              onPress={() => {
                close();
                router.push(item.href);
              }}
              style={({ pressed }) => [
                styles.row,
                { borderLeftColor: item.tint },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={[styles.iconBadge, { backgroundColor: `${item.tint}26` }]}>
                <Feather name={item.icon} size={18} color={item.tint} />
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
  // No backgroundColor here — the BlurView + drawerScrim provide the
  // actual fill now; this is just the frame (position/size/edge/shadow).
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.14)',
    elevation: 16,
  },
  drawerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.45)' },
  drawerContent: { flex: 1, paddingHorizontal: space.lg },
  title: { color: color.text, ...type.headline, marginBottom: space.lg },
  // Rows stay a solid-ish surface (not further blurred) so the actual
  // tappable targets keep firm contrast against the glass panel behind
  // them — full translucency reads well for the panel itself, less so
  // for text-bearing controls a person needs to read at a glance.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    paddingHorizontal: space.md,
    backgroundColor: 'rgba(39,39,42,0.72)',
    marginBottom: space.sm,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
