# Session Handoff

Last updated: **2026-08-13**
Read after [`CONTEXT.md`](CONTEXT.md). Then work [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) top-down.

---

## ▶ Next session — paste this to start

```
Read docs/CONTEXT.md, docs/HANDOFF.md, and docs/IMPLEMENTATION-PLAN.md.

Stages 0-1, all of Stage 2 (2.1-2.7), all of Stage 3 (3.1-3.8), and all
of Stage 4 (4.1-4.13) are done. Stage 2 is the entire deck-engine v2
rewrite — it ships behind `DECK_ENGINE=v2`, which is NOT set in Vercel,
so production is still v1, unaffected. Stage 3 is the UX feedback layer
on both clients. Stage 4 closed every friends-system and parity gap the
audit found: backend (friend-deck mode semantics, unblock, duplicate-
request guard, canonical notifications endpoint + read-timing + toast
actions), mobile (a full Friends tab, privacy settings, filters+presets,
Watch Later, About, SecureStore, multi-level undo), and web (the
5-item+More mobile nav, a `/reviews` list screen).

Web's Stage 3.8 and most of Stage 4 (4.1's web half, 4.6-4.9, 4.12, 4.13)
were verified live (headless Playwright / direct API calls against
production DB) — trust those. **Everything mobile-touching this session
was NOT** — no Android device was connected all session, so it's
typecheck-clean and code-reviewed by hand only, left at `[~]` in the plan
(Stage 3.1-3.7 and Stage 4's 4.1 mobile half, 4.2, 4.3, 4.4, 4.5, 4.10,
4.11, and 4.13's mobile half). Treat all of it as a real risk area, not
"done," until it's actually run on a device — Maestro flow stubs exist
for most of it (`mobile-qa/flows/`, see the README status table) but are
themselves unrun; a first run of any of them is validating the flow's
own syntax as much as the app.

Two things are explicitly waiting on the user, not on you:
1. **Stage 2.8** (flip `DECK_ENGINE=v2` in Vercel) — user-visible
   production change, needs a direct go-ahead first. Don't flip it
   unprompted even if everything else looks green.
2. **Device verification for everything mobile** — if an Android device
   is connected (check: adb devices), run through `mobile-qa/flows/` and
   do a manual pass over anything without a dedicated flow (3.1/3.7
   theme+states, 4.1's mobile privacy toggle, 4.13's mobile read-timing).
   Promote `[~]` to `[x]` only for what you actually ran, one item at a
   time — don't batch-promote the whole list because most of it passed.

**Stage 4 is done — move to Stage 5** (pipeline & observability, spec
50): analytics events, CI expansion, nightly Maestro, TMDB caching,
staging Supabase, test-data cleanup, docs refresh, dead-code removal,
migration filename convention. See IMPLEMENTATION-PLAN.md for the full
5.1-5.9 list and pick up top-down; none of it has prerequisites beyond
what's already shipped.

For each item: implement → pnpm typecheck → write/extend its test →
verify against the acceptance criterion (or, for mobile-only items with
no device available, verify via typecheck + code review and record the
pending test explicitly) → commit → update the checkbox in
IMPLEMENTATION-PLAN.md → append to the Session Log in HANDOFF.md.

There is no staging Supabase yet (Stage 5.5) — migrations and verification
queries run directly against production. Use the Supabase MCP for
migrations/queries; keep them additive and reversible where possible.

Stop and ask me only if an item needs a product decision that isn't
already settled in docs/spec/. Otherwise keep going.

When you finish a stage, update this prompt block and tell me what
changed.
```

