# Mubitracker — Task List

> **Superseded 2026-08-14 (spec 50 §5.7 docs refresh).** Frozen as of **2026-08-12** and not
> updated since — most items below shipped in Stages 0-4 and this file was never ticked
> alongside them. **Current backlog:** [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md), tracked
> stage-by-stage with verified/unverified status per item. Kept only for archaeology.
> See [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) for the equivalent note on that file.

---

## Phase 0: Infrastructure — MOSTLY DONE

- [x] Monorepo scaffold (pnpm + turbo)
- [x] Shared package (`@mubitracker/shared`)
- [x] 11 subspec documents
- [x] Supabase project created (Mubitracker, `deslckxkuvbfugdxibdn`)
- [x] Initial schema migration applied remotely
- [x] Security advisor warnings fixed (function search_path, revoke execute)
- [x] Supabase MCP connected (Personal Projects org)
- [x] `apps/web/.env.local` created (Supabase + TMDB)
- [x] `apps/mobile/.env` created
- [x] `supabase/config.toml` linked to project ref
- [x] TMDB provider updated (v3 api_key + v4 Bearer fallback)
- [x] CI workflow (GitHub Actions)
- [x] TMDB smoke test passes (`TMDB_V3_API_KEY` → "The Prestige")
- [x] Supabase TypeScript types saved (`apps/web/src/lib/supabase/database.types.ts`)
- [x] Local migration file for `fix_function_security` synced to repo
- [x] **Add `SUPABASE_SERVICE_ROLE_KEY` to `apps/web/.env.local`**
- [x] Local migration `username_ci_unique` applied (case-insensitive unique usernames)
- [ ] Initialize git repo at root (optional but recommended)
- [ ] Disable "Confirm email" in Supabase Auth — optional now (signup auto-confirms via admin API)

---

## Phase 1: MVP Core Loop — API LOOP VALIDATED

Goal: Account → deck → 50 rapid classifications → collection → review later → export.

- [x] Supabase Auth (username + password; unique case-insensitive usernames)
- [x] Synthetic auth email + `POST /api/v1/auth/signup` (auto-confirm)
- [ ] Later: Google/OAuth identity linking for recovery login
- [x] TMDB provider + normalization + upsert
- [x] Search API + UI
- [x] Deck API (TMDB discover batching) + UI
- [x] Keyboard controls (←/→/Enter/↑)
- [x] Mobile-web swipe gestures
- [x] User-media API (watched/unwatched/review-later)
- [x] Collection page
- [x] Review Later queue
- [x] JSON export
- [x] TMDB attribution page (`/about`)
- [x] **First local run:** `pnpm dev` + API deck loop (`scripts/validate-deck-loop.mjs`) — 16/16
- [x] **Fix runtime errors** from first run (none in core loop; removed unused `undoSchema` import)
- [ ] **50-title speed test** — target 2–4 seconds per classification (UI, human)
- [x] Confirm collection reflects tracked statuses (API: watched / unwatched / review-later)
- [x] Confirm export JSON is valid (`export_version: 1` + `media[]`)

---

## Phase 1.5: Filters + Undo — PARTIALLY VALIDATED

- [x] Filter engine (type, genre, language, era, status) — classification mapped to TMDB (anime → genre 16 + ja)
- [x] Filter drawer UI (exclusive type chips + selected states)
- [x] Saved filter presets (API + UI)
- [x] Undo stack (Z key + button + API)
- [x] Deck motion + icons + Review Later toast (`docs/spec/11-deck-ux-polish.md`)
- [x] Test: anime filter returns anime titles
- [ ] Test: "Japanese fantasy anime I haven't watched" deck (manual)
- [ ] Test: saved preset create/load/delete
- [ ] Test: undo after rapid classification (UI / Z key)

---

## Phase 2: Mobile + Reviews — CODE SCAFFOLDED, NEEDS TESTING

- [x] Expo app with tab navigation
- [x] Native swipe deck (Gesture Handler + Reanimated)
- [x] Offline action queue + sync
- [x] Review write UI (web + mobile)
- [x] JSON import (web profile page)
- [ ] Run Expo app on device/emulator
- [ ] Test offline queue (classify without network, sync on reconnect)
- [ ] Test review write flow end-to-end

---

## Phase 3: Social — SPEC READY (`docs/spec/12-friends-system.md`)

- [x] Friend request/accept/block API + UI (partial; needs rework per spec 12)
- [x] Friend profile + collection (privacy-aware)
- [x] Collection comparison
- [x] Recommendations API
- [x] **Friends system design locked** — bell, search+exact, accept/decline/block
- [x] Implement `notifications` + Friends UI per spec 12
- [x] Spec 13 deck actions / watch later approved + implemented
- [ ] Test with two accounts (manual)
- [ ] Verify privacy enforcement (private collection not leaked)
- [ ] Test "Alex watched, I haven't" deck filter

### Deck UX (spec 13)

- [x] Multi-select type filters
- [x] Sticky last deck action (watched/unwatched)
- [x] Watch Later (↑) + Review Later (↓) remap
- [x] Watch Later page `/watch-later`
- [x] Search filters
- [ ] Manual verify Review Later → Reviews tab after classify

---

## Phase 4: Polish + Deploy — NOT STARTED

- [ ] Deploy web to Vercel
- [ ] Add production URL to Supabase auth redirect URLs
- [ ] EAS Build for mobile (optional)
- [ ] Add `profiles` INSERT policy or verify trigger works on signup
- [ ] Add SELECT policy on profiles for friends (friend profile viewing may fail RLS)
- [ ] Performance: deck p95 < 500ms
- [ ] Error boundaries + empty states polish
- [ ] Onboarding copy ("tracks whole series, not episodes")

---

## Phase 5: Advanced — DEFERRED

- [ ] Jikan/MAL anime enrichment
- [ ] Redis cache layer
- [ ] AI natural-language filters
- [ ] Statistics dashboard
- [ ] Admin panel
- [ ] Watchmode streaming availability

---

## Known Issues / Tech Debt

1. **Email confirmation** — username signup uses admin `createUser` with `email_confirm: true`, so Confirm-email setting no longer blocks new accounts. Old email-based test users may still exist.
2. **TMDB Bearer token returned 401** — v3 `api_key` auth works (smoke test OK); Bearer kept as fallback
3. **No git repo at root** — consider `git init` + initial commit
4. **RLS gaps to verify:**
   - `profiles` has no INSERT policy (relies on SECURITY DEFINER trigger — OK; trigger verified on signup)
   - `profiles` friends-only SELECT not implemented (only own + public)
   - `media` has no INSERT policy (service role only — OK for now)
5. **`handle_new_user` uses `raw_user_meta_data`** for username — OK for display, never use for auth decisions
6. **Nested git in apps/web** may still exist from create-next-app
7. **Mobile peer dependency warnings** (react 18 vs 19) — non-blocking for now
8. **First deck batch ~5–6s** cold (TMDB discover + upsert); classify/collection endpoints are sub-2s after that
9. **Expo web bundling** fails on missing `react-native-web` when `pnpm dev` starts mobile — does not block web deck loop
10. **OAuth linking (deferred)** — Google/etc. can be linked later for “forgot username” recovery without changing the username-first UX

---

## Success Criteria (from spec)

Version 1 succeeds when a user can:

1. Create account
2. Open deck and classify 50 titles rapidly (< 3s avg)
3. View collection with correct statuses
4. Mark items Review Later
5. Export JSON collection

Everything else is expansion.
