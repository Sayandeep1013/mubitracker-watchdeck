import { usernameToAuthEmail } from '@mubitracker/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { color, glassChip, radius, space, type } from '@/lib/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3) throw new Error('Username must be at least 3 characters');
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        throw new Error('Username: letters, numbers, and underscores only');
      }

      if (mode === 'signup') {
        const res = await fetch(`${API_URL}/api/v1/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error?.message ?? 'Sign up failed');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usernameToAuthEmail(cleanUsername),
        password,
      });
      if (signInError) throw signInError;
      router.replace('/(tabs)/deck');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>Mubitracker</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Username"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={color.textMuted}
          secureTextEntry
          style={styles.input}
          accessibilityLabel="Password"
        />
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.btn, glassChip(), pressed && styles.pressed, loading && styles.disabled]}
          onPress={submit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={mode === 'login' ? 'Sign in' : 'Create account'}
          accessibilityState={{ disabled: loading }}
        >
          <Text style={styles.btnText}>
            {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
          hitSlop={8}
          style={styles.switchHit}
          accessibilityRole="button"
          accessibilityLabel={mode === 'login' ? 'Switch to sign up' : 'Switch to sign in'}
        >
          <Text style={styles.switch}>
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  logo: { color: color.text, ...type.display, textAlign: 'center', marginBottom: space.xxl },
  input: {
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    padding: space.lg,
    color: color.text,
    marginBottom: space.md,
    minHeight: 48,
  },
  error: { color: color.danger, marginBottom: space.md, fontSize: type.caption.fontSize },
  btn: { padding: space.lg, minHeight: 48, justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  btnText: { color: color.primary, textAlign: 'center', fontWeight: '700' },
  switchHit: { minHeight: 48, justifyContent: 'center' },
  switch: { color: color.textMuted, textAlign: 'center', marginTop: space.lg },
});
