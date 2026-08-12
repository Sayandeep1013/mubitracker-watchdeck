# 20 — Deck Engine v2 (Bucket Model)

Status: **approved design, ready to implement** (2026-08-12)
Supersedes [`05-deck-engine.md`](05-deck-engine.md). Filter semantics from [`06-filter-system.md`](06-filter-system.md) still apply.
Evidence base: [`../AUDIT-2026-08-12.md`](../AUDIT-2026-08-12.md).

**Subspecs:** [21 — Corpus Ingestion](21-corpus-ingestion.md) · [22 — Taste Model](22-taste-model.md) · [23 — Bucket Service](23-bucket-service.md) · [24 — Exclusion & Cooldown](24-exclusion-cooldown.md)

---

## 1. Why v2 exists

The v1 engine fails in four ways that are structural, not incidental:

| Failure | Cause | Evidence |
|---|---|---|
| Deck exhausts after ~300 swipes | Reachable pool is ~400 titles: `Math.random()*10+1` → TMDB page 1–10 × 20 × 2 formats | `generate.ts:249`; user `rein` has 283 tracked |
| Rejecting a card does nothing | `unwatched` is never excluded — only `watched`/`watch_later` are | `generate.ts:137`; 149 `unwatched` rows for `rein` |
| Deck dies permanently | One under-filled batch → `nextCursor = null` → clients stop prefetching forever | `generate.ts:318`, `DeckView.tsx:120` |
| Feels random, not curated | Zero personalization; history used only as a negative mask | whole of `generate.ts` |

Plus: filtered decks take ~9s and often return empty; `deck_sessions.shown_media_ids` is dead (9 rows, 0 populated).

## 2. Locked decisions

| Topic | Decision | Rationale |
|---|---|---|
| Candidate source | **Hybrid** — sample local `media` corpus first, top up from TMDB on shortfall | Local enables ranking/quotas at ~50ms; TMDB fallback means the deck can never dead-end |
| Bucket size | **50 items** | User-specified; ~2 min of swiping at 2–4s/decision |
| Prefetch trigger | Client crosses **item 35** of 50 | 15 items of runway covers a worst-case cold build |
| Next-bucket build | Next.js 15 `after()` — runs **after** the response is flushed | Zero added latency for the user; matches "fill the next bucket in the background" |
| Quotas | **Adaptive**, seeded from 30 movie / 10 series / 10 anime, floor 2 per format | Fixed quotas would keep serving live-action series the user rejects 90% of the time |
| Exploit / explore | **80 / 20** | 40 taste-weighted + 10 wildcards; prevents filter bubble and corpus burn-down |
| Reject policy | **Escalating**: 14d → 60d → permanent | User choice; respects "a few days" without nagging forever |

## 3. Architecture

```
┌──────────────┐   miss/shortfall   ┌──────────────┐
│  TMDB API    │◀───────────────────│  Bucket      │
└──────┬───────┘                    │  Service     │
       │ ingest (§21)               │  (§23)       │
       ▼                            └──┬────┬──────┘
┌──────────────┐   candidate SQL       │    │
│ media corpus │──────────────────────▶│    │ writes
│  (local DB)  │                       │    ▼
└──────────────┘                       │ ┌──────────────┐
                                       │ │ deck_buckets │
┌──────────────┐   affinity            │ └──────────────┘
│ user_media   │──────────────────────▶│
│ + taste (§22)│                       │
└──────────────┘                       ▼
                                  GET /api/v1/deck
```

Four units, each independently testable:

- **§21 Corpus Ingestion** — fills local `media` from TMDB. Batch/scheduled, off the request path.
- **§22 Taste Model** — turns `user_media` history into per-dimension affinity scores.
- **§23 Bucket Service** — assembles a 50-item bucket from corpus + taste + quotas, persists it, and pre-builds the next one.
- **§24 Exclusion & Cooldown** — decides which titles are eligible for a given user right now.

## 4. Request flow

```
GET /api/v1/deck?bucket=<id|omitted>&<filters>
  1. requireAuth
  2. filterHash = hash(normalised filters)
  3. bucket = find deck_buckets where user, filterHash, status='ready'
  4. if none → build synchronously (§23)
  5. mark bucket 'serving', return items + bucketId + position
  6. after() → if no 'ready' bucket exists for this filterHash, build the next one
```

The cursor concept is **replaced** by `bucketId`. This removes failure 1.3 by construction: there is no null-cursor state that can terminate the client loop. A client with a `bucketId` always has a next request it can make.

## 5. Bucket composition

For a 50-item bucket:

```
40 slots  taste-weighted  (exploit)
10 slots  wildcards       (explore — sampled outside the user's top-3 genres)
─────────
50 total
```

Format/classification quotas are computed per §22 from affinity, seeded at the 30/10/10 default and re-derived once the user has ≥50 decisions. Every format keeps a **floor of 2 slots** so no category disappears entirely.

