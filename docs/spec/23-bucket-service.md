# 23 — Bucket Service

Status: **approved design, ready to implement** (2026-08-12)
Subspec of [`20-deck-engine-v2.md`](20-deck-engine-v2.md).

---

## 1. Purpose

Assemble a 50-item bucket from the local corpus (§21), the user's taste vector (§22), and eligibility rules (§24); persist it; and pre-build the next one so the user never waits.

## 2. Lifecycle

```
        build()                serve()              client crosses item 35
   ─────────────▶ [ready] ─────────────▶ [serving] ──────────────────────┐
                                              │                          │
                                              │ next bucket requested    │
                                              ▼                          │
                                        [consumed]                       │
                                                                         ▼
                                                        after() builds next [ready]
```

A user has **at most one `serving`** and **at most one `ready`** bucket per `filterHash`. On serve, the previous `serving` bucket becomes `consumed`.

## 3. Assembly algorithm

```
buildBucket(userId, filters):
  1. taste     = getTaste(userId)                              (§22)
  2. quotas    = deriveQuotas(taste)                           (§22 §8)  → 40 exploit slots
  3. eligible  = corpus ∩ eligibleMediaFilter(userId) ∩ filters (§24)
  4. exploit:  for each format quota, weighted-sample by
               score = 0.7·genreAffinity + 0.3·normalisedPopularity
  5. explore:  sample 10 items uniformly from eligible,
               EXCLUDING the user's top-3 genres
  6. dedupe against items already chosen
  7. shuffle   (interleaves formats — v1 returned 20 movies then 20 series)
  8. if count < 50 → top-up (§5)
  9. persist as deck_buckets(status='ready')
 10. record impressions (§24) for every item
```

Step 5's exclusion of top-3 genres is what makes the explore budget real. Sampling uniformly from the whole corpus would, for a user like `rein`, still return mostly Action/Adventure simply because those dominate the corpus.

## 4. Candidate query

One indexed query replaces v1's 1–12 serial TMDB round trips.

```sql
select m.id, m.format, m.classification, m.popularity,
       array_agg(mg.genre_id) as genre_ids
from media m
left join media_genres mg on mg.media_id = m.id
where m.format = $2
  and not exists (                                   -- §24 eligibility
    select 1 from user_media um
    where um.user_id = $1 and um.media_id = m.id
      and (um.status in ('watched','watch_later')
           or (um.status = 'unwatched'
               and (um.hidden_until is null or um.hidden_until > now())))
  )
  and not exists (                                   -- 24h impression suppression
    select 1 from deck_impressions di
    where di.user_id = $1 and di.media_id = m.id
      and di.shown_at > now() - interval '24 hours'
  )
group by m.id
order by random()
limit $3;
```

Weighted sampling is applied in application code over a candidate set of ~3× the needed slots, rather than in SQL — simpler to test and reason about, and the corpus is small enough that the extra rows are free.

## 5. Shortfall handling

If the corpus cannot fill the bucket — a new user with narrow filters, or a heavy user who has exhausted a niche — the service degrades in a fixed order:

| Step | Action |
|---|---|
| 1 | Relax the **explore** exclusion (allow top-3 genres in wildcard slots) |
| 2 | Relax **quota floors** (let an under-supplied format yield its slots to others) |
| 3 | **TMDB top-up** — targeted discover matching the unsatisfied quota; ingest results (§21) and use them |
| 4 | Return a **short bucket** with `partial: true` |

A short bucket is still served. This is the structural fix for audit failure 1.3: there is no state in which the client is left with nothing to request. `partial: true` tells the client to show a "we're finding more" affordance rather than an error.

**Never** return an empty bucket without an explicit reason code (`no_matches_for_filters` | `corpus_exhausted`), so the UI can distinguish "your filters are too narrow" from "something broke".

## 6. Background pre-build

```ts
import { after } from 'next/server';

// in GET /api/v1/deck, after the response is prepared
after(async () => {
  const hasReady = await getReadyBucket(userId, filterHash);
  if (!hasReady) await buildBucket(userId, filters);
});
```

`after()` runs once the response has been flushed, so pre-building costs the user nothing. This is the mechanism for "fill up another bucket in the background ready to be shipped when the previous one ends."

**Concurrency.** Two rapid requests could both see no `ready` bucket and both build. Guard with an advisory lock keyed on `(userId, filterHash)`:

```sql
select pg_try_advisory_xact_lock(hashtext($1 || $2));
```

If the lock is not acquired, skip — another build is already in flight.

**Verify before relying on it:** `after()` must be confirmed available and behaving in Next.js 15.5.23 on Vercel. If it is not, fall back to building the next bucket synchronously when the client requests item 35 — still ahead of need, just on the request path.

## 7. Filter hashing

```ts
filterHash = sha256(JSON.stringify(normaliseFilters(filters)))
```

`normaliseFilters` sorts arrays and drops empty/default values so `{format:['movie'],genres:[]}` and `{format:['movie']}` hash identically. Buckets are scoped by hash, so changing filters never serves stale candidates — this closes the v1 gap where `DeckCursor` omitted `filterHash` entirely and only a client-side reset prevented cross-filter contamination.

## 8. API contract

```
GET /api/v1/deck?bucket=<uuid>&<filters>

200 {
  bucketId: string,
  items: DeckItem[],          // ≤50, interleaved
  position: number,           // 0-based index the client should resume at
  partial: boolean,
  reason?: 'no_matches_for_filters' | 'corpus_exhausted'
}
```

`bucket` omitted ⇒ serve the `ready` bucket for this `filterHash`, or build one.
`bucket` supplied ⇒ resume that bucket (survives app restart / page reload).

## 9. Cleanup

`consumed` buckets older than 7 days and `deck_impressions` older than 30 days are deleted by a scheduled job. Impressions must outlive the 24h suppression window by a wide margin so the table can also serve analytics.

---

## Acceptance criteria

- [ ] A bucket contains ≤50 items with formats interleaved, not blocked.
- [ ] Exactly 10 items per full bucket come from outside the user's top-3 genres.
- [ ] A `ready` bucket is served in <150ms p95.
- [ ] Requesting the deck twice in rapid succession never produces two concurrent builds (advisory lock holds).
- [ ] Changing filters produces a different `filterHash` and never serves the prior filter's items.
- [ ] Supplying `bucket=<id>` resumes at the correct `position` after a reload.
- [ ] When the corpus cannot fill a bucket, a short bucket with `partial: true` is returned — never an empty response without a `reason`.
- [ ] No user action sequence leaves the client with no valid next request.
- [ ] Every served item is recorded in `deck_impressions`.
- [ ] `after()` pre-build is verified working on Vercel, or the documented synchronous fallback is in place.
