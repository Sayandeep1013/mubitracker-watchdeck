import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
        <ActivityIndicator color="#ef4444" />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#71717a', textAlign: 'center' },
  error: { color: '#f87171', textAlign: 'center', marginBottom: 16 },
  retry: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  pressed: { opacity: 0.6 },
  retryText: { color: '#fafafa', fontWeight: '600' },
});
