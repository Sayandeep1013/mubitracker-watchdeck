# 21 — Corpus Ingestion

Status: **approved design, ready to implement** (2026-08-12)
Subspec of [`20-deck-engine-v2.md`](20-deck-engine-v2.md).

---

## 1. Purpose

Turn `media` from a write-only cache into a **queryable candidate corpus**, so bucket assembly (§23) is one indexed SQL query instead of 1–12 serial TMDB round trips.

Today `media` holds 554 rows and is only ever written as a side effect of serving a deck. Nothing queries it as a source of candidates.

## 2. Target corpus

| Property | Target |
|---|---|
| Size | ~3,000 titles (≈2,000 movie / ≈1,000 series) |
| Cost to build | ~150 TMDB discover calls (20 results each) |
| Refresh | Weekly incremental; full re-scan monthly |
| Growth | Also grows opportunistically from search + deck top-ups |

3,000 titles is a **7.5× increase** over the current ~400 reachable pool and comfortably exceeds any single user's lifetime swipe volume at 50/bucket.

## 3. Ingestion strategy

Breadth comes from **varying the discover axes**, not from paging deeper into one popularity list (deep pages are obscure and low quality).

```
for format in [movie, series]:
  for sort in [popularity.desc, vote_average.desc, revenue.desc]:
    for decade in [1970s, 1980s, 1990s, 2000s, 2010s, 2020s]:
      for page in 1..3:
        discover(format, sort, decade, page)
```

`2 × 3 × 6 × 3 = 108` calls per full pass. Add targeted passes for under-represented classifications:

- **anime**: `with_genres=16` + `with_original_language=ja`, both formats
- **animation (non-anime)**: `with_genres=16` excluding `ja`
- **documentary**: `with_genres=99`

`vote_average.desc` passes must set `vote_count.gte=200` or they return obscure titles with a single 10/10 vote.

## 4. Adult-content filter

`include_adult=false` is necessary but **not sufficient** — TMDB only flags titles explicitly registered as adult, and a fresh account was served a 2001 R-18 title as card #2 (audit §2.8).

Reject at ingestion when **any** of:

| Rule | Detail |
|---|---|
| `adult === true` | TMDB's own flag |
| Genre-free + low vote count | `genre_ids.length === 0 && vote_count < 50` — the shape most soft-porn entries take |
| Title/overview keyword blocklist | Maintained list in `packages/shared/src/constants/content-filter.ts` |
| `vote_count < 10` | Insufficient signal to judge; excluded from corpus regardless |

Rejected titles are recorded in `media_rejected(tmdb_id, reason, rejected_at)` so a later pass does not re-fetch and re-evaluate them.

## 5. Genre integrity (prerequisite)

Ingestion **must not run** until the genre table is correct, or it will bake in the current 46% series coverage.

```sql
-- TMDB TV-specific genre ids absent from the initial seed
insert into genres (id, name) values
  (10759, 'Action & Adventure'),
  (10762, 'Kids'),
  (10763, 'News'),
  (10764, 'Reality'),
  (10765, 'Sci-Fi & Fantasy'),
  (10766, 'Soap'),
  (10767, 'Talk'),
  (10768, 'War & Politics')
on conflict (id) do nothing;
```

Then backfill: for every `media` row with zero `media_genres`, re-fetch its genres from TMDB and insert.

Insert genre links with `on conflict do nothing` **per row**, not as a single multi-row statement — the current all-or-nothing insert is exactly why one bad ID drops every genre for a title (`repository.ts:92`).

## 6. Upsert correctness

Two bugs must be fixed as part of this work:

1. **Duplicate media rows.** `repository.ts:85` ignores the unique violation on `media_external_ids`, so two concurrent requests can each insert the same film. Use `insert … on conflict (provider, external_id) do nothing` then re-select, and add a one-off dedupe migration for existing duplicates.
2. **Stale metadata.** `upsertMedia` early-returns for known media (`repository.ts:59-62`), so `popularity` is never refreshed and genres are never backfilled. Ingestion must **update** metadata on existing rows, not skip them.

Bucket assembly ranks partly on `popularity`, so a corpus with 2024 popularity values will rank badly in 2026.

## 7. Execution model

| Mode | Trigger | Scope |
|---|---|---|
| **Seed** | one-off script, run manually | full pass (~150 calls) |
| **Refresh** | scheduled weekly | `popularity.desc` pages 1–3 + metadata refresh for rows older than 30 days |
| **Top-up** | inline, on bucket shortfall | narrow discover matching the unsatisfied quota; ingests what it fetches |

Seed and refresh run as a script under `scripts/ingest-corpus.mjs`, invoked with `BASE_URL`/service-role credentials the same way `scripts/validate-deck-loop.mjs` is. They are **not** request-path code.

Rate limiting: TMDB's real limit is ~50 req/s. The existing 35ms module-global gate (`provider.ts:26-33`) is meaningless on serverless (per-instance) but is correct for a single long-lived script process. Keep it for ingestion; do not rely on it in request handlers.

## 8. Idempotency & observability

- Ingestion is idempotent: re-running a pass updates metadata and inserts nothing duplicate.
- Each run logs: calls made, titles seen, inserted, updated, rejected (by reason), duration.
- A run that would insert 0 new titles across a full pass is a signal the corpus is saturated for that strategy — log a warning so the axes can be widened.

---

## Acceptance criteria

- [ ] `genres` contains all 8 TMDB TV genre IDs.
- [ ] Series genre coverage ≥95% (currently 46%); movie coverage stays ≥99%.
- [ ] Corpus reaches ≥3,000 non-adult titles after a seed run.
- [ ] Re-running the seed inserts 0 duplicates and updates `popularity` on existing rows.
- [ ] No `media` row shares a `(provider, external_id)` pair with another row.
- [ ] Every ingested title has `vote_count >= 10` and passes the adult filter.
- [ ] A full seed run completes within the TMDB rate limit without a 429.
- [ ] Ingestion never runs on the request path.
