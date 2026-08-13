# Implementation Plan

Last updated: **2026-08-12**
Source of truth for *what to build next*. Update the checkboxes as work lands.
Context: [`CONTEXT.md`](CONTEXT.md) · Session log: [`HANDOFF.md`](HANDOFF.md) · Findings: [`AUDIT-2026-08-12.md`](AUDIT-2026-08-12.md)

---

## How to use this file

Work **top to bottom**. Stages are ordered by dependency, then by user-visible value per unit of effort.
Do not start a stage until its listed prerequisites are checked.
Every item names its spec, its files, and how to verify it. If an item can't be verified, it isn't done.

**Definition of done for any item:** code changed · `pnpm typecheck` clean · relevant test passes · verified against the acceptance criterion · committed and pushed · this file's checkbox ticked · [`HANDOFF.md`](HANDOFF.md) updated.

**Status legend**

| Mark | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | Code complete and shipped, but the acceptance criterion is **not yet verified** — usually because it needs the physical Android device |
| `[x]` | Verified against its acceptance criterion |

Never promote `[~]` to `[x]` without actually running the check. Anything left at `[~]` is listed in [`HANDOFF.md`](HANDOFF.md) under *Pending verification*.

---

## Stage 0 — Stop the bleeding

Independent, small, immediately felt. No prerequisites. **Do these first.**

> **Shipped 2026-08-12 in `539641a`.** Web and CI items are verified; the four
> mobile items are code-complete but need the Android device to confirm.
> Maestro flows are already written for them in `mobile-qa/flows/`.

- [~] **0.1 Auth-guard blank screen (P0)** — `apps/mobile/app/_layout.tsx:19`
  `supabase.auth.getUser().then()` has no `.catch()`. On network rejection `setChecked(true)` never runs and `{checked && <Stack>}` renders nothing → **permanent blank screen**. Add `.catch()`, plus a loading indicator during the round-trip.
  *Verify:* airplane-mode launch reaches the login screen, never a blank one.

- [~] **0.2 Mobile screens never refresh (P0)** — `apps/mobile/app/(tabs)/collection.tsx:9`, `review-later.tsx:10`, `profile.tsx:11`
  `useEffect(…, [])` with no `useFocusEffect`; tabs stay mounted so data is stale all session. Swipe a title watched → Collection still shows "Unwatched".
  *Verify:* classify on Deck, switch to Collection, status is correct without an app restart.

- [x] **0.3 Web collection pagination (P0)** — `apps/web/src/app/collection/page.tsx`
  77 of 101 items unreachable: `page` state exists, nothing sets it >1, `total` discarded. Add the pager. Spec [`32`](spec/32-web-ux.md).
  *Verify:* an account with >24 items can reach every item.

- [x] **0.4 Review save fails silently (P0)** — `apps/web/src/app/review-later/[id]/page.tsx`
  `save()` is `try/finally` with no `catch`; a 400 (`invalid uuid` on `media_id`) leaves the UI unchanged. Add error handling **and** fix the id being passed.
  *Verify:* a failing save surfaces an error; a valid save persists.

- [~] **0.5 Undo desync after swipe-up** — `apps/mobile/app/(tabs)/deck.tsx:83`
  `lastAction` is skipped for review-later but the index still advances, so undo restores the wrong title. *(Self-introduced.)*
  *Verify:* swipe up, then undo — the correct title is restored.

- [x] **0.6 CI references a dead env var** — `.github/workflows/ci.yml`
  Sets `TMDB_API_KEY`, which no longer exists anywhere; code uses `TMDB_V3_API_KEY` / `TMDB_READ_ACCESS_TOKEN`. Spec [`50`](spec/50-pipeline.md).
  *Verify:* CI green with correct vars declared in `turbo.json` build `env`.

- [~] **0.7 Mobile error handling** — `collection.tsx:10`, `review-later.tsx:11` have no `.catch()` → permanent blank screen on failure. `search.tsx:43-48` is fire-and-forget with no feedback.
  *Verify:* with the API unreachable, every screen shows an error state with retry.

---

## Stage 1 — Deck engine prerequisites

**Blocks Stage 2.** These silently corrupt quotas if deferred. Spec [`21`](spec/21-corpus-ingestion.md) §5–6.

> **Shipped 2026-08-13.** Series genre coverage 44%→99.6%. All three items
> verified live against production DB (no staging environment yet — see
> Stage 5.5). See Session Log in `HANDOFF.md` for detail.

