# 22 — Taste Model

Status: **approved design, ready to implement** (2026-08-12)
Subspec of [`20-deck-engine-v2.md`](20-deck-engine-v2.md).

---

## 1. Purpose

Convert existing `user_media` history into per-dimension **affinity scores** that drive bucket quotas and ranking (§23). No new tracking is required — the signal already exists and is unusually clean.

## 2. Definition

```
affinity(d) = accepted(d) / decided(d)

accepted = status in ('watched', 'watch_later')
decided  = status in ('watched', 'watch_later', 'unwatched')
```

`review_status` is deliberately excluded — it measures intent to write, not taste.

Computed across three dimensions:

| Dimension | Source |
|---|---|
| `genre` | `media_genres` → `genres.id` |
| `format` | `media.format` (movie / series) |
| `classification` | `media.classification` (live_action / anime / animation / documentary) |

## 3. Verified signal (user `rein`, 283 decisions)

This is measured, not hypothetical:

| Genre | Affinity | | Format × classification | Affinity |
|---|---|---|---|---|
| Science Fiction | 0.90 | | live_action movie | 0.63 |
| Adventure | 0.85 | | anime series | 0.67 |
| Fantasy | 0.81 | | animation movie | 0.61 |
| Action | 0.73 | | **live_action series** | **0.10** |
| Drama | 0.41 | | | |
| Comedy | 0.40 | | | |
| Crime | 0.32 | | | |

The 0.63 vs 0.10 format spread is the single strongest signal in the dataset and the main reason the v1 deck felt worthless: it kept serving live-action series the user rejects nine times out of ten.

## 4. Confidence and cold start

Affinity from a handful of decisions is noise. Two guards:

**Minimum decisions.** Below **50 total decisions**, ignore computed affinity entirely and use the default quotas (30 movie / 10 series / 10 anime). `TasteVector.decisionCount` carries this so §23 can branch.

**Per-dimension smoothing.** Even past 50, an individual genre may have few samples. Apply Laplace smoothing toward the population mean:

```
affinity(d) = (accepted(d) + α · prior) / (decided(d) + α)      α = 5, prior = 0.5
```

A genre with 1 accept / 1 decide yields `(1 + 2.5)/(1 + 5) = 0.58`, not 1.0. A genre with 37/41 (`rein`, Sci-Fi) yields `(37 + 2.5)/(41 + 5) = 0.86` — barely moved. Smoothing only suppresses low-confidence extremes, which is the intent.

## 5. Recency weighting

Taste drifts. Weight each decision by age:

```
weight = 0.5 ^ (age_days / 180)        # 180-day half-life
```

A decision from a year ago counts ~0.25 of a decision from today. Implemented as a weighted sum in SQL, not a post-filter.

## 6. Query

Single query, no materialisation initially — at `rein`'s 283 rows this runs in ~30ms.

```sql
with decided as (
  select um.media_id, um.status, um.updated_at,
         power(0.5, extract(epoch from (now() - um.updated_at)) / (86400 * 180)) as w
  from user_media um
  where um.user_id = $1
    and um.status in ('watched','watch_later','unwatched')
)
select g.id as genre_id,
       sum(w) filter (where status in ('watched','watch_later')) as accepted,
       sum(w) as decided
from decided d
join media_genres mg on mg.media_id = d.media_id
join genres g on g.id = mg.genre_id
group by g.id;
```

Repeated for `format` and `classification` (joining `media` directly).

## 7. Caching

Recompute when **either** is true: ≥10 new decisions since last compute, or the cached vector is >24h old. Cache in `user_taste`:

```sql
create table user_taste (
  user_id uuid primary key references profiles(id) on delete cascade,
  vector jsonb not null,
  decision_count int not null,
  computed_at timestamptz not null default now()
);
```

Cheap to rebuild, so a stale-cache bug degrades ranking quality but never correctness.

## 8. Quota derivation

§23 consumes the vector as follows:

```
if decisionCount < 50:
    quotas = { movie: 30, series: 10, anime: 10 }
else:
    raw[f]   = affinity(format=f) × affinity(classification associated with f)
    share[f] = raw[f] / Σ raw
    slots[f] = round(share[f] × 40)          # 40 exploit slots
    slots[f] = max(slots[f], 2)              # floor: nothing disappears
    rebalance so Σ slots == 40
```

For `rein` this yields roughly 38 movie / 4 series / 8 anime — series demoted but not eliminated, exactly as intended.

The remaining **10 wildcard slots are allocated ignoring affinity** (§23 §explore) so the floor mechanism and the explore budget are independent.

## 9. Explicit signals (future, not v2)

`filter_presets` express *declared* taste and could act as a prior; friends' accepted titles could provide collaborative signal. Both are out of scope — noted so a later session doesn't treat them as oversights.

---

## Acceptance criteria

- [ ] `getTaste(userId)` returns affinity in `[0,1]` for every genre, format, and classification the user has decided on.
- [ ] Users with <50 decisions receive `decisionCount < 50` and default quotas are used.
- [ ] Smoothing verifiably suppresses low-sample extremes (1 accept / 1 decide ⇒ ≈0.58, not 1.0).
- [ ] A decision 180 days old contributes ~half the weight of one made today.
- [ ] For `rein`, computed affinity reproduces the §3 table within ±0.05 for genres with ≥8 samples.
- [ ] For `rein`, derived quotas allocate fewer slots to live-action series than the 10-slot default, and ≥2 (floor respected).
- [ ] Taste computation adds <50ms to a cold bucket build.
- [ ] Cache invalidates after 10 new decisions or 24h, whichever comes first.
