# Session Handoff

Last updated: **2026-08-12**
Read after [`CONTEXT.md`](CONTEXT.md). Then work [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) top-down.

---

## ▶ Next session — paste this to start

```
Read docs/CONTEXT.md, docs/HANDOFF.md, and docs/IMPLEMENTATION-PLAN.md.

Stage 0 is shipped. Continue with Stage 1 (deck engine prerequisites),
then Stage 2. Work top-down, one item at a time.

For each item: implement → pnpm typecheck → write/extend its test →
verify against the acceptance criterion → commit → update the checkbox
in IMPLEMENTATION-PLAN.md → append to the Session Log in HANDOFF.md.

If my Android device is connected (check: adb devices), first clear the
Stage 0 mobile items still marked [~] by running:
  maestro test mobile-qa/flows/
and promote them to [x] only if they pass.

Stop and ask me only if an item needs a product decision that isn't
already settled in docs/spec/. Otherwise keep going.

When you finish a stage, update this prompt block and tell me what
changed.
```

**Current position: Stage 0 shipped (`539641a`). Stage 1 is next.**

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