- [x] **1.1 Seed TMDB TV genre IDs + backfill**
  `genres` holds only the 19 movie IDs. TV genres (`10759`, `10762`–`10768`) violate the FK, and because links insert as one multi-row statement, one bad ID drops **all** genres for that title. Series coverage is **46%** vs movies' 99%. Seed, switch to per-row `on conflict do nothing`, backfill.
  *Verify:* series genre coverage ≥95%.

- [x] **1.2 De-duplicate `media` + fix upsert** — `apps/web/src/lib/media/repository.ts:85`
  Unique violation unchecked → concurrent upserts create two rows for one film → the same film appears as two cards. Add conflict handling, a dedupe migration, and metadata refresh (currently `upsertMedia` early-returns so `popularity` is never updated).
  *Verify:* no two `media` rows share a `(provider, external_id)` pair.

- [x] **1.3 Adult-content filter** — spec [`21`](spec/21-corpus-ingestion.md) §4
  `include_adult:false` only catches TMDB-flagged titles; a fresh account was served a 2001 R-18 title as card #2.
  *Verify:* no adult title in 200 sampled corpus rows.

---

## Stage 2 — Deck engine v2

Spec [`20`](spec/20-deck-engine-v2.md). Requires Stage 1.

**2A ships the biggest win on its own** — it retrofits into the existing `generate.ts` without the bucket service, and makes rejecting a card actually work.

- [x] **2.1 Cooldown schema + exclusion anti-join** — spec [`24`](spec/24-exclusion-cooldown.md)
  Add `user_media.reject_count` / `hidden_until`, `deck_impressions`. Replace the in-memory `Set` (`generate.ts:133`) with a SQL anti-join — this also removes the silent PostgREST 1,000-row truncation that lets watched titles reappear.
  *Verify:* swipe-left hides for 14d; watched never returns; undo restores `reject_count`.

- [x] **2.2 Undo carries cooldown state** — extend `POST /api/v1/user-media/undo` with prior `reject_count`/`hidden_until`.
  *Verify:* three mis-swipes + three undos leave the title eligible.

- [x] **2.3 Taste model** — spec [`22`](spec/22-taste-model.md). `user_taste` table, smoothing, 180-day recency half-life, <50-decision cold start.
  *Verify:* `rein`'s computed affinity reproduces the measured table ±0.05.

- [x] **2.4 Corpus ingestion** — spec [`21`](spec/21-corpus-ingestion.md). `scripts/ingest-corpus.mjs`, ~150 TMDB calls → ~3,000 titles.
  *Verify:* corpus ≥3,000 non-adult titles; re-run inserts 0 duplicates.

- [x] **2.5 Bucket service** — spec [`23`](spec/23-bucket-service.md). `deck_buckets`, assembly, quotas, 80/20, filter hashing, advisory lock, shortfall ladder.
  *Verify:* 50 interleaved items, 10 wildcards, `partial:true` instead of empty, no dead-end state.

- [x] **2.6 Background pre-build** — Next.js `after()`. **Verify `after()` works on Vercel first**; if not, use the documented synchronous fallback at item 35.
  *Verify:* a `ready` bucket serves in <150ms p95.

- [x] **2.7 Wire both clients to buckets** — replace cursor with `bucketId` in `DeckView.tsx` and `apps/mobile/app/(tabs)/deck.tsx`; honour `partial`/`reason`.
  *Verify:* filtered deck <800ms; no null-cursor dead end reachable.
  > Both clients now detect the response shape (`bucketId` present ⇒ v2) and branch accordingly — no separate code path needed per engine, so this is safe to ship even while `DECK_ENGINE` stays unset in prod. Verified end-to-end in a real headless browser (web) against `DECK_ENGINE=v2` locally; mobile got the identical logic but is typecheck-only (no device connected this session — see HANDOFF).

- [ ] **2.8 Retire v1** behind `DECK_ENGINE=v2` after a clean week.

---

## Stage 3 — UX feedback layer

Specs [`31`](spec/31-mobile-design-system.md) (mobile) · [`32`](spec/32-web-ux.md) (web). Independent of Stage 2 — can run in parallel.

> **Shipped 2026-08-13** (3.1–3.7). All seven items are code-complete and
> `pnpm typecheck` clean, but this session had no Android device or emulator
> connected — none of it has been visually or interactively confirmed. Left
> at `[~]` per the status legend; see *Pending verification* in `HANDOFF.md`.

