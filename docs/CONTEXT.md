# Project Context

Last updated: **2026-08-12**
**Read this first.** It describes what Mubitracker is, where it runs, and what state it's actually in.
Then read [`HANDOFF.md`](HANDOFF.md) (what just happened) and [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) (what to do next).

---

## 1. What this is

**Mubitracker** — a frictionless personal media tracker. The core loop is *one title → one decision (watched / haven't watched / watch later / review later) → next title*. Speed is the product; it is not a Letterboxd clone.

Personal/hobby project, non-commercial, solo part-time build. Repo folder is `D:\Projects\MubiTracker`; the product was renamed from **Watchdeck → Mubitracker** on 2026-08-12 (the GitHub repo name `mubitracker-watchdeck` still carries the old name).

## 2. Stack & layout

```
MubiTracker/                    pnpm workspaces + Turborepo, Node 20.x
  apps/web/         Next.js 15.5.23 (App Router, Turbopack) + API routes /api/v1/*
  apps/mobile/      Expo SDK 54.0.36 · RN 0.81.5 · React 19.1.0 · Reanimated 4
  packages/shared/  types, Zod schemas, API client (MubitrackerClient), TMDB helpers
  supabase/migrations/   schema source of truth (5 applied)
  docs/             this folder
  scripts/          validate-deck-loop.mjs, tmdb-smoke-test.mjs
```

**Architecture rule:** the frontend never calls TMDB directly — everything goes through `/api/v1/*`. TMDB is a data provider, not the app database. User state lives in `user_media`.

## 3. Live infrastructure

| Thing | Value |
|---|---|
| Production URL | `https://mubitracker-watchdeck-web.vercel.app` |
| Vercel project | `mubitracker-watchdeck-web` (`prj_FfAZJVt1qyvohwDLsLfZKfaiU6XO`) |
| Vercel team | `sayandeep1013s-projects` (`team_q9sUDJaercZaGDmPDu4s7qPQ`) |
| Function region | **`bom1`** (Mumbai) — pinned in `apps/web/vercel.json` to co-locate with Supabase |
| Supabase project | `Mubitracker` — ref `deslckxkuvbfugdxibdn`, region `ap-south-1` |
| GitHub | `Sayandeep1013/mubitracker-watchdeck`, auto-deploy on push to `main` |
| CI | `.github/workflows/ci.yml` — typecheck, shared unit tests, web lint, web build |

**Deploy:** push to `main` → Vercel builds automatically. Build command is `pnpm turbo run build --filter=@mubitracker/web`, output `.next`, root directory `apps/web`.

Env vars live in Vercel project settings and `apps/web/.env.local` locally. Any var used at build time **must** also be listed in `turbo.json`'s build `env` array or Turbo's cache goes stale.

## 4. Auth model

Username + password only. Under the hood, Supabase Auth with a **synthetic email**: `<username>@users.mubitracker.local`. Signup goes through `POST /api/v1/auth/signup` (service role, auto-confirmed), then the client signs in with the password.

⚠️ Accounts created before the rename used `@users.watchdeck.local` and can no longer log in. The database was wiped on 2026-08-12, so this only matters if old data is ever restored.

## 5. Current state — honest assessment

**Works and verified on real devices/browsers:** signup/login/logout, auth guard, middleware redirects; deck gestures + keyboard on both clients; filters and presets (web); collection filtering/sort/search server-side; watch-later and review-later population; the full two-account friends flow (request → accept → mutual, compare, Their Deck); export/import; the IMDb link on both clients.

**Measured performance** (after the `bom1` region move): card→card advance **275ms** web / instant mobile; most pages <1s. Mobile is **not** slow. The remaining hot spots are **filtered deck loads (~9s)** and **title search (~6.2s)**.

**Known broken** — full list with evidence in [`AUDIT-2026-08-12.md`](AUDIT-2026-08-12.md). Status as of Stage 1 (`2026-08-13`):

*Still true in production* (v2 exists and is verified but ships behind `DECK_ENGINE=v2`, unset in Vercel — nothing below changes for real users until Stage 2.7 finishes and 2.8 flips the flag):
- The deck engine can only reach **~400 titles** per session; a heavy account (283 tracked) has effectively exhausted it.
- Deck serving is still **taste-blind** in production — v1 (`generate.ts`) never calls `getTaste`/`deriveQuotas`. A user who rejects 90% of live-action series still gets served them at the same rate as before.
- One under-filled batch **permanently kills** the deck (null cursor → clients stop prefetching) — v2's bucket model fixes this structurally (bucketId always has a next request), but clients aren't wired to it yet (Stage 2.7).
- Mobile has **no friends UI at all**, no filters, no Watch Later flow. (Friends/filters/Watch Later remain Stage 4.)

*Fixed in Stage 2.1/2.2 (`2026-08-13`):*
- ~~Swiping left had no effect~~ — `user_media.reject_count`/`hidden_until` + `deck_impressions` (spec 24). First reject hides 14d, second 60d, third+ forever; watched/watch_later hide forever; a served-but-unacted title is suppressed 24h. Verified live: escalation sequence, undo restoring exact prior `reject_count`/`hidden_until`, and a watched title never reappearing across 4 consecutive batches.
- ~~In-memory exclusion `Set` with no `.limit()`~~ (silently truncated past 1,000 PostgREST rows, so watched titles could reappear for heavy accounts) — replaced with a per-page scoped lookup against only that page's candidate ids. No unbounded fetch exists in the deck path anymore.
- Undo (`POST /api/v1/user-media/undo`) now carries and restores `previous_reject_count`/`previous_hidden_until` — both clients capture them from the deck item at swipe time.

*Known limitation carried into 2.1 (not a defect, will resolve itself in 2.5):* candidates still come from live, randomly-paged TMDB discover calls, not an indexed local corpus. Exclusion/cooldown correctness was verified directly (DB state, escalation math, watched-never-reappears), but "does an explicit `status=unwatched` filter re-surface one specific previously-rejected title" is architecturally probabilistic until Stage 2.5 queries the corpus directly instead of re-rolling random TMDB pages.

*Added in Stage 2.3 (`2026-08-13`):* `getTaste()`/`deriveQuotas()` in `apps/web/src/lib/deck/taste.ts` — per-genre/format/classification affinity from `user_media` history, Laplace-smoothed, 180-day recency half-life, cached in `user_taste`. Verified against `rein`'s real history: genre affinities within ±0.03 of the audit's measured table, RPC executes in 10.5ms server-side.

*Added in Stage 2.4-2.7 (`2026-08-13`) — the whole deck-engine-v2 rewrite, behind `DECK_ENGINE=v2` (unset in prod, so none of this is live for real users yet):*
- Corpus ingestion (`scripts/ingest-corpus.mjs`) took `media` from 641 to 4,247 non-adult titles — see Session Log for the full breakdown.
- `apps/web/src/lib/deck/bucket-service.ts` — `buildBucket`/`getReadyBucket`/`markServing`, `get_eligible_media` SQL function, `deck_buckets`/`deck_build_locks` tables. Wired into `GET /api/v1/deck` when `DECK_ENGINE=v2`.
- Both clients (`DeckView.tsx`, mobile `deck.tsx`) detect which response shape they got and branch — same component, no separate v1/v2 build. Verified end-to-end in a real headless browser for web (multi-bucket advance, filter-change → new bucket, undo, zero console errors); mobile is typecheck-only, no device connected this session.
- Two real bugs found only by testing (not inspection): cold-start quotas producing 60-item buckets instead of 50, and a `get_eligible_media` query costing 1.24s server-side (fixed to 34.6ms) because genre aggregation ran before the LIMIT instead of after. Both fixed — see Session Log for detail.
- `after()` background pre-build verified working locally; unverified on an actual Vercel deployment (flag isn't live there).

**Next step is Stage 2.8** (retire v1 after a clean week) — this requires the user's explicit go-ahead before setting `DECK_ENGINE=v2` in Vercel, since it changes what every production user sees on the deck screen. Do not flip that flag unprompted.

*Added in Stage 3.1-3.7 (`2026-08-13`) — mobile UX feedback layer, spec [`31`](spec/31-mobile-design-system.md), code-complete and typecheck-clean but **not device-verified** (no Android device connected this session):*
- New `apps/mobile/lib/theme.ts` (color/space/radius/type/motion/elevation tokens, `hitSlopFor()`) — zero hex literals remain anywhere in `apps/mobile/app` or `apps/mobile/components`.
- New `apps/mobile/components/Toast.tsx` (`ToastProvider`/`useToast()`, 2500ms auto-dismiss, Undo affordance, `accessibilityLiveRegion="polite"`), mounted in `_layout.tsx` alongside `SafeAreaProvider`.
- Deck (`deck.tsx`) rewritten: directional cue overlays (right/green/check, left/red/X, up/amber/clock, down/purple/bookmark) with opacity interpolation, drag-opacity falloff to 0.7 at 300px, spring-back on an unresolved drag, exit/enter animations gated so `index` only advances from the exit-animation completion callback, a visible fallback button row (4 actions + Confirm) so no action is gesture-only, haptics per spec §4.5, ↑=Watch Later/↓=Review Later (was ↑=Review Later, no ↓), a `busyShared` shared value guarding the pan gesture's `onUpdate`/`onEnd` so a new drag can't corrupt an in-flight exit animation.
- `review/[id].tsx` and `login.tsx` gained `SafeAreaView`/`KeyboardAvoidingView`; the review modal now fetches and shows the title being reviewed and disables Save while in flight; `createReview` failures surface as an error toast.
- Every `Pressable` across `apps/mobile/app` has `accessibilityRole` + a non-empty `accessibilityLabel`; every interactive control measures ≥48dp including `hitSlop`.
- Collection/Review Later/Profile/Search/Deck/Login/Review each render distinct loading/empty/error states; every `apiClient` call site has a `.catch()` (direct try/catch, or centrally via `useFocusFetch`).
- Search actions (`search.tsx`) now emit an error toast on a failed classify, in addition to the existing await + inline saved/failed/retry row state.
- `GET /api/v1/profile` (shared by both clients) gained `unwatchedCount`/`watchLaterCount` alongside the existing `watchedCount`/`reviewCount`/`friendsCount`; mobile Profile now shows all four counts spec 31 requires (watched/haven't/watch later/reviews) instead of three.

*Added in Stage 3.8 (`2026-08-13`) — web polish, spec [`32`](spec/32-web-ux.md), verified in a real headless browser:*
- Fixed a real defect found while implementing this stage, not by inspection alone: `DeckView.tsx`'s `review_later` action animated the card **upward** (same direction as `watch_later`), instead of downward per spec 32 §2.1's canonical contract. Now correctly exits down with the purple bookmark cue.
- Deck shows a full-size skeleton (not a blank/tiny spinner) during the initial or filter-change load, and a distinct "Couldn't load the deck" + Retry + Edit filters state on genuine fetch failure (previously indistinguishable from the legitimate "Deck is empty" state).
- `apps/web/public/tmdb.svg` — the TMDB logo is now self-hosted (the audit's recorded URL had also gone stale; TMDB fingerprints asset filenames per deploy). `/about` no longer hits `ERR_BLOCKED_BY_ORB`.
- `profile/page.tsx`: fixed two literal-invalid Tailwind classes (`text-neutral-00`, `text-neutral-????00`); import now distinguishes malformed JSON from a valid-but-server-rejected payload and shows both via a reused `ActionToast` instead of `alert()`.
- `review-later/[id]/page.tsx` now shows the title/poster of the media being reviewed; `review-later/page.tsx`'s empty state correctly says "press ↓" (was ↑).
- Collection's status chips were already correctly capitalized (`All / Watched / Unwatched`) — the audit's fix-list entry for this was stale; confirmed by reading the code, not re-fixed.

*Added in Stage 4.7-4.9 (`2026-08-13`) — friends backend fixes, spec [`40`](spec/40-friends-v2.md), verified live against production DB:*
- ~~`friendMode` semantics all collapsed to one predicate; `reviewed` unhandled~~ — `generateFriendDeck` now queries the friend's own `user_media`/`reviews` directly (stable offset pagination) instead of intersecting random TMDB discover pages with their watched set, which is also what was making "Their Deck" thin/empty in practice. All three modes (`watched_not_me`/`watched`/`reviewed`) implemented and access-checked (`FriendAccessError` → 400/403).
- ~~Block was irreversible~~ — `blocked_by` column + `DELETE /api/v1/friends/[id]/block`, restricted to whoever placed the block. Web `friends/page.tsx` gained a Blocked tab with Unblock.
- ~~B could re-request A after A already accepted, creating a duplicate row~~ — POST now branches on the existing row's status (`accepted`→409, pending-same-direction→409, pending-reverse→auto-accept, `blocked`→403); backed by a unique index across both directions of the pair.

**Known gap — resolved by explicit plan items, not yet implemented:** spec 32 §4 (a `/reviews` list screen with Written/Pending tabs) and spec 40 §7 (notifications alignment) were both scoped into their specs but absent from `IMPLEMENTATION-PLAN.md`. §6 (mobile-web bottom-nav `More` sheet) is covered by existing item 4.6. §4 and §7 are now explicit items **4.12** and **4.13** in Stage 4, rather than left as untracked prose gaps.

*Fixed in Stage 1 (`2026-08-13`):*
- ~~Series genre coverage 46%~~ — TV genre ids seeded, per-row genre-link inserts (one bad FK no longer drops a title's whole genre set), 236 genre-less rows backfilled from TMDB. **99.6% series / 99.7% movie coverage**, verified live.
- ~~`media` duplicate rows on concurrent upsert~~ — `upsertMedia` now claims the `media_external_ids` link with `on conflict do nothing`; the loser of a race discards its orphan insert and refreshes the winner's metadata instead. Verified 0 duplicate `(provider, external_id)` pairs and 0 orphaned `media` rows under a live test run.
- ~~Adult content could reach the deck~~ — `checkContentFilter` (TMDB `adult` flag, keyword blocklist, genre-free+low-votes shape, `vote_count<10`) now gates every `media` write (deck discover, search, import). Backfill swept the 236 genre-less rows against fresh TMDB data: 1 unreferenced title deleted, 13 flagged-but-user-tracked titles left untouched (never destroys a user's own history), 0 `adult=true` rows remain.
- ~~`upsertMedia` never refreshed metadata on existing rows~~ — now updates `popularity`/genres/etc. on every touch instead of early-returning.
- ~~One bad item could sink a whole discover/search page~~ — `upsertMediaBatch` uses `Promise.allSettled`; a rejected or failed item is dropped, not fatal to the batch.

*Fixed in Stage 0:*
- ~~Web Collection pagination unreachable~~ — pager shipped, E2E verified.
- ~~Review save failing silently~~ — error handling + uuid guard, E2E verified.
- ~~Mobile tabs never refreshing~~ — `useFocusFetch`; **awaiting device verification**.
- ~~Auth-guard blank screen on launch~~ — `.catch()` + spinner; **awaiting device verification**.
- ~~Undo desync after review-later~~ — **awaiting device verification**.

Anything marked *awaiting device verification* is `[~]` in the plan and listed in [`HANDOFF.md`](HANDOFF.md).

## 6. Reference data (live DB, 2026-08-13)

Useful for reasoning about the engine without re-querying:

- `media` ~4,247 rows after Stage 2.4 corpus ingestion (grows further as deck/search discover new titles; no staging DB, this is production)
- Genre coverage: **movies 99.96%**, **series 99.9%** (was 46% before Stage 1's TV-genre seed + backfill)
- `media.adult` / `media.vote_count` columns added Stage 1 — populated on every upsert, backfilled for previously genre-less rows; `get_eligible_media` (Stage 2.5) additionally requires `vote_count >= 10` as defense-in-depth against pre-Stage-1 rows the content filter never touched
- `deck_sessions` 9 rows, **0** with `shown_media_ids` populated (dead column)
- Heaviest account `rein`: 283 decisions — 123 watched, 149 haven't, 11 watch later
- `rein` taste signal: Sci-Fi 0.90 · Adventure 0.85 · Fantasy 0.81 · Action 0.73 · Crime 0.32 · Horror 0.36; **live-action movie 0.63 vs live-action series 0.10**

## 7. Tooling available in this environment

| Tool | Notes |
|---|---|
| Supabase MCP | project `deslckxkuvbfugdxibdn` — SQL, migrations, advisors, type gen |
| Vercel MCP | deployments, build logs, project config |
| Playwright 1.62.1 | web E2E — suite lives in `apps/web/e2e/`, run with `pnpm --filter @mubitracker/web test:e2e`. Needs `E2E_SUPABASE_URL` + `E2E_SUPABASE_ANON_KEY` to seed (the API authenticates by bearer header, not cookie). Targets production unless `E2E_BASE_URL` is set. |
| Maestro 2.6.1 + MCP | Android device automation; flows in `mobile-qa/flows/`, see `mobile-qa/README.md`. **A no-op run costs ~24s**, so device E2E belongs in a nightly job. |
| adb | device id `00158351M001200` when connected (**not always plugged in**) |
| Expo dev server | `pnpm --filter @mubitracker/mobile dev`; LAN mode works, **tunnel does not** (`exp.direct` unreachable from this network) |

Mobile testing runs through **Expo Go** (free) — no EAS build is needed for functional testing. Expo Go is SDK-locked; the project is on SDK 54 to match.

## 8. Conventions

- Package manager **pnpm**; TypeScript strict; shared types in `@mubitracker/shared`.
- Server uses the **service-role** Supabase client (RLS bypassed); browser uses the anon client for auth only.
- Never commit `.env.local` / `.env`. Root-level `*.png` is gitignored (QA screenshot artifacts leaked in twice).
- Test accounts follow `wqa*` (web QA) / `mqa*` (mobile QA) so they're identifiable and cleanable.
- Migrations are the schema source of truth. ⚠️ Filename dates are inconsistent (`20250812*` ×4, `20260812*` ×1) so lexical order no longer matches chronology — forward-only convention documented in spec 50.