Within each format quota, genre slots are allocated proportional to that user's genre affinity, then filled by weighted random sampling from the eligible corpus (§24) ordered by a blend of affinity and `popularity`.

**Interleaving is required.** v1 returned 20 movies then 20 series because the inner loop broke at `limit` before the format advanced (`generate.ts:281` vs `:284`). v2 shuffles the assembled bucket before persisting so formats interleave.

## 6. Contracts

```ts
// §23 Bucket Service
buildBucket(userId: string, filters: ParsedDeckFilters): Promise<Bucket>
getReadyBucket(userId: string, filterHash: string): Promise<Bucket | null>
markServing(bucketId: string): Promise<void>

// §22 Taste Model
getTaste(userId: string): Promise<TasteVector>
interface TasteVector {
  genre: Record<number, number>          // genreId → affinity 0..1
  format: Record<MediaFormat, number>
  classification: Record<Classification, number>
  decisionCount: number                  // < 50 ⇒ use default quotas
}

// §24 Exclusion
eligibleMediaFilter(userId: string): SQL   // applied as a NOT EXISTS / anti-join
```

`TasteVector` values are **accept rate**: `accepted / decided`, where `accepted = watched + watch_later`.

## 7. Schema changes

```sql
-- Cooldown state (§24)
alter table user_media
  add column reject_count int not null default 0,
  add column hidden_until timestamptz;           -- null = eligible now
create index on user_media (user_id, hidden_until);

-- Bucket persistence (§23)
create table deck_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  filter_hash text not null,
  status text not null check (status in ('ready','serving','consumed')),
  items jsonb not null,                          -- ordered media ids + denormalised card data
  created_at timestamptz not null default now(),
  served_at timestamptz
);
create index on deck_buckets (user_id, filter_hash, status);

-- Impression suppression (§24) — replaces the dead shown_media_ids
create table deck_impressions (
  user_id uuid not null references profiles(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
create index on deck_impressions (user_id, shown_at);
```

`deck_sessions.shown_media_ids` is **dropped** — it has never been written or read (verified: 9 rows, 0 populated).

## 8. Prerequisites — must land before any bucket work

These three break quotas silently if deferred:

1. **Seed TMDB TV genre IDs** — `genres` holds only the 19 movie IDs, so TV genres (`10759`, `10762`, `10763`, `10764`, `10765`, `10766`, `10767`, `10768`) violate the FK. Because links are inserted as one multi-row statement, a single bad ID drops **all** genres for that title. Series genre coverage is **46%** vs movies' 99%. Seed the missing rows, then backfill.
2. **De-duplicate `media`** — the unique violation on `media_external_ids` is unchecked (`repository.ts:85`), so concurrent upserts can create two rows for one film, which then appear as two cards. Add conflict handling and a dedupe migration.
3. **Adult-content filter** — `include_adult:false` only excludes TMDB-flagged titles; a fresh account was served a 2001 R-18 title as card #2. Filter at ingestion (§21).

## 9. Performance targets

| Operation | v1 today | v2 target |
|---|---|---|
| Bucket served (pre-built) | n/a | **< 150ms** |
| Bucket built cold | 500–900ms warm, 1.5–3s cold | < 800ms |
| Filtered deck | **9.1–9.6s**, often empty | < 800ms |
| Card → card advance | 275ms web / instant mobile | unchanged (already good) |

Achieved by replacing 1–12 serial TMDB round trips per batch with one indexed SQL query against the local corpus.

## 10. Migration & rollback

v2 ships behind a `DECK_ENGINE=v2` env flag. `generate.ts` is retained until v2 has served a full week without a `deck_empty` event. Rollback = flip the flag; no schema rollback needed since all new tables/columns are additive and v1 ignores them.

## 11. Out of scope

Collaborative filtering (friends' taste as signal), Jikan/MAL enrichment, and streaming-availability filtering. These are deliberately deferred — noted here so a later session doesn't treat their absence as an oversight.

---

## Acceptance criteria

- [ ] A user with 300+ tracked items receives 50 unique, previously-unseen titles per bucket for at least 10 consecutive buckets.
- [ ] Swiping left on a title prevents it reappearing for ≥14 days; a third rejection prevents it permanently.
- [ ] `watched` and `watch_later` titles never appear in any bucket.
- [ ] No sequence of user actions can leave the deck permanently unable to fetch more (no null-cursor dead end).
- [ ] A bucket that is already `ready` is served in < 150ms p95.
- [ ] Applying any filter combination returns a populated deck in < 800ms p95, or an explicit "no matches" state — never a blank 9s wait.
- [ ] For a user with ≥50 decisions, format quotas measurably shift toward their accept-rate (verify with `rein`: live-action series slots drop below the 10-slot default).
- [ ] Every bucket contains ≥10 wildcard items drawn outside the user's top-3 genres.
- [ ] Series genre coverage ≥95% after backfill.
- [ ] No duplicate `media` rows for a single TMDB id.
- [ ] No adult-flagged or R-18 title appears in a default (unfiltered) bucket.
