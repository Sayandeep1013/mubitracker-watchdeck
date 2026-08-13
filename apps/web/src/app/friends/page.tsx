'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '@/hooks/useApiClient';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';

interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  blockedBy?: string | null;
  direction?: string;
  friend?: { id: string; username: string };
}

type Tab = 'friends' | 'incoming' | 'outgoing' | 'blocked';

export default function FriendsPage() {
  const client = useApiClient();
  const searchParams = useSearchParams();
  const { markIncomingRead, markFriendshipNotificationsRead } = useNotificationsFeed();
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'incoming' ? 'incoming' : 'friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [incoming, setIncoming] = useState<Friendship[]>([]);
  const [outgoing, setOutgoing] = useState<Friendship[]>([]);
  const [blocked, setBlocked] = useState<Friendship[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [showNudge, setShowNudge] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<{ id: string; username: string }[]>([]);
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState<{
    bothWatched: number;
    youOnly: number;
    friendOnly: number;
  } | null>(null);

  const load = useCallback(async () => {
    const [a, i, o, b] = await Promise.all([
      client.getFriends('accepted'),
      client.getFriends('pending_in'),
      client.getFriends('pending_out'),
      client.getFriends('blocked'),
    ]);
    setFriends(a as Friendship[]);
    setIncoming(i as Friendship[]);
    setOutgoing(o as Friendship[]);
    setBlocked(b as Friendship[]);
  }, [client]);

  useEffect(() => {
    load().catch(() => setError('Failed to load friends'));
    client
      .getProfile()
      .then((p) => {
        setMyId(p.id);
        setMyUsername(p.username);
        const dismissed = window.localStorage.getItem(`mubitracker:discoverable-nudge-dismissed:${p.id}`);
        if (p.profileVisibility === 'private' && !dismissed) setShowNudge(true);
      })
      .catch(() => {});
  }, [load, client]);

  // Spec 40 §7: viewing Incoming — not opening the notification bell —
  // is what clears friend-request unreads.
  useEffect(() => {
    if (tab === 'incoming') markIncomingRead();
  }, [tab, markIncomingRead]);

  const dismissNudge = (persist: boolean) => {
    setShowNudge(false);
    if (persist && myId) {
      window.localStorage.setItem(`mubitracker:discoverable-nudge-dismissed:${myId}`, '1');
    }
  };

  const makeDiscoverable = async () => {
    try {
      await client.updateProfile({ profile_visibility: 'public' });
    } finally {
      dismissNudge(true);
    }
  };

  const copyHandle = async () => {
    if (!myUsername) return;
    try {
      await navigator.clipboard.writeText(myUsername);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy — try selecting the text manually');
    }
  };

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      client
        .searchFriends(searchQ.trim())
        .then((r) => setSearchHits(r.results))
        .catch(() => setSearchHits([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchQ, client]);

  const sendByUsername = async () => {
    if (!username.trim()) return;
    setError('');
    try {
      await client.sendFriendRequest({ username: username.trim() });
      setUsername('');
      await load();
      setTab('outgoing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    }
  };

  const sendById = async (userId: string) => {
    setError('');
    try {
      await client.sendFriendRequest({ user_id: userId });
      setSearchQ('');
      setSearchHits([]);
      await load();
      setTab('outgoing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Friends</h1>
        {myUsername && (
          <button
            type="button"
            onClick={copyHandle}
            className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-700"
          >
            {copied ? 'Copied!' : `Copy handle @${myUsername}`}
          </button>
        )}
      </div>

      {showNudge && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-900/40 bg-red-500/5 px-3 py-3">
          <p className="text-sm text-neutral-300">Let people find you by username?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={makeDiscoverable}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              Make me discoverable
            </button>
            <button
              type="button"
              onClick={() => dismissNudge(true)}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 space-y-2 rounded-xl border border-neutral-800 p-3">
        <p className="text-xs uppercase text-neutral-500">Add by username</p>
        <div className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={sendByUsername}
            className="rounded-lg bg-red-600 px-4 text-sm font-medium text-white"
          >
            Send
          </button>
        </div>
        <p className="text-xs uppercase text-neutral-500">Search public profiles</p>
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Type at least 2 letters…"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
        />
        {searchHits.length > 0 && (
          <ul className="rounded-lg border border-neutral-800 divide-y divide-neutral-800">
            {searchHits.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-neutral-200">@{h.username}</span>
                <button
                  type="button"
                  onClick={() => sendById(h.id)}
                  className="text-xs text-red-400"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="mb-4 flex gap-1">
        {(
          [
            ['friends', 'Friends'],
            ['incoming', `Incoming${incoming.length ? ` (${incoming.length})` : ''}`],
            ['outgoing', 'Outgoing'],
            ['blocked', 'Blocked'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              tab === id
                ? 'border-red-500/40 text-red-400'
                : 'border-neutral-800 text-neutral-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'incoming' && (
        <div className="space-y-2">
          {incoming.length === 0 ? (
            <p className="text-sm text-neutral-600">No incoming requests</p>
          ) : (
            incoming.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 px-3 py-3"
              >
                <p className="text-sm text-white">@{f.friend?.username ?? 'unknown'}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await client.acceptFriend(f.id);
                      markFriendshipNotificationsRead(f.id);
                      load();
                    }}
                    className="rounded border border-green-700 px-2 py-1 text-xs text-green-400"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await client.declineFriend(f.id);
                      markFriendshipNotificationsRead(f.id);
                      load();
                    }}
                    className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await client.blockFriend(f.id);
                      markFriendshipNotificationsRead(f.id);
                      load();
                    }}
                    className="rounded border border-red-900 px-2 py-1 text-xs text-red-400"
                  >
                    Block
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'outgoing' && (
        <div className="space-y-2">
          {outgoing.length === 0 ? (
            <p className="text-sm text-neutral-600">No outgoing requests</p>
          ) : (
            outgoing.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 px-3 py-3"
              >
                <p className="text-sm text-neutral-300">
                  To @{f.friend?.username ?? 'unknown'} · Pending
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await client.cancelFriend(f.id);
                    markFriendshipNotificationsRead(f.id);
                    load();
                  }}
                  className="rounded border border-neutral-700 px-2 py-1 text-xs"
                >
                  Cancel
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'blocked' && (
        <div className="space-y-2">
          {blocked.length === 0 ? (
            <p className="text-sm text-neutral-600">No blocked users</p>
          ) : (
            blocked.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 px-3 py-3"
              >
                <p className="text-sm text-neutral-300">@{f.friend?.username ?? 'Unknown'}</p>
                {f.blockedBy === myId ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await client.unblockFriend(f.id);
                      load();
                    }}
                    className="rounded border border-neutral-700 px-2 py-1 text-xs"
                  >
                    Unblock
                  </button>
                ) : (
                  <span className="text-xs text-neutral-600">Blocked you</span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="text-sm text-neutral-600">No friends yet</p>
          ) : (
            friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 px-3 py-3"
              >
                <p className="font-medium text-white">@{f.friend?.username ?? 'Unknown'}</p>
                {f.friend && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const data = await client.compareWithFriend(f.friend!.id);
                        setComparison(data);
                      }}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs"
                    >
                      Compare
                    </button>
                    <a
                      href={`/deck?friend_id=${f.friend.id}&friend_mode=watched_not_me`}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs"
                    >
                      Their Deck
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {comparison && (
        <div className="mt-6 rounded-xl border border-neutral-800 p-4 text-sm text-neutral-400">
          <p>Both watched: {comparison.bothWatched}</p>
          <p>You only: {comparison.youOnly}</p>
          <p>Friend only: {comparison.friendOnly}</p>
        </div>
      )}
    </div>
  );
}