- [~] **3.1 Mobile theme tokens** — new `apps/mobile/lib/theme.ts`; screens currently hardcode hex. Resolves accent drift (login uses `#dc2626`, web uses `#ef4444`).
- [~] **3.2 Deck drag feedback + exit/enter animations (mobile)** — no visual response today; card just springs back. Directional overlays: right/green/check, left/red/X, up/amber/clock, down/purple/bookmark.
- [~] **3.3 Toast component (mobile)** — none exists; web has one. Include Undo affordance.
- [~] **3.4 Safe areas + keyboard** — review modal renders under the status bar; login has no `KeyboardAvoidingView`.
- [~] **3.5 Accessibility** — mobile has **zero** `accessibilityLabel`/`accessibilityRole`; actions are gesture-only. Add the fallback button row and 48dp targets.
- [~] **3.6 Unify gesture map** — ↑ = Watch Later on both. Mobile maps ↑ to Review Later and has no ↓.
- [~] **3.7 Loading / empty / error states** on every mobile screen.
- [x] **3.8 Web polish** — deck skeleton + retry, review editor shows the title, `text-neutral-00` / `text-neutral-????00` invalid classes, self-host the broken TMDB logo, review-later empty state names the wrong key, import error messages, lowercase chips.
  > Also fixed a spec-32 §2.1 defect found while touching this code: `review_later` animated the card **upward** (same direction as `watch_later`) instead of downward. Verified in a real headless browser — see Session Log.

---

## Stage 4 — Parity & friends

Spec [`40`](spec/40-friends-v2.md). Requires Stage 3 tokens for consistency.

- [~] **4.1 Privacy settings UI** — no UI exists to change `profile_visibility`, which is the actual reason public friend search finds nobody.
  > Web: Privacy card on `/profile` (3 selects, optimistic save) + Copy handle; first-run nudge on `/friends`. Verified live in a real headless browser — `[x]` for the web half. Mobile: same toggle + Copy handle on Profile, typecheck-only (no device) — `[~]` for the mobile half, hence the combined `[~]`. Mobile's first-run nudge lands with 4.2 (mobile Friends screen doesn't exist yet).
- [~] **4.2 Mobile friends UI** — currently 100% absent; the shared client already has 11 friends methods.
  > New Friends tab: list (Friends/Incoming/Outgoing/Blocked segmented), add-friend modal, friend detail (Compare/Their Deck/Block/Unblock), notifications modal + badge, first-run nudge (deferred from 4.1). `deck.tsx` now forwards `friend_id`/`friend_mode` so Their Deck works. Typecheck-only — no device this session. Maestro flow `mobile-qa/flows/friends-ui.yaml` covers the single-device-reachable surface; written, never run.
