# 12 — Friends System (v1)

Status: **design ready for review** (2026-08-12)  
Supersedes implementation gaps in [`09-social-phase.md`](09-social-phase.md). Product principles from 09 still apply: **no activity feed**, mutual friends only, social exists to answer *“what has my friend watched that I haven’t?”*

---

## 1. Goals

1. Add a friend by **exact username** or **search-as-you-type**
2. Receiver sees requests via **bell badge** + **pending list** + **live toast** if online
3. Receiver can **Accept / Decline / Block**
4. After accept: compare collections, open “Their Deck” (`friend watched ∩ I haven’t`)
5. Privacy: exact lookup always works; **partial search only public profiles**

---

## 2. Decisions (locked)

| Topic | Choice |
|---|---|
| Notification | In-app bell + pending list + live toast while online |
| Add friend | Exact username **and** search-as-you-type |
| Search visibility | Exact username → anyone; partial search → `profile_visibility = public` only |
| Request actions | Accept / Decline / Block |
| Relationship model | Mutual only (`pending` → `accepted` or `blocked`) |
| Activity feed | Out of scope |
| Email notify | Out of scope (no real email on accounts) |

---

## 3. Data model

### Existing

```text
friendships(
  id uuid PK,
  requester_id → profiles,
  receiver_id → profiles,
  status: pending | accepted | blocked,
  created_at, updated_at
)
UNIQUE(requester_id, receiver_id)
```

### Additions for v1

```text
notifications(
  id uuid PK,
  user_id → profiles,          -- recipient
  type text NOT NULL,          -- 'friend_request' | 'friend_accepted'
  actor_id → profiles,         -- who triggered it
  friendship_id uuid NULL,     -- related row
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)
INDEX (user_id, read_at, created_at DESC)
```

Bell unread count = `notifications where user_id = me AND read_at IS NULL`.

Optional later (not required for v1 toast): Supabase Realtime on `notifications` for the signed-in user.

### Pair uniqueness rule

Normalize direction so A↔B is one logical pair:

- Before insert: if reverse pending exists, **auto-accept** both directions into one accepted friendship (A requested B while B’s request to A was pending → friends immediately).
- If either side `blocked`, reject new requests from the blocked party.
- Decline = delete pending row (or set status deleted); requester may send again later.
- Block = set `blocked`; hide from search for blocker; reject future requests from blocked user until unblock (unblock = delete row).

---

## 4. Discovery & send request

### Exact username

1. User types `@sayan` (or `sayan`)
2. `POST /api/v1/friends` `{ "username": "sayan" }`
3. Server normalizes (lowercase), looks up `profiles.username`
4. Outcomes:
   - not found → 404
   - self → 400
   - already friends → 409
   - already pending (same direction) → 409
   - reverse pending → accept existing, notify both
   - blocked either way → 403
   - else insert `pending` + create notification for receiver

### Search-as-you-type

`GET /api/v1/friends/search?q=say&limit=10`

- `q` min 2 characters
- Match `profiles.username ILIKE q%` (prefix) for snappy results
- **Only** rows with `profile_visibility = 'public'`
- Exclude: self, already accepted, blocked pairs
- Response: `{ id, username, avatarUrl }[]` — never collection data

Exact send still works for private profiles when the handle is known.

### Profile link (phase stretch)

`/u/{username}` — public card if profile public; private profiles show “Add by username” only to self-known handles. Not required to ship request/accept loop.

---

## 5. Notifications UX

### Bell (global chrome)

- Nav: bell icon next to Profile (desktop) / accessible from Friends (mobile)
- Badge = unread notification count (cap display at `9+`)
- Click → notification panel / Friends → Pending tab

### Pending list (Friends page)

Tabs: **Friends** | **Incoming** | **Outgoing**

Incoming row:

```text
@alex wants to be friends
[Accept] [Decline] [Block]
```

Outgoing row:

```text
Request sent to @alex · Pending
[Cancel]
```

### Live toast (online)

When a new `friend_request` notification is created for the current user:

1. Prefer **Supabase Realtime** subscription on `notifications` filtered by `user_id=me`
2. Fallback if Realtime not wired yet: **poll** `GET /api/v1/notifications?unread=1` every 30s while tab visible

Toast copy:

```text
Friend request from @alex
[View] [Accept]
```

Accept from toast hits the same accept API; dismiss marks that notification read.

### Read state