**Current position: Stage 1, all of Stage 2 (2.1-2.7), all of Stage 3 (3.1-3.8), and all of Stage 4 (4.1-4.13) shipped (`2026-08-13`). Deck v2 is behind `DECK_ENGINE=v2` (unset in prod); Stage 2.8 needs the user's go-ahead before flipping the flag. Stage 3.8 and Stage 4's web-verifiable items (4.6-4.9, 4.12, 4.13, plus 4.1's web half) are `[x]`, verified live; everything mobile-touching is `[~]` (typecheck-only, no device this session) — Stage 3.1-3.7 plus Stage 4's 4.1 mobile half, 4.2, 4.3, 4.4, 4.5, 4.10, 4.11, and 4.13's mobile half. Next up: Stage 5 (pipeline & observability).**

### Pending verification

Code-complete but unverified — all need the Android device. Run `maestro test mobile-qa/flows/` (see `mobile-qa/README.md` for the per-flow status table — two flows below are marked "written, never run" and need their very first pass treated with extra suspicion, since an untested Maestro flow can fail on its own syntax as easily as on a real app regression).

| Item | Flow |
|---|---|
| 0.1 auth-guard blank screen | `mobile-qa/flows/auth-guard-offline.yaml` — run and passing |
| 0.2 tabs never refresh | `mobile-qa/flows/tab-refresh.yaml` — run and passing |
| 0.5 undo desync after review-later | `mobile-qa/flows/undo-after-review-later.yaml` — run and passing pre-3.6; swipe direction updated for 3.6's gesture-map unification, **not re-run since** |
| 0.7 mobile error handling | covered incidentally by the above; no dedicated flow yet |
| 3.2/3.5/3.6 deck gesture map + fallback buttons | `mobile-qa/flows/deck-gesture-map-and-buttons.yaml` — **written, never run** |
| 3.3/3.4 toast + review-modal keyboard handling | `mobile-qa/flows/toast-and-keyboard.yaml` — **written, never run** |
| 3.1 theme tokens, 3.7 per-screen states | no dedicated flow — mostly visual; do a manual pass and screenshot each of the 7 screens' loading/empty/error states, log results in the Session Log below |
| 4.1 mobile privacy toggle + Copy handle | covered incidentally by `friends-ui.yaml`'s Copy handle assertion; no dedicated toggle check yet |
| 4.2 mobile friends UI (tab, add modal, notifications) | `mobile-qa/flows/friends-ui.yaml` — **written, never run**, single-device scope only (no request/accept/block/unblock/Compare/Their Deck coverage — needs a second identity) |
| 4.3 mobile filters + presets | `mobile-qa/flows/filters-and-presets.yaml` — **written, never run** |
| 4.4 mobile Watch Later screen | no dedicated flow — do a manual pass: swipe up on the deck, open Watch Later from Collection's header button, confirm the title lists and "Mark watched" works |
| 4.5 mobile undo depth (1→20) | `undo-after-review-later.yaml` exercises a single undo; multi-level (2-3 undos in a row) has no dedicated check yet |
| 4.10 mobile `/about` | no dedicated flow — do a manual pass: open from Profile, confirm the TMDB link opens |
| 4.11 mobile SecureStore | not Maestro-testable directly (no user-visible surface) — verify by confirming login still works and the session survives an app restart; watch logcat for any SecureStore size-limit error on first launch |
| 4.13 mobile notifications read-timing | no dedicated flow — do a manual pass: confirm opening the bell/notifications modal doesn't clear the badge, viewing Incoming does, and Accept/Decline/Block/Cancel each clear their own notification |

---

## Protocol — how to keep these docs true

This is the mechanism that lets a session run without the user in the loop. Follow it exactly.

**When an item is completed:**
1. Tick its checkbox in `IMPLEMENTATION-PLAN.md`.
2. Append one line to the Session Log below: date · item id · what changed · commit sha.
3. If it invalidated anything in `CONTEXT.md` (state, metrics, known-broken list), edit `CONTEXT.md` in the same commit.
4. If it changes what should happen next, rewrite the **▶ Next session** block above.

**When a stage is completed:**
1. Do all of the above.
2. Add a `### Stage N complete` entry to the Session Log summarising what shipped and what's now verifiable.
3. Notify the user with: what shipped · what's measurably better · the next session's prompt.

**Rules:**
- A checkbox is ticked only when the acceptance criterion is *verified*, not when the code compiles.
- Never mark an item done because it "should work" — the audit exists because that happened.
- If you discover a new bug, add it to `IMPLEMENTATION-PLAN.md` in the right stage rather than fixing it silently out of order.
- If a spec turns out to be wrong, fix the spec in the same commit as the code, and note it in the log.

---

## Session Log

Newest first. One line per completed item; a block per stage.

### 2026-08-13 — Stage 4.12/4.13 (reviews list, notifications alignment) — `73ab369`, `5ad4e02`

**Stage 4 is complete.** These were the last two items — both web-only, both verified live.

4.12, spec 32 §4: `GET /api/v1/reviews` had no caller and `PATCH`/`DELETE /api/v1/reviews/:id` were unreachable from the UI — reviews were write-only. Fixed `GET`/`POST /api/v1/reviews` and `PATCH /api/v1/reviews/[id]` to return properly camelCased `Review` objects with `media` converted via `toMediaSummary(asDbMedia(...))` — the `Review` type already declared this shape but nothing had enforced it, since nothing had ever actually consumed these responses before. Added `GET /api/v1/reviews/[id]` and three new client methods (`getReviews`, `getReview`, `deleteReview`). New `apps/web/src/app/reviews/page.tsx`: Written tab (poster/title/updated date/spoiler badge with blur-until-revealed body, Edit, Delete-with-inline-confirm-and-optimistic-removal) and Pending tab (existing `getPendingReviews()`). Nav's Reviews link now points at `/reviews`; `/review-later` stays valid, unchanged, still linked from the deck's toast and now also the Pending tab. Extracted a shared `ReviewEditor` component (create mode for `review-later/[id]`, edit mode for the new `reviews/[id]`) per spec's explicit "reuses one ReviewEditor component" — also added a visibility selector to both modes, needed for edit to be meaningful.

4.13, spec 40 §7 — four drifts from spec 12 §6:
| Drift | Fix |
|---|---|
| Endpoint path | New canonical `POST /api/v1/notifications/read` (shared `markNotificationsRead()` helper); old `POST /api/v1/notifications` now delegates to it, kept as a deprecated alias |
| Read timing | Removed mark-all-on-open from the bell dropdown, More sheet, and mobile notifications modal; added an explicit "Mark all read" button to each; viewing Incoming (web `/friends` tab, mobile Friends tab) now clears unread `friend_request`s; Accept/Decline/Block/Cancel also clear the specific related notification |
| Toast actions | Friend-request toast now offers `[View] [Accept]`, not just a link — Accept calls `acceptFriend()` directly from the toast, marks that notification read, refreshes the badge, no navigation required. Extended `ActionToast` with an `onAccept`/`acceptLabel` slot |
| Badge parity | Already closed by 4.2 (mobile) and 4.6 (web) earlier this session — nothing new needed |

Refactored web's notification feed from a bare hook into a `NotificationsFeedProvider`/`useNotificationsFeed()` context (mounted once in `AppShell.tsx`) — `friends/page.tsx` now needs the same unread state `Nav.tsx` does, and calling the polling hook twice would have double-polled/double-toasted, same reasoning as mobile's existing `NotificationsProvider`.

**Verified 4.12 live**: queued a title via the deck's ↓ gesture, confirmed it in Pending with a working Write link, wrote a spoiler review, confirmed Written shows it with the spoiler badge and blur-until-revealed body, edited it (prefilled body/spoiler/visibility all correct, updated body persists), deleted it and confirmed the row is gone. **Verified 4.13 live** with two real accounts: canonical path 400s on a bad body, deprecated path still works with explicit ids; opening the bell leaves the unread badge unchanged; the toast's Accept button creates the accepted friendship and clears the notification, confirmed via direct API checks against production DB. Zero console errors in either verification.

**Not verified:** mobile's equivalent 4.13 changes (removed auto-mark, added mark-on-Incoming-view and mark-on-action, explicit Mark-all-read button) are typecheck-only — no Android device connected this session.

### 2026-08-13 — Stage 4.3 (mobile filters + presets) — `86dab83`

Spec [`06`](spec/06-filter-system.md). Last mobile-only item in Stage 4 — mobile had no way to filter the deck or save/apply presets at all.

New `lib/filters.tsx` (`FiltersProvider`/`useFilters()`) holds a `DeckFilters` state shared between the Deck tab and a new `app/filters.tsx` modal — expo-router has no "return a result" navigation primitive, so this plays the role web's local `useState` in `DeckView.tsx` does, just lifted to context so a separate route can read/write it. The modal mirrors web's `FilterDrawer.tsx` almost 1:1 (same `FILTER_TYPE_OPTIONS`/`GENRE_MAP`/`RELEASE_ERAS` constants from `@mubitracker/shared`, same preset client methods). `(tabs)/deck.tsx`'s `loadDeck()` now merges `deckFiltersToSearchParams(filters)` into every request and accepts an optional `{cursor, sessionId}` override — mirrors web's `fetchBatch(overrides)` pattern exactly, needed because calling `loadDeck()` right after resetting cursor/sessionId state would otherwise read the stale pre-reset values from its closure (state updates haven't committed yet in the same tick). The existing near-end-of-queue prefetch effect is untouched and still can't double-fire against the reset effect (same `fetching.current` ref guard). New Filters header button on Deck (sliders icon + active-count badge).

New Maestro flow `mobile-qa/flows/filters-and-presets.yaml` — written, never run. Typecheck-only — no Android device connected this session.

**Stage 4 is now down to 4.12 and 4.13** — everything else (4.1-4.11) has shipped this session.

### 2026-08-13 — Stage 4.4/4.10/4.11 (mobile Watch Later, About, SecureStore) — `4159970`, `8b1e5ab`

4.4: gesture/action for Watch Later already existed since Stage 3.6; only the screen was missing (Collection lists watch_later items mixed in undifferentiated, unlike web's dedicated page). Added `app/watch-later.tsx` (poster/title/year rows, "Mark watched" per row) as a **pushed screen, not an 8th bottom tab** — a deliberate deviation from the plan item's literal "screen, or tab" wording, reasoned in the commit: mobile already grew from 5 to 6 tabs this session (4.2's Friends tab), and an 8th would risk the exact cramped-bar problem 4.6 just fixed on web. Reachable via a clock-icon header button on the Collection tab instead.

4.10: new `app/about.tsx` — TMDB attribution text + outbound link, matching web's content. Text-only, no logo graphic (`react-native-svg` isn't installed and wasn't worth adding for one static image). Linked from a new "About / TMDB Credits" button on Profile.

4.11: `lib/supabase.ts` now stores the Supabase session via Expo SecureStore instead of AsyncStorage (spec 08) — the dependency was already installed and unused. Left an in-code comment flagging SecureStore's ~2048-byte Android per-item limit as a genuinely unverified risk (this app is password-only auth, so the session shouldn't approach that size, but "shouldn't" isn't "verified") and named the documented mitigation (LargeSecureStore: AES-encrypt + AsyncStorage blob, SecureStore holds just the key) without implementing it, since adding `expo-crypto`/`aes-js` for a failure mode never observed against this app's actual session shape isn't justified yet. `offline-queue.ts`'s AsyncStorage usage (spec 08's separate action queue) is untouched.

**All three typecheck-only — no Android device connected this session.**

### 2026-08-13 — Stage 4.5/4.6 (mobile undo depth, web mobile nav) — `a2be8bb`, `de71f80`

4.5, spec 40: mobile's deck (`(tabs)/deck.tsx`) tracked only a single `lastAction`, so only the most recent classify could be undone. Converted to a stack capped at the same `MAX_UNDO_STACK` (20) constant web already uses — push on classify, pop on each Undo tap. Typecheck-only, no device this session.

4.6, spec 32 §6: web's mobile bottom bar rendered `links.slice(0,5)`, which happened to include Reviews but left Profile and the notification bell completely unreachable under the `md` breakpoint. Rebuilt per spec: 4 static items (Deck/Search/Collection/Reviews) + a More button opening a bottom sheet (Watch Later/Friends/Profile/About as links, Notifications as an in-sheet expandable list), with the same unread badge, active-state styling on sheet-owned routes, and close-on-select/backdrop/Esc. Extracted notification polling into `useNotificationsFeed()` (single instance, shared by desktop bell + mobile sheet via props) since both surfaces exist in the DOM simultaneously — two independent pollers would have double-toasted the same friend request. As a side effect, mobile now gets the friend-request toast at all, which previously only fired on desktop.

**Verified 4.6 live** in a real headless browser: 390×844 confirmed the bar's exact link set, all 5 sheet destinations, Esc/backdrop/selection-close behavior, active styling on a sheet route, and the notifications toggle; 1280×900 on the same authenticated session confirmed zero desktop regression (bell renders, dropdown works, Friends stays a direct rail link, mobile bar/sheet don't render). Zero console errors in either mode.

### 2026-08-13 — Stage 4.2 (mobile friends UI) — `a5394b9`

Spec [`40`](spec/40-friends-v2.md) §3. Largest remaining Stage 4 item — mobile had zero social surface.

| Item | Change |
|---|---|
| New Friends tab | `(tabs)/friends.tsx`: segmented Friends/Incoming/Outgoing/Blocked, Copy handle, the first-run discoverability nudge (deferred from 4.1 since there was no screen to put it on yet), inline row actions (Accept/Decline/Block/Cancel/Unblock), all awaited with try/catch + toast on both outcomes. |
| Add friend | `friends/add.tsx` modal: exact-handle send + 250ms-debounced prefix search with per-row Add. |
| Friend detail | `friends/[id].tsx`: counts, Compare, Their Deck, Block/Unblock (gated on a `friendship_id` passed through the list navigation — block/unblock act on the friendship row, not the user id, which the list already had and the detail route otherwise wouldn't). |
| Notifications | New `lib/notifications.tsx` (`NotificationsProvider`/`useNotifications`, 30s poll, one toast per newly-seen unread `friend_request` — mirrors web's `NotificationBell`), feeding a badge on both the tab icon and a header bell button. `friends/notifications.tsx` modal marks all read on open and deep-links a tapped `friend_request` back to Friends with Incoming pre-selected. |
| Their Deck actually works | `(tabs)/deck.tsx` now reads `friend_id`/`friend_mode` from route params (`useLocalSearchParams`) and forwards them on every `getDeck()` call — previously there was no mobile route capable of viewing a friend's deck at all, even though the backend (4.7) already supported it. No other deck logic touched. |

**Verified:** typecheck-only. `pnpm typecheck` clean across the full monorepo (shared/web/mobile). No Android device connected this session. New Maestro flow `mobile-qa/flows/friends-ui.yaml` covers the single-device-reachable surface (tab nav, nudge, all four tabs' empty states, add-friend modal, notifications modal) — written, never run. It explicitly cannot cover request/accept/block/unblock/Compare/Their Deck, which need a second identity (second device, or simulating one via direct backend API calls per the autonomous-mobile-qa skill) — noted in the flow's header rather than silently claimed as covered.

**One local-only gotcha worth remembering, not a real bug:** running `npx expo export` locally to try to force-regenerate `.expo/types/router.d.ts` (for stricter `router.push()` typing) produces a stale/partial file that then makes `tsc` fail on any route not in it — including routes that existed before this session. `.expo/types` is gitignored and never present in a fresh CI checkout, so CI's `pnpm typecheck` always sees expo-router's permissive fallback (any string route accepted). Deleting a locally-generated `.expo/types` directory restores parity with CI. Don't chase "route not assignable" errors that only reproduce after manually running `expo export` — check `.expo/types` exists locally before trusting them.

### 2026-08-13 — Stage 4.1 (privacy settings UI) — `5502a19`

Spec [`40`](spec/40-friends-v2.md) §2, [`32`](spec/32-web-ux.md) §8.

| Item | Change |
|---|---|
| Web `/profile` | New Privacy card: `profile_visibility` (Public/Private select), `collection_visibility` and `reviews_visibility` (Public/Friends/Private selects), all optimistic with revert + toast on failure. Copy handle button next to `@username`. |
| Web `/friends` | One-time nudge banner ("Let people find you by username?" / Make me discoverable / Not now), shown only when `profileVisibility === 'private'` and not previously dismissed (persisted per-user in `localStorage`). Also gained its own Copy handle button (spec 40 §2's "always-available path"). |
| Mobile Profile | Same Public/Private segmented toggle and Copy handle button, using a new `expo-clipboard` dependency (added via `pnpm --filter mobile add`). Mobile's first-run nudge is deferred to 4.2 — there's no mobile Friends screen yet to put it on. |

**Verified live** in a real headless browser (fresh signup, `context.grantPermissions(['clipboard-read','clipboard-write'])` so the clipboard assertions are real, not stubbed): profile/collection visibility changes persist across reload (confirmed via explicit `waitForResponse` on the PATCH, not a timeout guess — an earlier fixed-delay version of this test was flaky for exactly the reason you'd expect); the nudge shows only while private and stays dismissed after "Not now" + reload; Copy handle round-trips through the real clipboard on both pages; zero console/page errors. Found and fixed one real gap while verifying: both `copyHandle` handlers had no error handling, so a clipboard permission failure (the actual first behavior seen in headless Chromium before granting permissions) would fail completely silently — wrapped both in try/catch with user-facing feedback (toast on `/profile`, inline error on `/friends`).

**Not verified:** mobile's identical toggle/copy UI is typecheck-clean only — no Android device connected this session.

### 2026-08-13 — Stage 4.7-4.9 (friend-deck modes, unblock, duplicate-request guard) — `5b77a2c`

Spec [`40`](spec/40-friends-v2.md). First slice of Stage 4 — the three backend items that don't depend on any new mobile UI.

| Item | Change |
|---|---|
| 4.7 `friendMode` semantics | `generate.ts`'s `generateFriendDeck` no longer routes friend requests through the TMDB-discover loop at all — that loop intersected randomly-paged TMDB results with the friend's watched-id set, so a friend's title only surfaced if it happened to land on a randomly chosen page, making "Their Deck" thin or empty in practice even for a friend with a full watch history. Rewritten to query the friend's own `user_media` (mode `watched`/`watched_not_me`) or `reviews` (mode `reviewed`) directly, ordered stably (`watched_at`/`created_at` desc, `media_id` desc as tiebreak) and paginated by offset — no TMDB call in the friend-deck path at all now. New `assertFriendAccess` throws a typed `FriendAccessError` (400 unknown mode, 403 no accepted friendship, 403 `reviewed` mode against a friend whose `reviews_visibility` is private), caught in `deck/route.ts` before the generic 500 fallback. `excludeMyHistory` filters out anything the viewer has already watched/queued, applied to `watched_not_me`/`reviewed` but not `watched`. |
| 4.8 Unblock route | Block was previously irreversible — no DELETE existed. Added a `blocked_by uuid references profiles(id)` column (migration `20260813000010`), set on block; new `DELETE /api/v1/friends/[id]/block` 404s if the row isn't `status='blocked'`, 403s if the caller isn't `blocked_by`, otherwise deletes the row. `unblockFriend()` added to the shared API client; `friends/page.tsx` gained a Blocked tab showing an Unblock button (only when the viewer placed the block) or "Blocked you" otherwise. |
| 4.9 Reverse-accepted duplicate guard | POST `/api/v1/friends` previously ran separate ad-hoc checks (blocked? reverse-pending?) that didn't cover the already-`accepted` case, so B could re-send a request to A after A had already accepted B's original one, creating a second row for the same pair. Rewritten to load any existing row for the pair first and branch on its status: `accepted`→409 `ALREADY_FRIENDS`, pending same-direction→409 `REQUEST_PENDING`, pending reverse-direction→auto-accept (unchanged prior behavior), `blocked`→403. Backed by migration `20260813000009`: a dedup pass (0 duplicates found live) plus `CREATE UNIQUE INDEX ... ON friendships (LEAST(requester_id,receiver_id), GREATEST(requester_id,receiver_id))`, so the invariant holds at the DB layer too, not just in application logic. |

**Verified live** against production DB with throwaway `wqa*` accounts (scripts written ad-hoc, deleted after use — same pattern as Stage 3.8's Playwright scripts): a 3-account scenario (A/B/C) covering — C (not A's friend) gets 403 on A's deck; A→B request, B accepts; B→A request post-acceptance gets 409 `ALREADY_FRIENDS`; unknown `friend_mode` gets 400; `watched_not_me` correctly excludes a title B also watched; `watched` mode includes it; unset `friend_mode` matches `watched_not_me`'s count; `reviewed` returns only the reviewed title; a 2-item page + cursor produces a non-overlapping second page. A separate 2-account scenario for block/unblock: non-blocker unblock attempt → 403; blocked party re-requesting → 403; blocker unblocks → 200 + row deleted; second unblock attempt → 404; either side can send a fresh request after unblock → 201. All assertions passed on both runs. `pnpm typecheck` clean.

### 2026-08-13 — Stage 3.8 (web polish)

Spec [`32`](spec/32-web-ux.md), scoped to the items named in `IMPLEMENTATION-PLAN.md`'s 3.8 line — not the full spec (see the gap note in the ▶ Next session block about §4/§6, which aren't tracked anywhere yet).

| Item | Change |
|---|---|
| Deck skeleton + retry | New `DeckCardSkeleton` (exported from `DeckCard.tsx`) — same dimensions as the real card so nothing shifts when content arrives — renders during the initial/filter-change load instead of a tiny "Loading deck..." dot. Added a distinct `loadError` state (separate from the legitimate "Deck is empty" state) with a **Couldn't load the deck** message, **Retry** (re-runs `fetchBatch`), and **Edit filters**; only the initial/filter-change fetch (identified by `fetchBatch` being called with `overrides`) sets it — a background prefetch failure still just toasts, per spec §7's "prefetch: silent, retried on next advance." |
| **Real bug found and fixed while touching this code, not in the original 3.8 scope list:** `review_later` exit direction | `DeckView.tsx`'s `performAction` mapped both `watch_later` and `review_later` to exit direction `'up'` — spec 32 §2.1's own explicitly-flagged defect and acceptance criterion #1. Added `deck-exit-down`/`.animate-deck-exit-down` to `globals.css`, extended `exitDirection`'s type to include `'down'` in both `DeckView.tsx` and `DeckCard.tsx`, and mapped `review_later → 'down'`. Verified live: pressing ↓ now shows the purple bookmark cue and animates the card downward, matching ↑/Watch Later's upward animation. |
| Review editor shows the title | `review-later/[id]/page.tsx` now fetches the media record via `client.getMedia()` on mount (skipped if the route id already failed uuid validation) and renders poster + title + year + type above the textarea, with a skeleton while fetching and "Title unavailable" on failure — mirrors mobile's `review/[id].tsx` pattern from Stage 3.4. |
| `text-neutral-00` / `text-neutral-????00` | Both were literal invalid Tailwind classes in `profile/page.tsx` (Watched stat label, About link) that silently rendered as unstyled/default text color. Fixed to `text-neutral-500` / `text-neutral-300` respectively, matching sibling elements. |
| Self-host TMDB logo | `about/page.tsx` loaded TMDB's logo from `themoviedb.org` directly, which the audit found `ERR_BLOCKED_BY_ORB` in a real browser. The specific asset URL the audit recorded was also just stale — TMDB fingerprints its asset filenames per deploy and the hash had rotated. Fetched the *current* URL from TMDB's live homepage HTML and saved it to `apps/web/public/tmdb.svg` (2065 bytes, verified valid SVG matching TMDB's official "short" logo mark); `about/page.tsx` now points at the local path. Verified in a real browser: `naturalWidth` 300 (loaded successfully), zero console/network errors. |
| Review-later empty state names the wrong key | `review-later/page.tsx` said "press ↑ or choose Review Later" — spec 32 §9.4 / the canonical gesture map (§2.1) say ↓. Fixed the string; also added a 3-row skeleton for the loading state and a Retry button for the error state (both already implied by spec §7's loading/error table for this screen, previously missing entirely — it just showed unstyled "Loading..."/error text with no recovery path). |
| Import error messages | `profile/page.tsx`'s `importData()` had one `catch` covering both `JSON.parse` failure and the server request failure, both reported as `alert('Invalid JSON')` — a well-formed-but-server-rejected payload got the same wrong message as genuinely malformed text. Split into two `try/catch` blocks: parse failure → *That's not valid JSON*, request failure → the actual server message. Replaced both `alert()` calls (success and both failure paths) with the existing `ActionToast` component, reused here for the first time outside `DeckView.tsx` since it's already a fully reusable, non-deck-specific presentational component. Also added a `.catch()` to `exportData()`, which had none. |
| Lowercase status chips | Spec 32 §9.6 claimed `collection/page.tsx`'s status filter chips render lowercase (`watched`/`unwatched`) beside `All`. Checked the current code: they're already capitalized via `s.charAt(0).toUpperCase() + s.slice(1)` — this one was already fixed at some earlier point (likely Stage 0.3's pagination work touched the same area) and the spec's fix-list entry is stale. No change needed; confirmed by reading, not assumed. |

**Verified in a real headless Playwright browser** (fresh signup against the local dev server, same technique as Stage 2.7): deck skeleton visible on initial nav; pressing ↓ produces exactly one `.animate-deck-exit-down` element and the correct `Queued for review · {title}` toast; `/about`'s TMDB `<img>` loads with `naturalWidth` 300 and zero console errors; `/profile`'s Watched-stat and About-link classes read `text-neutral-500`/`text-neutral-300`; pasting malformed JSON shows *That's not valid JSON* while a syntactically-valid-but-schema-rejected payload shows the actual Zod error array from the server (confirmed these are genuinely different messages, not the same string twice — my first test run showed them matching only because the test itself clicked Import before the prior toast had cleared, not because of an app bug); a fresh account's `/review-later` empty state reads "press ↓ or choose Review Later"; opening a queued title's review editor renders its real poster and title above the textarea.

### 2026-08-13 — Stage 3.1-3.7 (mobile UX feedback layer)

Spec [`31`](spec/31-mobile-design-system.md). Independent of the deck-engine-v2 work above — this is purely client-side polish on `apps/mobile`. All seven items shipped in one pass since they share the same theme/token foundation and touch overlapping files.

| Item | Change |
|---|---|
| 3.1 | New `apps/mobile/lib/theme.ts`: `color`/`space`/`radius`/`type`/`motion`/`elevation` tokens plus `hitSlopFor()`. Every screen and component under `apps/mobile/app` and `apps/mobile/components` now imports from it — confirmed zero hex literals remain via `grep -rE '#[0-9a-fA-F]{3,8}'` across both directories. Resolves the accent-colour drift noted in the audit (login was `#dc2626`, web `#ef4444` — both now derive from the same `color.primary` concept per-platform). |
| 3.2 | `deck.tsx` rewritten with Reanimated: four directional cue overlays (right/green/check, left/red/X, up/amber/clock, down/purple/bookmark) that fade in via `interpolate` between `motion.CUE_THRESHOLD_*` and `motion.SWIPE_THRESHOLD_*`; card opacity falls to 0.7 at 300px drag; a committed swipe runs an exit `withTiming` (position + fade) whose completion callback — not the gesture handler itself — is what advances `index` and kicks off the enter animation, so there's no mid-flight card swap. An unresolved drag springs back (`withSpring`). |
| 3.3 | New `apps/mobile/components/Toast.tsx`: `ToastProvider` + `useToast()`, single toast at a time (a new one replaces the current one), 2500ms auto-dismiss, `accessibilityLiveRegion="polite"`, optional Undo action slot. Mounted in `_layout.tsx` inside the new `SafeAreaProvider`. |
| 3.4 | `_layout.tsx` gained `SafeAreaProvider`; `review/[id].tsx` (a `presentation: 'modal'` route that was rendering under the status bar) now wraps in `SafeAreaView edges={['top','bottom']}` + `KeyboardAvoidingView`; `login.tsx` gained the same `KeyboardAvoidingView` + `ScrollView` wrapping so the submit button stays reachable with the keyboard open. |
| 3.5 | Every `Pressable` under `apps/mobile/app` now has `accessibilityRole` and a non-empty, object-specific `accessibilityLabel` (e.g. `"Mark The Godfather as watched"`, not `"Watched"`) — confirmed by grepping for `Pressable` vs `accessibilityLabel` counts per file. `imdbHit` (deck.tsx) and `actionHit` (search.tsx) were both `minHeight: 44`, under the 48dp requirement — fixed to 48. The deck gained a full 4-button + Confirm fallback row so no classification is gesture-only. |
| 3.6 | Deck gesture map unified with web: ↑ now writes Watch Later (was Review Later, and Watch Later was unreachable by any gesture), ↓ now writes Review Later (was absent entirely). `handleUndo` and the sticky-action logic were updated to match — sticky `←`/`→` selection persists across ↑/↓ actions exactly like `DeckView.tsx`'s `advance()`, including the case where the on-screen buttons (not a gesture) set the selection. |
| 3.7 | Collection, Review Later, Search, Profile, Login, Review, and Deck each render distinct loading/empty/error states (`ScreenState` component or inline equivalents); every `apiClient` call site in `apps/mobile/app` has a `.catch()` — either directly (deck, profile export, search, review save) or centrally via `useFocusFetch` (collection, review-later, profile fetch), which was itself added in Stage 0 specifically to guarantee this. Search's classify action (`mark()`) now also emits an error toast on failure, in addition to its existing inline saved/failed/retry row state — closes the "await, update the row, and emit a toast" acceptance line, which previously only had the first two. Profile's stats card now shows all four counts spec 31 requires (watched / haven't / watch later / reviews) instead of three (watched / reviews / friends) — required adding `unwatchedCount`/`watchLaterCount` to `GET /api/v1/profile` (additive fields, `Profile` type in `@mubitracker/shared`), consumed by both clients without touching web's own profile page (still 3 stats there — that's Stage 3.8's concern, not touched this pass). |

**One real bug found by code review, not by running it:** the pan gesture's `onUpdate`/`onEnd` worklets had no guard against a new drag starting while the previous card's exit animation was still in flight — starting a drag mid-exit would directly overwrite `tx.value`/`ty.value` out from under the in-flight `withTiming`, visually corrupting the animation. `busy.current` (the existing plain-JS-ref guard used elsewhere) can't be read from a worklet running on the UI thread, so a new `busyShared` shared value mirrors it: set `true` in `commitExit`, set `false` in `advanceAfterExit`, checked at the top of both `onUpdate` and `onEnd`.

**Not verified on-device.** No Android device or emulator was connected this session — everything above is `pnpm typecheck` clean and was checked by careful reading (grep for hex literals, `accessibilityLabel` counts, 48dp targets, gesture/sticky-action logic traced by hand) rather than by actually swiping, tapping, or seeing the toast render. This is a meaningfully weaker verification bar than Stage 2.7's web work (a real headless Playwright browser actually drove that). All seven items are left at `[~]` in `IMPLEMENTATION-PLAN.md`, not `[x]` — see *Pending verification* above. Do not promote them without an actual device pass.

### 2026-08-13 — Stage 2.7 (wire both clients to buckets)

Spec [`20`](spec/20-deck-engine-v2.md) §4/§5. Last item of the deck-engine-v2 rewrite proper (2.8 is just the rollout).

| Item | Change |
|---|---|
| 2.7 | `DeckResponse` (shared) gained optional `bucketId`/`position`/`partial`/`reason`, and `cursor`/`sessionId` became optional — one type now covers both server shapes. `DeckView.tsx` and mobile `deck.tsx` each got an `engineMode` ref set from the *first* response (`bucketId` present ⇒ `'v2'`) and a `deckExhausted` flag replacing "falsy cursor" as the stop-fetching signal, since bucket mode has no cursor and always has a next request by construction. The prefetch effect branches: v2 requests the next bucket (omitting `bucket=`, per spec 23 §8) once within 15 of the queue's end; v1's existing cursor logic is untouched. `partial`/`reason` surface as the same toast mechanism v1's `message` already used, so no new UI component was needed. |

**Verified in a real headless browser** (Playwright, not just curl) against both modes on the local dev server: **v1** (`pnpm dev`, no flag) — deck renders, keyboard classify advances the counter, undo shows its toast, screenshot confirms correct rendering; zero regressions since v1's code path is behavior-identical to before (`engineMode.current !== 'v2'` evaluates the same as the old unconditional logic). **v2** (`DECK_ENGINE=v2 pnpm dev`) — first bucket (50 items) loads, advancing to item 39 correctly triggered a *second* distinct `bucketId` fetch and appended its items with no visible hiccup; changing a filter (Movies chip) correctly produced a third, different `bucketId` for the new `filterHash` after a ~2-4s cold build; no browser console/page errors in any run.

**Not verified:** mobile's identical logic is typecheck-only — no Android device was connected this session (`adb devices` was empty at session start and never reconnected). The web verification exercises the same shared-package types and the same server responses mobile consumes, so risk is low, but "typechecks" and "verified working on device" are different claims — don't promote this to done-done until it's actually been run on a phone.

### 2026-08-13 — Stage 2.4-2.6 (corpus ingestion, bucket service, background pre-build)

Specs [`21`](spec/21-corpus-ingestion.md) · [`23`](spec/23-bucket-service.md). Shipped behind `DECK_ENGINE=v2`, unset in Vercel — **production is unaffected**, still serving v1 (`generate.ts`). This is the biggest chunk of the plan; details below because the next session needs them to finish 2.7 correctly.

| Item | Change |
|---|---|
| 2.4 | `scripts/ingest-corpus.mjs`: format × sort × decade × page discover axes (2×3×6×3=108 calls) plus targeted anime/animation/documentary passes (~30 calls), same content filter as the app, `media_rejected` table so rejected TMDB ids aren't re-evaluated on a later pass. Two runs (pages 1-3, then a deeper 4-8/6-15 pass) took the corpus from 641 to 4,247 non-adult titles — series coverage 1798/1800 (99.9%), movie 2446/2447 (99.96%), 0 duplicate `(provider, external_id)` pairs, 0 orphaned `media` rows, 0 `adult=true`. |
| 2.5 | `deck_buckets` + `deck_build_locks` tables, `get_eligible_media(...)` SQL function (the eligibility anti-join from spec 24 §7 plus format/classification/genre/language/year filters), and new `apps/web/src/lib/deck/bucket-service.ts`: `buildBucket` (taste-weighted exploit quotas via 2.3's `getTaste`/`deriveQuotas`, 10-wildcard explore excluding the user's top-3 genres, a 4-step shortfall ladder ending in `partial:true` + a `no_matches_for_filters`/`corpus_exhausted` reason code — never a bare empty response), `getReadyBucket`/`getBucketById`/`markServing`, `computeFilterHash`. `GET /api/v1/deck` branches to the bucket path when `DECK_ENGINE=v2` and the filters don't need friend/status-filtered v1 semantics (`supportsBucketAlgorithm`). |
| 2.6 | `after()` (stable in Next 15.5.23) schedules the next bucket build once the response is flushed — verified working locally; not yet observed on a real Vercel deployment since the flag isn't on there. |

**Two real bugs found and fixed during verification, not by inspection — both would have shipped broken if untested:**
1. `deriveQuotas`'s cold-start branch returned the literal spec default `{movie:30, series:10, anime:10}` (sums to 50), but the bucket algorithm always adds 10 explore slots on top of whatever `deriveQuotas` returns — cold-start buckets came out **60 items**, not 50. Fixed by scaling the 30/10/10 *ratio* down to sum to the 40-slot exploit budget (24/8/8) instead of returning it verbatim.
2. `get_eligible_media` originally did `left join media_genres … group by … order by random() limit`, which forces Postgres to aggregate genre arrays for *every* eligible row (thousands) before the limit applies — **1.24s** per call measured via `EXPLAIN ANALYZE`. Restructured to filter/order-by-popularity/limit in a CTE first, then join `media_genres` only for the kept rows: **34.6ms**, a 36x improvement. Also swapped `order by random()` for `order by popularity desc` — the bucket service already oversamples 3x and shuffles in JS, so SQL-level true randomness wasn't buying anything but cost.

**Also found and fixed:** `pg_try_advisory_xact_lock` (the spec's literal suggestion for the build concurrency guard) doesn't fit this app — PostgREST issues each query as its own isolated request with no session affinity, and an advisory *transaction* lock releases the instant the request that acquired it returns, but `buildBucket()` spans many separate round-trips, not one DB transaction. Replaced with a `deck_build_locks` row (unique key, `on conflict do nothing`, 60s staleness reclaim) — same atomic single-winner guarantee, works correctly across independent REST calls.

**Verified live** (`DECK_ENGINE=v2 pnpm --filter @mubitracker/web dev`, fresh test accounts against production DB): cold build → 50 items, ≤50 always, 0 in-bucket duplicates; resume via `?bucket=<id>` returns the identical bucket; different filters produce different `bucketId`s; `format=movie` bucket is 100% movies; a deliberately narrow filter (`documentary`+`ko`+`1950-1960`) correctly returns `partial:true, reason:'no_matches_for_filters'` instead of an error or silent empty array; 3 concurrent requests for a fresh filter combo produced 2 distinct bucket builds, not 3 — the lock mostly holds (see caveat below). Cold-build latency measured **1.6s from this dev machine**, down from an unoptimized 6.9s; server-side query cost is confirmed ~35ms via `EXPLAIN ANALYZE`, so the residual gap is this environment's WAN round-trip to Supabase (~200ms/hop × ~7 sequential round-trips), not server-side cost — same caveat as Stage 2.3's taste-RPC timing. Real p95 against a same-region Vercel deployment (bom1 ↔ ap-south-1) is unverified; **re-measure once 2.7 lets this run from an actual deployment**, since "1.6s from a laptop in the wrong region" is not the same claim as "<800ms p95 in prod."

**Known gaps to close before 2.8 (flipping the flag in prod):**
- The build lock is best-effort, not airtight — 2/3 concurrent cold requests for a brand-new filter combo still produced 2 builds in testing (acceptable diagnostically, not literally "advisory lock holds" from spec 23's acceptance criterion). A genuinely pathological rapid-fire client could still cause a handful of redundant builds; they self-heal (only one ends up `ready`) but waste a query.
- Explore's 10-wildcard-excludes-top-3-genres behavior is verified by code inspection against spec 24 §8's truth table, not by an end-to-end check against a real ≥50-decision account (would need `rein`'s actual password, which this session doesn't have).
- Real production latency (Vercel↔Supabase same-region) is unmeasured — only local-dev-to-Supabase WAN timing exists so far.

### 2026-08-13 — Stage 2.3 (taste model)

Spec [`22`](spec/22-taste-model.md). Not yet wired into deck serving — `generate.ts` still discovers via live TMDB, unaware of taste. This item delivers the tested primitive (`getTaste`, `deriveQuotas`); Stage 2.5 (bucket service) is what will actually call it.

| Item | Change |
|---|---|
| 2.3 | Migration adds `user_taste` cache table and a `compute_user_taste(p_user_id)` SQL function (security definer, `service_role`-only) that does the weighted accepted/decided aggregation from spec 22 §6 — one query, joined for genre/format/classification, with 180-day half-life recency weighting (`power(0.5, age_days/180)`) baked into the `decided` CTE. New `apps/web/src/lib/deck/taste.ts`: `getTaste()` applies Laplace smoothing (α=5, prior=0.5) in application code, caches the result in `user_taste`, and recomputes when the cache is >24h old *or* ≥10 decisions stale — whichever comes first. `deriveQuotas()` turns a vector into `{movie, series, anime}` exploit-slot quotas (40 total, floor 2 each), falling back to the fixed 30/10/10 default below 50 total decisions. |

**Verified against `rein`'s real 283-decision history** (production DB): the SQL function's server-side execution time is **10.5ms** (`EXPLAIN ANALYZE`), well under the 50ms budget — a naive client-side timing read 416ms, which is WAN round-trip from this dev machine to Supabase, not the same-region Vercel↔Supabase path the budget is actually about. Computed genre affinities land within ±0.03 of the audit's measured table (Sci-Fi 0.87 vs 0.90, Adventure 0.82 vs 0.85, Fantasy 0.78 vs 0.81, Action 0.72 vs 0.73, Crime 0.34 vs 0.32) — all comfortably inside the ±0.05 tolerance; the small uniform undershoot is smoothing doing exactly what it's supposed to (pulling every value slightly toward the 0.5 prior). `smooth(1,1)` reproduces the spec's worked example (≈0.5833, not 1.0). Cache write/read round-trips through `user_taste` correctly. Derived quotas for `rein`: `{movie: 12, series: 3, anime: 25}` — series demoted well below the 10-slot default and above the floor of 2, summing to exactly 40.

**One thing worth remembering:** spec 22 §8's `raw[f] = affinity(format=f) × affinity(classification associated with f)` doesn't define what "associated" means for the three-bucket movie/series/anime split, and its own illustrative numbers for `rein` ("roughly 38/4/8") aren't reproducible from the literal formula — anime classification affinity (0.64) and pure movie-format affinity (0.65) are genuinely close in the real data, so a faithful implementation gives anime a much larger share than the illustration suggests. I used `raw.movie/series = affinity(format) × affinity(live_action)`, `raw.anime = affinity(anime)` alone (anime has no single associated format) as the most literal reading. The acceptance criterion only requires series demoted below 10 with the floor respected, which holds regardless of this ambiguity — but if the actual served deck ends up anime-heavy for anime-affine users once Stage 2.5 wires this in, that's this formula choice showing up, not a bug.

### 2026-08-13 — Stage 2.1/2.2 (cooldown + exclusion, undo carries cooldown state)

Spec [`24`](spec/24-exclusion-cooldown.md). The single most user-visible fix in the whole plan: swiping left previously did nothing.

| Item | Change |
|---|---|
| 2.1 | Migration adds `user_media.reject_count`/`hidden_until` and `deck_impressions` (replaces the never-implemented `deck_sessions.shown_media_ids`). New `apps/web/src/lib/deck/cooldown.ts`: `nextCooldownState` (14d → 60d → forever escalation, `watched`/`watch_later` hide forever without touching `reject_count`) and `isHiddenNow` (handles Postgres's `'infinity'` timestamptz sentinel, which `new Date()` can't parse). `generate.ts`'s unbounded in-memory exclusion `Set` — which silently truncated past PostgREST's 1,000-row cap, letting watched titles reappear for heavy accounts — is gone; exclusion is now a scoped lookup against only each discover page's ~20 candidate ids (`getUserMediaState`, `isEligible`), so there's no unbounded fetch anywhere in the path. `recordImpressions` writes `deck_impressions` for every served item and opportunistically prunes rows older than 30 days. A `console.warn` fires when eligible candidates fall under 2× the requested limit. |
| 2.2 | `undoSchema` carries `previous_reject_count`/`previous_hidden_until`; `upsertUserMedia` accepts a `cooldownOverride` so undo restores exact prior values instead of recomputing them through the escalation rules. `DeckItem` gained `userRejectCount`/`userHiddenUntil`, populated by `generate.ts`; both clients (`DeckView.tsx`, mobile `deck.tsx`) capture them off the current card at swipe time and echo them back through `client.undo()`. |

**Verified live** (fresh test account, real requests against the local dev server hitting production DB): reject #1/#2/#3 produced `reject_count` 1/2/3 and `hidden_until` +14d / +60d / `infinity`; three undos in sequence restored `reject_count` 2 → 1 → 0 and `hidden_until` back to `null`; a title marked `watched` never reappeared across 4 consecutive deck batches; a rejected title stayed absent across 5 consecutive batches. `pnpm typecheck` clean across all 3 packages.

**One thing worth remembering:** confirming that an explicit `status=unwatched` filter re-surfaces one *specific* previously-rejected title is architecturally probabilistic right now — candidates still come from live, randomly-paged TMDB discover (page 1–10 chosen at random per request), not a queryable local corpus, so a single title isn't guaranteed to be re-discovered within a bounded number of pages. The override logic itself was verified by direct DB-state inspection and code-level truth-table check against spec 24 §8, not by chasing a flaky live repro. This limitation resolves itself once Stage 2.5 (bucket service) queries the corpus directly instead of re-rolling TMDB pages.

### Stage 1 complete — 2026-08-13

No Android device connected this session, so Stage 0's four `[~]` mobile items are still pending device verification (unchanged from last session — see below).

Applied directly against production (no staging DB — see spec 50 / Stage 5.5), via Supabase MCP migrations + a one-off Node backfill script.

| Item | Change |
|---|---|
| 1.1 | Migration seeds the 8 missing TMDB TV genre ids. `repository.ts` now inserts each `(media_id, genre_id)` link as its own statement (`linkGenres`) instead of one multi-row upsert, so a single bad FK can no longer drop every genre for a title. New `scripts/backfill-media-metadata.mjs` re-fetched TMDB details for every genre-less row and linked genres. Series coverage **46% → 99.6%** (movies 99.7%), verified live. |
| 1.2 | `upsertMedia` rewritten: claims the `media_external_ids` link via `upsert(..., { onConflict: 'provider,external_id', ignoreDuplicates: true })`; the loser of a concurrent-insert race deletes its orphan `media` row and refreshes the winner's metadata instead of leaving a duplicate. Existing rows are now refreshed (`popularity`, genres, etc.) on every touch instead of early-returning stale data. `upsertMediaBatch` moved to `Promise.allSettled` so one failing item can't sink the whole batch — needed for 1.3 below, and incidentally fixes a latent "one bad title fails the whole discover page" bug. Verified 0 duplicate `(provider, external_id)` pairs and 0 orphaned `media` rows, including under a live local test run. |
| 1.3 | New `checkContentFilter` in `@mubitracker/shared` (TMDB `adult` flag, title/overview keyword blocklist, genre-free+`vote_count<50` shape, `vote_count<10`) — spec 21 §4's four rules verbatim. `NormalizedMedia` gained `adult`/`voteCount`; `media` table gained matching columns. Gate lives in `upsertMedia`, applied to *both* the insert and existing-row-refresh paths, so a title wrongly seeded before this filter existed also gets excluded next time it's re-discovered — without deleting the row, so it can't destroy a user's own tracked history. The backfill script additionally swept the 236 genre-less rows against fresh TMDB data: 1 unreferenced title deleted outright, 13 rejected-but-user-tracked titles left alone. 0 `adult=true` rows remain. |

**Two things worth remembering:**
- `media` is a shared global cache with no staging separation — every migration and backfill this session ran directly against production. Stage 5.5 (staging Supabase) is overdue; until then, treat DB changes here with the same care as a prod deploy.
- The backfill script's delete step is intentionally conservative: a row is only ever deleted if *no* `user_media`/`reviews`/`recommendations` row references it. A heuristic content filter WILL sometimes flag legitimate low-profile titles (documentaries, regional TV) — 13 of 14 flagged rows this run were exactly that, not actual adult content, and all 13 were correctly left in place because a user had already tracked them.

### Stage 0 complete — 2026-08-12 (`539641a`)

Seven defects fixed. **Verified:** 0.3 (collection pagination), 0.4 (review save), 0.6 (CI env var).
**Shipped but unverified** (`[~]`, needs device): 0.1, 0.2, 0.5, 0.7 — see *Pending verification* above.

| Item | Change |
|---|---|
| 0.1 | `.catch()` on the auth-guard `getUser()` + loading spinner. Without it a network rejection left `checked` false forever behind `{checked && <Stack>}` — a permanent blank launch screen. *(self-introduced)* |
| 0.2 / 0.7 | New `lib/useFocusFetch.ts` + `components/ScreenState.tsx`: fetch-on-focus with loading/error/retry, applied to collection, review-later, profile. Tab screens stay mounted, so the old `useEffect(…, [])` ran once per session and every tab showed stale data. |
| 0.5 | Record `lastAction` for review-later too — it was skipped while the index still advanced, so undo restored the wrong title. *(self-introduced)* |
| 0.7 | `search.tsx` now awaits classify calls and shows saved/failed/retry; adds poster placeholders, year/type, a11y labels, 44–48dp targets. Profile gained watched/reviews/friends stats. |
| 0.3 | Collection captures `total`/`pageSize` and renders a pager (77 of 101 items were unreachable), plus an error+retry state and capitalised chips. |
| 0.4 | Review editor: `catch` + visible error, non-uuid guard, preserves typed text on failure. |
| 0.6 | CI set `TMDB_API_KEY`, referenced nowhere; replaced with `TMDB_V3_API_KEY` / `TMDB_READ_ACCESS_TOKEN` + `NEXT_PUBLIC_APP_URL`. |

**Tests added.** `apps/web/e2e/` (Playwright + config, wired into `apps/web/package.json` as `test:e2e`) and `mobile-qa/` (Maestro flows, subflows, README) per spec 50 §4.
Web E2E: **4/4 green across 3 consecutive runs** against production. CI green on the commit.

**Two things worth remembering:**
- The first pagination test failure was a **bug in the test**, not the app — it read the DOM immediately after clicking Next while the grid was still swapped for "Loading…". The API was correct all along (page 1 = 24, page 2 = 2, total = 26, verified directly). Always wait for content to settle before asserting.
- Seeding originally went through `/api/v1/deck` and was flaky, because the deck endpoint randomises TMDB paging and can transiently fail — the very problems Stage 2 exists to fix. Seeding now uses `/api/v1/search`, which is deterministic.

### 2026-08-12 — Audit, design, and spec build-out

**Diagnostics.** Four parallel sweeps: mobile QA on a real Android device (Maestro/adb/logcat), web QA against production (Playwright, two accounts), a spec-vs-code audit across all 14 legacy specs, and a deck-engine code analysis — plus live DB queries. Everything landed in [`AUDIT-2026-08-12.md`](AUDIT-2026-08-12.md).

**Assumptions corrected by evidence:**
- Mobile is *not* slow — deck advance is instant, API 0.25–0.85s warm. Web card advance is 275ms median. The real hot spots are filtered deck (~9s) and search (~6.2s).
- `/review-later` is now 196ms (was reported ~5s) — the `bom1` region move fixed it.
- Deck repetition is a *heavy-account* failure (~400-title reachable pool), not general — new accounts see 30/30 unique.
- The friends API flow works end-to-end; discovery is blocked by a missing privacy-settings UI.

**Design decisions locked** (via `/brainstorming`, user-approved):
- Candidate source: **hybrid** — local corpus first, TMDB top-up on shortfall
- Reject policy: **escalating cooldown** 14d → 60d → permanent
- Quotas: **adaptive**, seeded 30/10/10, floor 2 per format
- Exploit/explore: **80/20**
- Bucket: 50 items, pre-built via `after()`, prefetch at item 35

**Specs written** (all new, from audit evidence):
`20-deck-engine-v2` (parent) · `21-corpus-ingestion` · `22-taste-model` · `23-bucket-service` · `24-exclusion-cooldown` · `31-mobile-design-system` · `32-web-ux` · `40-friends-v2` · `50-pipeline` · `spec/README.md` (index).

**Shipped this session:**
- `a67195e` — restored the friend-search privacy rule (reverted a self-introduced regression against spec 12's locked decision: prefix search is public-only, exact username matches anyone)
- Audit + spec + planning docs

**Bugs discovered but NOT yet fixed** — all captured in the plan:
Auth-guard blank screen (self-introduced, no `.catch()` on `getUser()`), mobile screens never refreshing, web collection pagination unreachable, review save failing silently, undo desync after swipe-up (self-introduced), CI referencing the dead `TMDB_API_KEY`, `review_later` animating upward, adult content in the deck, series genre coverage at 46%, zero mobile accessibility labels, accent-colour drift (`#dc2626` vs `#ef4444`).

**Open questions for the user:** none blocking. All product decisions needed for Stages 0–2 are locked in the specs.

**Environment note:** the Android device was disconnected at the end of the session (`adb devices` empty). Reconnect before attempting Stage 0.1/0.2/0.5 verification.
