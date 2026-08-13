import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@/lib/theme';

interface ScreenStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
}

/**
 * Shared loading / error / empty presentation.
 *
 * Returns null when there is nothing to say, so callers can render it directly
 * above their content and fall through to the real UI.
 */
export function ScreenState({
  loading,
  error,
  empty,
  emptyText = 'Nothing here yet',
  onRetry,
}: ScreenStateProps) {
  if (loading) {
    return (
      <View style={styles.center} accessibilityLabel="Loading">
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{emptyText}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  muted: { color: color.textMuted, textAlign: 'center' },
  error: { color: color.danger, textAlign: 'center', marginBottom: space.lg },
  retry: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pressed: { opacity: 0.6 },
  retryText: { color: color.text, fontWeight: '600' },
});
