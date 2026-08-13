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

*Still broken — Stage 2 on:*
- The deck engine can only reach **~400 titles**; a heavy account (283 tracked) has effectively exhausted it. (Stage 2.4 corpus ingestion.)
- Swiping left (**"haven't watched"**) has **no effect** — those titles are never excluded. (Stage 2.1 cooldown/exclusion.)
- One under-filled batch **permanently kills** the deck (null cursor → clients stop prefetching). (Stage 2.5–2.7 bucket service.)
- Mobile has **no friends UI at all**, no filters, no Watch Later, gesture-only actions, zero accessibility labels. (Stages 3–4.)

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

- `media` ~638 rows (grows as deck/search discover new titles; no staging DB, this is production)
- Genre coverage: **movies 99.7%**, **series 99.6%** (was 46% before Stage 1's TV-genre seed + backfill)
- `media.adult` / `media.vote_count` columns added Stage 1 — populated on every upsert, backfilled for previously genre-less rows
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
