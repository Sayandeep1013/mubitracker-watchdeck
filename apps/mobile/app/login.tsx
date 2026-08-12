import { usernameToAuthEmail } from '@watchdeck/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';

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
    <View style={styles.container}>
      <Text style={styles.logo}>Watchdeck</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
        placeholderTextColor="#71717a"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#71717a"
        secureTextEntry
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={submit} disabled={loading}>
        <Text style={styles.btnText}>
          {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setMode(mode === 'login' ? 'signup' : 'login');
          setError('');
        }}
      >
        <Text style={styles.switch}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', padding: 24 },
  logo: { color: '#fff', fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#18181b', borderRadius: 8, padding: 16, color: '#fff', marginBottom: 12 },
  error: { color: '#f87171', marginBottom: 12, fontSize: 13 },
  btn: { backgroundColor: '#dc2626', padding: 16, borderRadius: 8 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  switch: { color: '#a1a1aa', textAlign: 'center', marginTop: 16 },
});
