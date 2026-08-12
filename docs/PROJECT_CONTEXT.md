# Watchdeck (MubiTracker) — Project Context Guide

## Handoff for Next Chat

Start a new chat and attach **both** files:

1. `docs/PROJECT_CONTEXT.md` — architecture, Supabase project, env setup, file map
2. `docs/TASKLIST.md` — prioritized remaining work with checkboxes

**First action for next agent:** Manual two-account friends test (bell, accept/decline). Verify Watch Later (↑) and Review Later (↓) on `/deck`. Specs: `12-friends-system.md`, `13-deck-actions-watch-later.md`.

## What This Is

**Watchdeck** is a frictionless personal media-tracking app. Core loop: **one title → one decision (watched / haven't watched / review later) → next title**. Not a Letterboxd clone — speed is the product.

- **Repo folder:** `D:\Projects\MubiTracker` (name differs from product name; that's intentional)
- **Product name:** Watchdeck
- **Intent:** Personal/hobby, non-commercial, solo part-time build
- **Stack:** Next.js 15 + Supabase + TMDB + Expo mobile (scaffolded)

## Monorepo Layout

```text
MubiTracker/
  apps/web/              Next.js web app + API routes (/api/v1/*)
  apps/mobile/           Expo React Native app
  packages/shared/       Types, Zod schemas, API client, TMDB helpers
  supabase/migrations/   SQL migrations (source of truth for schema)
  docs/spec/             11 subspec documents (00–10)
  docs/TASKLIST.md       Current task backlog
  scripts/               tmdb-smoke-test.mjs
```

## Supabase (LIVE — configured)

| Field | Value |
|---|---|
| **Organization** | Personal Projects |
| **Project name** | Mubitracker |
| **Project ref** | `deslckxkuvbfugdxibdn` |
| **Region** | ap-south-1 (Mumbai) |
| **API URL** | `https://deslckxkuvbfugdxibdn.supabase.co` |
| **Status** | ACTIVE_HEALTHY |

### Migrations applied (remote)

1. `initial_schema` — all tables, RLS, triggers, 19 TMDB genres seeded
2. `fix_function_security` — search_path + revoked public execute on `handle_new_user`

Local migration files: `supabase/migrations/20250812000000_initial_schema.sql`, `20250812000001_fix_function_security.sql`

### Tables (all RLS enabled)

`profiles`, `media`, `media_external_ids`, `genres` (19 rows), `media_genres`, `user_media`, `reviews`, `friendships`, `filter_presets`, `recommendations`, `deck_sessions`

### MCP access

Supabase MCP is connected to **Personal Projects** org. Use project_id `deslckxkuvbfugdxibdn` for MCP tools.

## Environment (local)

Files created (gitignored):

- `apps/web/.env.local` — Supabase URL + anon key + TMDB keys
- `apps/mobile/.env` — Supabase + API URL for Expo

### Service role key

`SUPABASE_SERVICE_ROLE_KEY` is set in local `apps/web/.env.local`. For production, add it as a **Vercel environment variable** (not `NEXT_PUBLIC_` — server-only).

**Never commit this key. Never expose in client code.**

## TMDB

- **v3 API key:** `TMDB_V3_API_KEY` in `.env.local` — **verified working** (smoke test finds "The Prestige")
- **v4 read access token:** `TMDB_READ_ACCESS_TOKEN` (Bearer fallback)
- Provider prefers v3 `api_key` query param; falls back to Bearer JWT
- Attribution required on `/about` page (already implemented)
- Regenerate types after schema changes: Supabase MCP `generate_typescript_types` → `apps/web/src/lib/supabase/database.types.ts`

## Auth

- **MVP:** username + password only (unique, case-insensitive)
- Under the hood: Supabase Auth with synthetic email `{username}@users.watchdeck.local`
- Signup via `POST /api/v1/auth/signup` (service role, auto-confirmed) then client password sign-in
- **Later:** link Google/other OAuth identities for recovery/login without remembering username
- Never commit or expose the synthetic email in UI

## Architecture (critical rules)

1. **Frontend never calls TMDB directly** — all via `/api/v1/*`
2. **TMDB is a data provider**, not the app database
3. **User state** lives in `user_media` (not on `media`)
4. **Deck generation** is hybrid: TMDB discover → upsert media → anti-join watched → return batch of 20
5. **Auth:** username + password (synthetic email under the hood); middleware redirects unauthenticated users to `/login`

## API Routes (all under `/api/v1/`)

| Route | Purpose |
|---|---|
| `POST /auth/signup` | Username + password signup (unique, auto-confirm) |
| `GET /deck` | Deck batch (filters, pagination) |
| `GET /search` | TMDB search + upsert |
| `PUT /user-media/:id` | Set watched/unwatched |
| `POST /user-media/review-later` | Watched + review pending |
| `POST /user-media/undo` | Revert last action |
| `GET /collection` | User's tracked media |
| `GET /reviews/pending` | Review later queue |
| `POST /reviews` | Write review |
| `GET /export` | JSON export |
| `POST /import` | JSON import |
| `GET /filter-presets` | Saved filters |
| `GET /friends`, `POST /friends/request` | Social |
| `GET /friends/:id/compare` | Collection comparison |
| `GET /health/tmdb` | TMDB connectivity check |

## Web Pages

| Route | Purpose |
|---|---|
| `/deck` | Primary deck (keyboard + swipe) |
| `/search` | Direct title lookup |
| `/collection` | Grid of tracked media |
| `/review-later` | Pending review queue |
| `/friends` | Friend management + compare |
| `/profile` | Stats, export, import, delete account |
| `/about` | TMDB attribution |
| `/login` | Auth |

## What's Built vs What Needs Work

### Done (code exists, builds pass)

- Full monorepo scaffold
- 11 subspec documents
- PostgreSQL schema applied to remote Supabase
- All API routes implemented
- Web UI for all pages
- Filter engine + presets + undo (Phase 1.5)
- Expo mobile app scaffold with swipe deck + offline queue
- Social features (friends, compare, recommendations)
- CI workflow (`.github/workflows/ci.yml`)
- Security advisor warnings fixed

### Validated (2026-08-12)

- API deck loop: signup → confirm email → deck batch → watched/unwatched/review-later → collection → pending reviews → export → undo (`scripts/validate-deck-loop.mjs`, 16/16)
- TMDB health, profile trigger on signup, service role writes

### Not yet validated (needs human / UI testing)

- Browser signup → deck swipe/keyboard UX
- 50-title speed test (success criteria)
- Filter presets + “Japanese fantasy anime” deck
- Mobile app on device
- Friend flows with two accounts

## Key Spec Documents

Read these before making architectural decisions:

- [`docs/spec/00-product-principles.md`](spec/00-product-principles.md) — non-negotiables
- [`docs/spec/05-deck-engine.md`](spec/05-deck-engine.md) — deck batching logic
- [`docs/spec/02-data-model.md`](spec/02-data-model.md) — schema reference
- [`docs/TASKLIST.md`](TASKLIST.md) — what to do next

## Hosting (production)

**Vercel is enough.** There is no separate backend server to deploy.

| Layer | Where it runs | Notes |
|---|---|---|
| Web UI + API (`/api/v1/*`) | **Vercel** | Next.js Route Handlers = your backend |
| Database + Auth | **Supabase** (already live) | Hosted Postgres + Auth |
| TMDB calls | **Vercel serverless** | Server-only env vars, never in browser |
| Mobile app | **Expo / app stores** | Calls `EXPO_PUBLIC_API_URL` → your Vercel URL |

### Vercel env vars (Settings → Environment Variables)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # server only
TMDB_V3_API_KEY                    # server only
TMDB_READ_ACCESS_TOKEN             # server only (optional fallback)
NEXT_PUBLIC_APP_URL                # https://your-app.vercel.app
```

Also in Supabase Dashboard → Authentication → URL Configuration: add your Vercel URL to **Site URL** and **Redirect URLs**.

Mobile: set `EXPO_PUBLIC_API_URL=https://your-app.vercel.app` for production builds.


```bash
pnpm install
pnpm dev                          # starts web on :3000
pnpm --filter @watchdeck/shared test
pnpm --filter @watchdeck/web build
TMDB_V3_API_KEY=xxx node scripts/tmdb-smoke-test.mjs
pnpm --filter @watchdeck/mobile dev  # Expo
```

## Conventions

- Package manager: **pnpm** (workspace)
- TypeScript strict mode
- `@watchdeck/shared` for all types/schemas between web + mobile
- Server uses **service role** client; browser uses **anon** client
- Do not commit `.env.local`, `.env`, or API keys
