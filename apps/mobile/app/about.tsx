import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, glassCard, space, type } from '@/lib/theme';

const TMDB_URL = 'https://www.themoviedb.org/';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.backHit}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>About Mubitracker</Text>
      <Text style={styles.body}>
        Mubitracker is a frictionless personal media memory system. Track what you&apos;ve watched
        with one decision per title.
      </Text>

      <View style={[styles.card, glassCard()]}>
        <Text style={styles.cardLabel}>Data Attribution</Text>
        <Text style={styles.body}>
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(TMDB_URL)}
          hitSlop={8}
          style={styles.linkHit}
          accessibilityRole="link"
          accessibilityLabel="Open The Movie Database website"
        >
          <Text style={styles.link}>The Movie Database (TMDB)</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg },
  backHit: { minHeight: 44, justifyContent: 'center', marginBottom: space.md },
  backText: { color: color.textMuted, fontSize: type.caption.fontSize },
  heading: { color: color.text, ...type.headline, marginBottom: space.md },
  body: { color: color.textMuted, marginBottom: space.md, lineHeight: 20 },
  card: {
    padding: space.lg,
  },
  cardLabel: {
    color: color.textMuted,
    fontSize: type.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: space.md,
  },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { color: color.primary, textDecorationLine: 'underline' },
});