- Opening Incoming tab marks friend_request notifications read
- Accept/Decline/Block marks related notification read
- Badge clears when unread count hits 0

---

## 6. Accept / Decline / Block

| Action | Who | Effect |
|---|---|---|
| Accept | Receiver | `status=accepted`; notify requester (`friend_accepted`); both see each other under Friends |
| Decline | Receiver | Delete pending friendship; mark notification read; requester may re-request |
| Cancel | Requester | Delete own outgoing pending |
| Block | Receiver (or either after accept) | `status=blocked`; remove from friends lists; reject future requests from blocked user; optional: hide blocker’s profile from blocked user |

API:

```text
POST /api/v1/friends                 body: { username } | { user_id }
GET  /api/v1/friends                 ?status=accepted|pending_in|pending_out
GET  /api/v1/friends/search?q=
POST /api/v1/friends/:id/accept
POST /api/v1/friends/:id/decline
POST /api/v1/friends/:id/cancel
POST /api/v1/friends/:id/block
GET  /api/v1/notifications
POST /api/v1/notifications/read      body: { ids?: uuid[], all?: true }
```

(`:id` = friendship id)

---

## 7. After accept

Available when `status=accepted` **and** friend’s `collection_visibility` allows friends (or public):

| Action | Behavior |
|---|---|
| Compare | Existing compare API — counts + lists |
| Their Deck | `/deck?friend_id={id}&friend_mode=watched_not_me` (URL filters already wired) |
| Friend profile | Username, avatar, counts; collection sections per privacy |

If collection is private: show profile shell + “Collection is private”.

---

## 8. Privacy & RLS

| Setting | Default | Friend impact |
|---|---|---|
| `profile_visibility` | private | Controls partial search inclusion; exact username still resolves for requests |
| `collection_visibility` | friends | Accepted friends can read collection / compare / their-deck |
| `reviews_visibility` | friends | Accepted friends can read reviews |

Server uses **service role** for API routes today; still enforce authorization checks in handlers (do not rely on client). Add/adjust RLS when browser ever queries profiles directly:

- Friends may `SELECT` friend profiles when friendship accepted
- Notifications: user can only `SELECT`/`UPDATE` own rows

---

## 9. Performance notes (hobby scale)

- Friend graphs of tens of users are trivial on Supabase free tier
- Index `profiles(username)` already exists; add `profiles(username text_pattern_ops)` only if prefix search is slow (unlikely)
- Notifications are tiny; bell query is a count
- Realtime optional; polling 30s is fine for v1

**SQLite / local cache:** not needed for friends. For deck speed, local SQLite helps **mobile offline queue** (already scaffolded), not web TMDB discover latency. Shared `media` cache in Postgres already prevents re-downloading metadata per user.

---

## 10. Implementation plan (ordered)

1. Migration: `notifications` table + RLS
2. API: search, decline, cancel, notifications list/read; fix list to split incoming/outgoing
3. On friend request insert → write notification
4. Web: bell in shell + Friends tabs (Incoming / Outgoing / Friends)
5. Toast via Realtime or 30s poll
6. Wire Accept/Decline/Block/Cancel UI
7. Verify compare + Their Deck with two accounts
8. Privacy checks (private collection not leaked)

---

## 11. Acceptance criteria

- [ ] Exact username send works for public and private profiles
- [ ] Partial search returns only public profiles, never private
- [ ] Receiver gets unread bell badge
- [ ] Online receiver sees toast for new request
- [ ] Accept → both listed as friends; requester gets accepted notification
- [ ] Decline removes pending; can request again
- [ ] Block prevents further requests from that user
- [ ] Cancel removes outgoing pending
- [ ] Reverse pending auto-accepts
- [ ] Their Deck / Compare work only when accepted + collection allows
- [ ] No activity feed shipped

---

## 12. Explicit non-goals

- Email / push notifications
- Followers (one-way)
- Chat / comments
- Activity feed
- Suggesting friends from contacts

---

## 13. Follow-up package (deck UX — separate spec next)

Not part of this friends ship, but queued from the same conversation:

1. Multi-select type chips (Anime + Anime Movies, Movies + Series, …)
2. Sticky last action (Watched stays selected for next card)
3. Fix Review Later → Reviews tab
4. New **Watch Later** queue (↑); ↓ = Review Later
5. Search page filters

Spec to write after this friends doc is approved: `13-deck-actions-watch-later.md`.
