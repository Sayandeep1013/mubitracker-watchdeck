# Session Handoff

Last updated: **2026-08-12**
Read after [`CONTEXT.md`](CONTEXT.md). Then work [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) top-down.

---

## ▶ Next session — paste this to start

```
Read docs/CONTEXT.md, docs/HANDOFF.md, and docs/IMPLEMENTATION-PLAN.md.

Continue the plan from Stage 0. Work top-down, one item at a time.
For each item: implement → typecheck → verify against its acceptance
criterion → commit → tick the checkbox in IMPLEMENTATION-PLAN.md →
append a line to the Session Log in HANDOFF.md.

Stop and ask me only if an item needs a product decision I haven't
already made in docs/spec/. Otherwise keep going.

When you finish a stage, update the "Next session" prompt block at the
top of HANDOFF.md and tell me what changed.
```

**Current position: Stage 0 not started.** Stages 1–5 are blocked behind it only by convention (Stage 0 items are independent) — but Stage 0 is where the user-visible damage is.

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
