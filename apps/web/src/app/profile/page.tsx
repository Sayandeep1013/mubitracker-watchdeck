'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApiClient, useSupabase } from '@/hooks/useApiClient';
import { ActionToast, type ToastState } from '@/components/ActionToast';
import type { Profile } from '@mubitracker/shared';

type PrivacyField = 'profileVisibility' | 'collectionVisibility' | 'reviewsVisibility';
type PrivacyValue = 'public' | 'friends' | 'private';

export default function ProfilePage() {
  const client = useApiClient();
  const supabase = useSupabase();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [importJson, setImportJson] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [copied, setCopied] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    client.getProfile().then(setProfile).catch(() => router.push('/login'));
  }, [client, router]);

  const showToast = (partial: Omit<ToastState, 'id'>) => {
    const id = ++toastId.current;
    setToast({ id, ...partial });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2500);
  };

  const exportData = async () => {
    try {
      const data = await client.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mubitracker-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Export failed', tone: 'error' });
    }
  };

  const importData = async () => {
    // Previously one catch covered both failure modes and always said "Invalid
    // JSON" — a well-formed payload the server rejected (e.g. a bad media id)
    // got the same wrong message as actually-malformed text.
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      showToast({ message: "That's not valid JSON", tone: 'error' });
      return;
    }
    try {
      const result = await client.importData(parsed as Parameters<typeof client.importData>[0]);
      showToast({ message: `Imported ${result.imported}, skipped ${result.skipped}`, tone: 'neutral' });
      setImportJson('');
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Import failed', tone: 'error' });
    }
  };

  const setPrivacyField = async (field: PrivacyField, value: PrivacyValue) => {
    if (!profile) return;
    const previous = profile[field];
    if (previous === value) return;
    setProfile({ ...profile, [field]: value });
    try {
      if (field === 'profileVisibility') await client.updateProfile({ profile_visibility: value });
      else if (field === 'collectionVisibility') await client.updateProfile({ collection_visibility: value });
      else await client.updateProfile({ reviews_visibility: value });
    } catch (e) {
      setProfile((p) => (p ? { ...p, [field]: previous } : p));
      showToast({ message: e instanceof Error ? e.message : 'Failed to save', tone: 'error' });
    }
  };

  const copyHandle = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.username);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast({ message: 'Could not copy — try selecting the text manually', tone: 'error' });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const deleteAccount = async () => {
    if (!confirm('Delete your account and all data? This cannot be undone.')) return;
    await client.deleteProfile();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!profile) return <div className="p-4 text-neutral-600">Loading...</div>;

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-2 text-2xl font-bold text-white">Profile</h1>
      <p className="mb-6 text-neutral-500">@{profile.username}</p>

      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Privacy</h2>
          <button
            type="button"
            onClick={copyHandle}
            className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-700"
          >
            {copied ? 'Copied!' : `Copy handle @${profile.username}`}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-300" htmlFor="profile-visibility">
              Profile visibility
            </label>
            <select
              id="profile-visibility"
              value={profile.profileVisibility === 'private' ? 'private' : 'public'}
              onChange={(e) => setPrivacyField('profileVisibility', e.target.value as 'public' | 'private')}
              className="w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-white"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Public lets people find you by typing part of your username. Anyone who knows your
              exact handle can always send a request.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-300" htmlFor="collection-visibility">
              Collection visibility
            </label>
            <select
              id="collection-visibility"
              value={profile.collectionVisibility}
              onChange={(e) =>
                setPrivacyField('collectionVisibility', e.target.value as 'public' | 'friends' | 'private')
              }
              className="w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-white"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="private">Private</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500">Who can see what you&apos;ve watched.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-300" htmlFor="reviews-visibility">
              Reviews visibility
            </label>
            <select
              id="reviews-visibility"
              value={profile.reviewsVisibility}
              onChange={(e) =>
                setPrivacyField('reviewsVisibility', e.target.value as 'public' | 'friends' | 'private')
              }
              className="w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-white"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="private">Private</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500">Who can read your reviews.</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 p-3">
          <p className="text-2xl font-bold text-green-400">{profile.watchedCount ?? 0}</p>
          <p className="text-xs text-neutral-500">Watched</p>
        </div>
        <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 p-3">
          <p className="text-2xl font-bold text-purple-400">{profile.reviewCount ?? 0}</p>
          <p className="text-xs text-neutral-500">Reviews</p>
        </div>
        <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 p-3">
          <p className="text-2xl font-bold text-blue-400">{profile.friendsCount ?? 0}</p>
          <p className="text-xs text-neutral-500">Friends</p>
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={exportData}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-left text-sm text-neutral-300 hover:border-neutral-700"
        >
          Export JSON
        </button>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="mb-2 text-xs text-neutral-500">Import JSON</p>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Paste mubitracker.json content..."
            rows={4}
            className="mb-2 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-xs text-white placeholder-neutral-700"
          />
          <button
            type="button"
            onClick={importData}
            disabled={!importJson.trim()}
            className="rounded bg-red-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Import
          </button>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-left text-sm text-neutral-300 hover:border-neutral-700"
        >
          Sign Out
        </button>

        <Link
          href="/about"
          className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-300 hover:border-neutral-700"
        >
          About / TMDB Credits
        </Link>

        <button
          type="button"
          onClick={deleteAccount}
          className="w-full rounded-lg border border-red-900/40 bg-red-500/5 px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10"
        >
          Delete Account
        </button>
      </div>

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
