# Spec Index

Two generations of specs live here. **20+ supersede their 00–13 counterparts** where they overlap; the older ones remain as the record of original intent and for anything not yet re-specced.

---

## Hierarchy

```
Product foundation
  00-product-principles.md      non-negotiables, core loop
  01-architecture.md            system shape
  02-data-model.md              schema reference
  03-media-providers.md         TMDB integration + licensing
  04-api-contract.md            ⚠ partially stale — see note below

Deck engine  ── v2 supersedes 05/06 ──────────────────────────────
  20-deck-engine-v2.md          ★ PARENT — bucket model, locked decisions
    21-corpus-ingestion.md        local corpus, genre integrity, adult filter
    22-taste-model.md             affinity scoring, quotas, cold start
    23-bucket-service.md          assembly, pre-build, shortfall ladder
    24-exclusion-cooldown.md      what the user never sees again
  05-deck-engine.md             (superseded by 20)
  06-filter-system.md           filter semantics — still current

Experience
  31-mobile-design-system.md    ★ RN/M3 tokens, motion, a11y, per-screen
  32-web-ux.md                  ★ canonical deck feedback contract, pagination, reviews
  07-web-client.md              (largely superseded by 32)
  08-mobile-client.md           parity checklist — still current
  11-deck-ux-polish.md          original motion spec — 31/32 extend it

Social
  40-friends-v2.md              ★ extends 12 — mobile UI, unblock, friendMode
  12-friends-system.md          ⛔ LOCKED privacy decisions — do not contradict
  09-social-phase.md            (largely superseded by 12/40)

Actions
  13-deck-actions-watch-later.md  status model, gesture map

Operations
  50-pipeline.md                ★ environments, CI, testing, observability
  10-ops-security-privacy.md    50 extends it
```

★ = written 2026-08-12 from the audit. ⛔ = contains locked decisions.

---

## Rules

1. **Spec 12 is locked.** Its privacy rule — *exact username → anyone; partial search → public only* — is a decision, not an implementation detail. A regression against it already happened once; don't repeat it.
2. **Specs 20–24 are a unit.** The parent carries the architecture and locked decisions; subspecs carry mechanics. Read the parent first.
3. **Cite, don't assume.** When a spec references code, it cites `path:line` verified at time of writing. Re-verify before trusting a line number.
4. **`04-api-contract.md` is stale** in places — it predates `POST /friends` (was `/friends/request`), `/friends/:id/compare`, `watch_later`, and the notifications surface. Treat live routes as truth.

## Where to start

| Goal | Read |
|---|---|
| Understand the product | `00` → `13` |
| Work on the deck | `20` → then the relevant subspec |
| Work on mobile UI | `31` → `08` (parity) |
| Work on web UI | `32` → `11` |
| Work on friends | `12` (locked) → `40` |
| Work on CI/deploy/tests | `50` → `10` |
