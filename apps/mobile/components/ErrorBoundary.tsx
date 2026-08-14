import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/lib/theme';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Best-effort, unauthenticated — a render crash can happen before login,
 * and this only ever produces a server console.error line (see
 * apps/web/src/app/api/v1/errors/route.ts), never a DB write. */
function reportError(error: Error) {
  fetch(`${baseUrl}/api/v1/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: error.message, stack: error.stack, platform: 'mobile' }),
  }).catch(() => {});
}

interface State {
  error: Error | null;
}

/** Root-level error boundary (spec 50 §6) — React error boundaries require
 * a class component; there's no hooks equivalent. Wraps RootLayout's
 * screen tree in _layout.tsx. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportError(error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.center} accessibilityLabel="Something went wrong">
          <Text style={styles.text}>Something went wrong.</Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  text: { color: color.textMuted, fontSize: type.body.fontSize },
  retryButton: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    minHeight: 48,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  retryText: { color: color.text, fontWeight: '600' },
});
