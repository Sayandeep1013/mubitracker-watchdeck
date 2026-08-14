import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '@/lib/notifications';
import { color, radius, space, type } from '@/lib/theme';

type FeatherName = keyof typeof Feather.glyphMap;

interface MenuItem {
  label: string;
  href: '/(tabs)/collection' | '/(tabs)/review-later' | '/(tabs)/friends' | '/(tabs)/profile' | '/watch-later' | '/about';
  icon: FeatherName;
  badge?: number;
}

export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();

  const items: MenuItem[] = [
    { label: 'Collection', href: '/(tabs)/collection', icon: 'grid' },
    { label: 'Review Later', href: '/(tabs)/review-later', icon: 'bookmark' },
    { label: 'Watch Later', href: '/watch-later', icon: 'clock' },
    { label: 'Friends', href: '/(tabs)/friends', icon: 'users', badge: unreadCount },
    { label: 'Profile', href: '/(tabs)/profile', icon: 'user' },
    { label: 'About', href: '/about', icon: 'info' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.closeHit}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <Feather name="x" size={22} color={color.text} />
        </Pressable>
      </View>

      {items.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => {
            router.back();
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  title: { color: color.text, ...type.headline },
  closeHit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
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
