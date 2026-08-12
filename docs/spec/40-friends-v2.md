# 40 — Friends v2

Status: **draft** (2026-08-12)

Extends [`12-friends-system.md`](12-friends-system.md). Every decision locked in spec 12 §2 stands —
in particular **exact username resolves for anyone; partial/prefix search returns
`profile_visibility = 'public'` profiles only** (implemented in
`apps/web/src/app/api/v1/friends/search/route.ts`). This doc only closes the gaps found in
[`../AUDIT-2026-08-12.md`](../AUDIT-2026-08-12.md).

**Do not redesign:** request → accept → mutual, Compare, and Their Deck are verified working
end-to-end (audit §5). No activity feed (spec 12 §12 non-goals unchanged).

---

## 1. Gap summary

| # | Gap | Evidence |
|---|---|---|
| 1 | Search finds nobody | `profiles.profile_visibility` defaults `'private'` (`supabase/migrations/20250812000000_initial_schema.sql:17`) and no UI sets it |
| 2 | Mobile has zero friends UI | 0 occurrences of "friend" in `apps/mobile`; 11 client methods unused |
| 3 | Block is irreversible | only `POST` exists at `apps/web/src/app/api/v1/friends/[id]/block/route.ts` |
| 4 | `friendMode` collapses to one predicate | `apps/web/src/lib/deck/generate.ts:273-277` |
| 5 | Duplicate friendship rows | reverse-*pending* handled, reverse-*accepted* not (`apps/web/src/app/api/v1/friends/route.ts`) |
| 6 | Notifications drift from spec 12 §6 | path, read-timing, and missing toast action |

---

## 2. Privacy: making discovery possible

The privacy rule is not the bug — the missing control is. Fix is UI plus an explicit,
non-silent default policy.

| Decision | Choice | Rationale |
|---|---|---|
| Schema default | **Keep `'private'`** — no migration, no backfill | Never flip existing users to discoverable without consent |
| Control | Privacy card on `/profile` (`32-web-ux.md` §8) and Mobile Profile | `PATCH /api/v1/profile` + `client.updateProfile()` already accept `profile_visibility` |
| First-run nudge | One-time inline prompt at the top of Friends: *"Let people find you by username?"* `[Make me discoverable] [Not now]` — dismissal persisted per user | Converts the default without a silent policy change |
| Always-available path | Friends screens show `@{username}` with **Copy handle**; exact-handle requests work while private | Preserves spec 12 §1 goal 5 |
| `collection_visibility` | stays `'friends'` default | Their Deck / Compare keep working after accept |

`profile_visibility` is presented as a two-value toggle (Public / Private) on both clients; the enum
still carries `'friends'`, which is treated as private for prefix search (current query is
`.eq('profile_visibility','public')` — leave it exact).

---

## 3. Mobile friends UI

Mobile has 5 tabs (`apps/mobile/app/(tabs)/_layout.tsx`) and no social surface at all. Add a
**Friends** tab (`IconFeather 'users'`) between Collection and Profile, backed entirely by existing
shared-client methods.

| Screen | Route | Contents | Client calls |
|---|---|---|---|
| Friends list | `(tabs)/friends.tsx` | Segmented control **Friends / Incoming / Outgoing**; rows show avatar + `@username`; badge on Incoming | `getFriends('accepted' \| 'pending_in' \| 'pending_out')` |
| Add friend | header **+** → modal `friends/add.tsx` | Exact-handle field + Send; debounced (250ms) prefix search list with **Add** per row; min 2 chars | `sendFriendRequest({username})`, `sendFriendRequest({user_id})`, `searchFriends(q)` |
| Incoming row actions | inline | `[Accept] [Decline] [Block]` | `acceptFriend`, `declineFriend`, `blockFriend` |
| Outgoing row actions | inline | `[Cancel]` | `cancelFriend` |
| Friend detail | `friends/[id].tsx` | Username, counts, **Compare**, **Their Deck**, overflow → Block / Unblock | `getFriendProfile`, `compareWithFriend`, `unblockFriend` |
| Notifications | header bell on Friends tab + badge on the tab icon | List of `friend_request` / `friend_accepted`; tapping a request opens Incoming | `getNotifications`, `markNotificationsRead` |

