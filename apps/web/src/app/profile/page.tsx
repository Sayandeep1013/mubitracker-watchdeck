'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApiClient, useSupabase } from '@/hooks/useApiClient';
import type { Profile } from '@watchdeck/shared';

export default function ProfilePage() {
  const client = useApiClient();
  const supabase = useSupabase();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [importJson, setImportJson] = useState('');

  useEffect(() => {
    client.getProfile().then(setProfile).catch(() => router.push('/login'));
  }, [client, router]);

  const exportData = async () => {
    const data = await client.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchdeck-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importData = async () => {
    try {
      const parsed = JSON.parse(importJson);
      const result = await client.importData(parsed);
      alert(`Imported ${result.imported}, skipped ${result.skipped}`);
      setImportJson('');
    } catch {
      alert('Invalid JSON');
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

      <div className="mb-6 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 p-3">
          <p className="text-2xl font-bold text-green-400">{profile.watchedCount ?? 0}</p>
          <p className="text-xs text-neutral-00">Watched</p>
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
            placeholder="Paste watchdeck.json content..."
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
          className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-????00 hover:border-neutral-700"
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
    </div>
  );
}
