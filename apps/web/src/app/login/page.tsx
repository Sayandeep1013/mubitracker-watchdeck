'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { usernameToAuthEmail } from '@watchdeck/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cleanUsername = username.trim().toLowerCase();
      if (!cleanUsername || cleanUsername.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        throw new Error('Username: letters, numbers, and underscores only');
      }

      if (mode === 'signup') {
        const res = await fetch('/api/v1/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error?.message ?? 'Sign up failed');
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usernameToAuthEmail(cleanUsername),
        password,
      });
      if (signInError) throw signInError;

      router.push('/deck');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-2 text-center">
          <span className="text-4xl font-black tracking-tighter text-red-500">W</span>
          <span className="text-2xl font-bold tracking-tight text-neutral-200">ATCHDECK</span>
        </div>
        <p className="mb-8 text-center text-sm text-neutral-600">
          Track media at the speed of thought
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            minLength={3}
            maxLength={30}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/20"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/20"
          />
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-600">
          {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            className="text-red-400 hover:text-red-300"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