Mobile requirements (these are the mobile failures the audit called out elsewhere — do not repeat them
here):

- Every action is `await`ed, wrapped in `try/catch`, and produces a toast/`Alert` on both success and
  failure. No fire-and-forget.
- Screens refresh with `useFocusEffect`, not a bare `useEffect(…, [])`.
- Loading skeletons and an error + **Retry** state on every list.
- Modals use `SafeAreaView`.
- Friend counts and Incoming badge refresh on tab focus and on any mutation.

Their Deck opens the deck screen with `friend_id` + `friend_mode=watched_not_me` in params, matching
web (`apps/web/src/app/friends/page.tsx` Their Deck link).

---

## 4. Unblock

Spec 12 §3 already defines unblock as **delete the row**. Add the route:

```text
DELETE /api/v1/friends/:id/block     -- unblock: delete the blocked friendship row
POST   /api/v1/friends/:id/block     -- unchanged: set status='blocked'
```

Rules:

- Only the **blocker** may unblock. Store the blocker: add `blocked_by uuid NULL REFERENCES profiles(id)`
  to `friendships`, set on `POST`, cleared implicitly by the delete. Without it the API cannot tell who
  blocked whom (the row keeps its original requester/receiver ordering).
- `DELETE` returns `404` when the row is not `blocked`, `403` when the caller is not `blocked_by`.
- After unblock the pair returns to **no relationship** — either side may send a fresh request.
- Blocked users are excluded from search results in both directions (already true) and blocked pairs
  never appear in `GET /api/v1/friends` (`status` filter defaults to `.neq('status','blocked')`).
- Client: add `unblockFriend(id)` next to `blockFriend(id)` in `packages/shared/src/api-client.ts`.
- Surface: **Blocked** section on the web `/friends` page and mobile friend detail, each row with
  **Unblock**.

*(Stretch, not required to ship: `POST /api/v1/friends/block` with `{ user_id }` to block a stranger
who has no existing row — audit §3.)*

---

## 5. `friendMode` semantics

`generate.ts:273-277` applies the same predicate for `watched_not_me`, `watched`, and unset, and never
handles `reviewed` (declared in `packages/shared/src/types/filters.ts`). Correct table:

| `friend_mode` | Candidate set | Additional predicate | Notes |
|---|---|---|---|
| unset (with `friend_id`) | friend's watched | = `watched_not_me` | Their Deck default; matches spec 12 §7 |
| `watched_not_me` | friend's watched | exclude anything in my `watched` / `watch_later` | "What have they seen that I haven't?" |
| `watched` | friend's watched | **no** exclusion of my history | Browse their whole watched list; must bypass the global watched exclusion in `getExcludedMediaIds` |
| `reviewed` | friend's `reviews.media_id` | exclude my `watched` / `watch_later` unless combined with `watched` | Requires new `getFriendReviewedIds()`; gated on the friend's `reviews_visibility` |

Additional rules:

1. An unknown `friend_mode` value is a `400`, not a silent fallback.
2. `friend_id` without an **accepted** friendship → `403`.
3. `reviewed` returns `403` when `reviews_visibility = 'private'` or is `'friends'` without acceptance.
4. **Candidate source change:** for any friend mode, seed candidates from the friend's
   `user_media` / `reviews` joined to `media` rather than intersecting random TMDB discover pages.
   Today `getFriendWatchedIds()` builds the set but candidates still come from TMDB discover, so a
   friend's title only appears if it happens to land on a random page — that is why Their Deck is thin.
   Friend decks are a **finite, known set**; paginate it directly with a stable cursor
   (`(watched_at, media_id)` descending), which also makes friend decks fast and repeat-free.

---

## 6. Pair uniqueness

