# Session Handoff

Last updated: **2026-08-13**
Read after [`CONTEXT.md`](CONTEXT.md). Then work [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) top-down.

---

## ▶ Next session — paste this to start

```
Read docs/CONTEXT.md, docs/HANDOFF.md, and docs/IMPLEMENTATION-PLAN.md.

Stages 0-1 are shipped, and Stage 2.1-2.6 are done (cooldown + exclusion,
undo carrying cooldown state, taste model, corpus ingestion, bucket
service, background pre-build). All of it ships behind `DECK_ENGINE=v2`,
which is NOT set in Vercel — production is still v1, unaffected.

Continue with 2.7: wire both clients (`DeckView.tsx`,
`apps/mobile/app/(tabs)/deck.tsx`) to consume `bucketId` instead of
`cursor`/`sessionId`. The route already returns both shapes depending on
whether v2 is active (`{bucketId, items, position, partial, reason}` vs
`{items, cursor, sessionId, message}`), so clients need to branch on which
fields are present, or the flag needs to be set to test locally
(`DECK_ENGINE=v2 pnpm --filter @mubitracker/web dev`). Do NOT set
`DECK_ENGINE=v2` in Vercel until 2.7 is done and tested — that's 2.8's job,
"after a clean week."

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

**Current position: Stage 1 and Stage 2.1-2.6 shipped (`2026-08-13`), behind `DECK_ENGINE=v2` (unset in prod). Stage 2.7 (client wiring) is next.**

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