- [~] **4.3 Mobile filters + presets** — entirely absent.
  > New filters modal (Type/Genre/Language/Release-Era/Status chips, matching web's `FilterDrawer.tsx`) + saved presets, shared with the Deck tab via a new `FiltersProvider` context (no server round-trip needed for the filters themselves — same client methods web already uses). Typecheck-only, no device this session.
- [~] **4.4 Mobile Watch Later** — no gesture, action, screen, or tab.
  > Gesture/action already existed since 3.6 (↑ = Watch Later). Added the missing screen (`app/watch-later.tsx`) as a pushed screen reachable via a clock-icon header button on Collection, not a new bottom tab — deliberately avoids the exact tab-bar-crowding problem 4.6 fixed on web (mobile already grew to 6 tabs via 4.2's Friends addition). Typecheck-only, no device this session.
- [~] **4.5 Mobile undo depth 1 → 20** to match web.
  > Converted the single `lastAction` slot into a stack capped at `MAX_UNDO_STACK` (20), same constant web already uses. Typecheck-only — no device this session.
- [x] **4.6 Web mobile-breakpoint nav** — bottom bar renders `links.slice(0,5)`, so Friends/Profile/bell are unreachable under `md`.
  > 5 items (Deck/Search/Collection/Reviews/More) + a bottom sheet (Watch Later/Friends/Profile/Notifications/About). Notification polling extracted to `useNotificationsFeed()` so desktop bell and mobile sheet share one poller instead of double-polling/double-toasting. Verified live in a real headless browser at 390×844 (all sheet behaviors) and 1280×900 on the same session (no desktop regression).
- [x] **4.7 `friendMode` semantics** — `watched_not_me`, `watched`, unset all collapse to one predicate; `reviewed` unhandled.
  > Rewritten to source candidates directly from the friend's own `user_media`/`reviews` (stable pagination) instead of intersecting random TMDB discover pages with the friend's watched set — the latter made "Their Deck" thin/empty in practice. Verified live against production DB with a 3-account scenario covering all three modes, pagination, and access errors.
- [x] **4.8 Unblock route** — block is currently irreversible.
  > `DELETE /api/v1/friends/[id]/block`, restricted to whoever placed the block (`blocked_by` column). Verified live: non-blocker unblock 403s, blocker unblock 200s + deletes row, second unblock 404s, either side can re-request after unblock.
- [x] **4.9 Reverse-accepted duplicate guard** — B can re-request A after acceptance, creating a second row.
  > POST now loads any existing row for the pair and branches on status (`accepted`→409, pending same-direction→409, pending reverse→auto-accept, `blocked`→403); backed by a unique index across both directions. Verified live.
- [~] **4.10 Mobile `/about`** — TMDB attribution missing on mobile (licensing gap).
  > New `app/about.tsx`, text-only attribution + outbound link (no logo asset — would need `react-native-svg`, not installed, not worth adding for one static image). Linked from Profile. Typecheck-only, no device this session.
- [~] **4.11 Mobile SecureStore** — session is in `AsyncStorage`; spec 08 requires `expo-secure-store` (installed, unused).
  > `lib/supabase.ts` now uses a SecureStore-backed storage adapter for the session. Known unverified risk noted in-code: SecureStore's ~2048-byte Android item limit — not expected to bite password-only auth, but genuinely unverified without a device. `offline-queue.ts`'s separate AsyncStorage usage (spec 08's action queue) is untouched, per spec. Typecheck-only.
- [ ] **4.12 Web `/reviews` list screen** — spec [`32`](spec/32-web-ux.md) §4 (Written/Pending tabs). Scoped into spec 32 but not covered by Stage 3.8 or any other 4.x item; folded in here per the gap flagged in `HANDOFF.md` rather than left untracked.
- [ ] **4.13 Notifications alignment** — spec [`40`](spec/40-friends-v2.md) §7 (endpoint path, read-timing, toast actions, badge parity across web/mobile). Scoped into spec 40 but not an original 4.1-4.11 item; same gap pattern as 4.12.

---

## Stage 5 — Pipeline & observability

Spec [`50`](spec/50-pipeline.md).

- [ ] **5.1 Analytics** — none exists; the headline metric (2–4s per classification) is unmeasurable. Events: `deck_batch_served`, `media_classified`, `undo_used`, `deck_empty`, `filter_applied`.
- [ ] **5.2 CI expansion** — add `expo export` bundle check, API contract smoke, Playwright E2E.
- [ ] **5.3 Maestro nightly** — device E2E in a nightly job (a Maestro no-op costs ~24s, too slow per-push).
- [ ] **5.4 TMDB caching** — none exists; the 35ms per-instance gate is meaningless on serverless.
- [ ] **5.5 Staging Supabase** — local/preview/prod all share one project today; preview deploys write production data.
- [ ] **5.6 Test-data cleanup** — `wqa*`/`mqa*` accounts accumulate.
- [ ] **5.7 Docs refresh** — `PROJECT_CONTEXT.md` / `TASKLIST.md` claim 11 specs (14), 2 migrations (5), "no git repo" (repo+CI live), "Expo SDK 52 scaffolded" (SDK 54).
- [ ] **5.8 Dead code** — `GET_MEDIA` (not an HTTP verb, ignored by Next), unreachable `/recommendations`, `/friends/[id]/collection`, `/friends/[id]/profile`.
- [ ] **5.9 Migration filename convention** — `20250812*` ×4 vs `20260812*` ×1 breaks lexical ordering; document forward-only convention.

---

## Parallelisation

```
Stage 0  ──┬─────────────────────────────▶ (independent, do first)
Stage 1  ──┴──▶ Stage 2 ──▶ Stage 2.8
Stage 3  ─────────────────────────────────▶ (parallel with 1–2)
Stage 4  ──────────────▶ (needs Stage 3 tokens)
Stage 5  ─────────────────────────────────▶ (parallel throughout)
```