`UNIQUE(requester_id, receiver_id)` only protects one direction. `POST /api/v1/friends` checks
blocked-either-way and reverse-**pending** (auto-accept), but not reverse-**accepted** — so after A→B
is accepted, B can request A and create a second row.

Spec:

1. Before insert, load **any** row for the pair with `friendshipPairFilter(user.id, targetId)` and
   branch on status:

| Existing row | Response |
|---|---|
| `accepted` (either direction) | `409 ALREADY_FRIENDS` |
| `pending`, same direction | `409 REQUEST_PENDING` |
| `pending`, reverse direction | auto-accept the existing row (spec 12 §3, unchanged) |
| `blocked`, either direction | `403` |
| none | insert `pending` + notification |

2. Enforce it in the database too, so concurrent requests cannot race:

```sql
CREATE UNIQUE INDEX friendships_pair_uniq
  ON friendships (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));
```

3. Keep mapping unique-violation `23505` to `409 CONFLICT` — with the index above it now also catches
   the reverse direction.
4. Add a pre-migration de-duplication step: for any pair with multiple rows keep the one with the
   strongest status (`accepted` > `pending`), preferring the oldest `created_at`, and delete the rest.

---

## 7. Notifications alignment

| Drift | Current | Required |
|---|---|---|
| Endpoint path | `POST /api/v1/notifications` (`api-client.ts` `markNotificationsRead`) | Canonical `POST /api/v1/notifications/read` per spec 12 §6. Keep the old path as a deprecated alias for one release; both accept `{ ids?: uuid[], all?: true }` |
| Read timing | Bell click marks **all** read (`NotificationBell.tsx` `markAll`) | Opening the panel marks nothing. Mark `friend_request` notifications read when the **Incoming tab is viewed**; mark the related notification read on Accept / Decline / Block / Cancel; keep an explicit **Mark all read** control in the panel |
| Toast actions | `[Open Friends]` only | `[View] [Accept]` per spec 12 §5 — Accept calls `POST /api/v1/friends/:id/accept` using `friendshipId` (already returned by `GET /api/v1/notifications`), then marks that notification read and refreshes the badge |
| Badge parity | Web only, desktop rail only | Mobile Friends tab badge + web More menu badge (`32-web-ux.md` §6); same `9+` cap |

Polling stays at 30s while the tab/app is visible (spec 12 §9); Realtime remains optional.

---

## 8. Acceptance criteria

- [ ] `/profile` and mobile Profile can set `profile_visibility`; the change round-trips through
      `PATCH /api/v1/profile` and persists after reload
- [ ] With account A set to Public, account B typing a 2-char prefix of A's username finds A
- [ ] With account A Private, prefix search does **not** return A but B sending A's exact handle succeeds
- [ ] Schema default for `profile_visibility` is still `'private'`; no existing row was rewritten
- [ ] Mobile has a Friends tab with Friends / Incoming / Outgoing, add-by-username, prefix search,
      Accept / Decline / Block, and a notifications entry point
- [ ] Every mobile friends action is awaited, shows a result toast, and shows an error + Retry on failure
- [ ] `DELETE /api/v1/friends/:id/block` removes the row; only the blocker may call it; either side can
      then send a new request
- [ ] `friend_mode=watched` returns titles the friend watched **including** ones I have watched
- [ ] `friend_mode=watched_not_me` returns none of my watched / watch-later titles
- [ ] `friend_mode=reviewed` returns only titles the friend reviewed, and `403`s when reviews are private
- [ ] An unknown `friend_mode` returns `400`; `friend_id` without acceptance returns `403`
- [ ] After A→B is accepted, B requesting A returns `409` and creates no second row
- [ ] `friendships_pair_uniq` exists and rejects a reverse-direction duplicate insert
- [ ] `POST /api/v1/notifications/read` works; the legacy path still works and is marked deprecated
- [ ] Opening the bell panel does not clear unread; viewing Incoming clears friend-request unreads
- [ ] The friend-request toast offers Accept, and accepting from it creates the accepted friendship
- [ ] Compare and Their Deck still work end-to-end on both clients (no regression of audit §5)
