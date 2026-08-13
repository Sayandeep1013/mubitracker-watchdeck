# Session Handoff

Last updated: **2026-08-13**
Read after [`CONTEXT.md`](CONTEXT.md). Then work [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) top-down.

---

## ▶ Next session — paste this to start

```
Read docs/CONTEXT.md, docs/HANDOFF.md, and docs/IMPLEMENTATION-PLAN.md.

Stages 0-1 are shipped. Continue with Stage 2 (deck engine v2), starting
at 2.1 (cooldown + exclusion) — it's the biggest single win and retrofits
into generate.ts without needing the bucket service yet. Work top-down,
one item at a time.

For each item: implement → pnpm typecheck → write/extend its test →
verify against the acceptance criterion → commit → update the checkbox
in IMPLEMENTATION-PLAN.md → append to the Session Log in HANDOFF.md.

There is no staging Supabase yet (Stage 5.5) — migrations and verification
queries run directly against production. Use the Supabase MCP for
migrations/queries; keep them additive and reversible where possible.

If my Android device is connected (check: adb devices), first clear the
Stage 0 mobile items still marked [~] by running:
  maestro test mobile-qa/flows/
and promote them to [x] only if they pass.

Stop and ask me only if an item needs a product decision that isn't
already settled in docs/spec/. Otherwise keep going.

When you finish a stage, update this prompt block and tell me what
changed.
```

**Current position: Stage 1 shipped (`2026-08-13`). Stage 2 is next, starting at 2.1.**

### Pending verification

Code-complete but unverified — all four need the Android device. Maestro flows are already written; run `maestro test mobile-qa/flows/`.

| Item | Flow |
|---|---|
| 0.1 auth-guard blank screen | `mobile-qa/flows/auth-guard-offline.yaml` |
| 0.2 tabs never refresh | `mobile-qa/flows/tab-refresh.yaml` |
| 0.5 undo desync after review-later | `mobile-qa/flows/undo-after-review-later.yaml` |
| 0.7 mobile error handling | covered incidentally by the above; no dedicated flow yet |

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
