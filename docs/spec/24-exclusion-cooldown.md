# 24 — Exclusion & Cooldown

Status: **approved design, ready to implement** (2026-08-12)
Subspec of [`20-deck-engine-v2.md`](20-deck-engine-v2.md).

---

## 1. Purpose

Decide which titles are eligible for a given user right now. This is the single most user-visible part of the engine: in v1, swiping left had **no effect whatsoever** on future decks.

## 2. The v1 defect

`getExcludedMediaIds` filters only `watched` and `watch_later` (`apps/web/src/lib/deck/generate.ts:137`). A title marked `unwatched` is a first-class candidate again on the very next batch.

`rein` has **149 `unwatched` rows**, every one of them re-servable. Spec 13 line 20 shows the original author noticing this mid-sentence — *"Excluded once set… actually unwatched means tracked as no — exclude from deck"* — but the exclusion was never implemented.

## 3. Rules

| State | Eligibility |
|---|---|
| `watched` | **Never** shown again |
| `watch_later` | Hidden until watched or removed from the list |
| `unwatched`, reject #1 | Hidden **14 days** |
| `unwatched`, reject #2 | Hidden **60 days** |
| `unwatched`, reject #3+ | **Never** shown again |
| Served, no action taken | Hidden **24 hours** |
| Never seen | Eligible |

Escalation is per the approved design: it honours "hide it for a few days" without re-serving a title the user has now rejected three separate times.

## 4. State

```sql
alter table user_media
  add column reject_count int not null default 0,
  add column hidden_until timestamptz;          -- null = eligible now
```

`hidden_until` is a **materialised** deadline rather than something derived at read time from `updated_at + f(reject_count)`. Two reasons: the query stays a simple index-backed comparison, and changing the escalation policy later does not silently reinterpret every historical row.

Permanent exclusion is represented as `hidden_until = 'infinity'::timestamptz`, so the eligibility predicate needs no special case.

## 5. Transitions

```
on classify(media, status):
  if status == 'unwatched':
      reject_count += 1
      hidden_until  = now() + [14d, 60d, infinity][min(reject_count, 3) - 1]
  if status == 'watched' or 'watch_later':
      hidden_until  = infinity          -- excluded by rule, not by cooldown
      reject_count  = unchanged         -- preserved: undo must restore it

on undo(media, previousStatus, previousReviewStatus):
      restore status, reject_count, and hidden_until to their prior values
```

**Undo must restore `reject_count`.** If it does not, an accidental swipe-left followed by undo still burns a rejection, and three mis-swipes would permanently hide a title the user never rejected. The undo payload therefore carries the prior `reject_count` and `hidden_until` alongside `previous_status`.

This extends the existing undo contract (`POST /api/v1/user-media/undo`), which currently carries only `previous_status` and `previous_review_status`.

## 6. Impression suppression

Serving a card without the user acting on it is weak negative signal — usually they closed the app. Suppressing for 24h prevents the same unacted-on titles leading every bucket.

```sql
create table deck_impressions (
  user_id  uuid not null references profiles(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
```

Written on bucket assembly (§23), upserting `shown_at = now()` on conflict. This replaces `deck_sessions.shown_media_ids`, which was specced for exactly this purpose and never implemented — 9 session rows exist, **0** have any IDs.

## 7. Eligibility predicate

Applied as an anti-join in the candidate query, never as an in-memory `Set`:

```sql
not exists (
  select 1 from user_media um
  where um.user_id = $1 and um.media_id = m.id
    and (um.status in ('watched','watch_later')
         or (um.status = 'unwatched'
             and (um.hidden_until is null or um.hidden_until > now())))
)
and not exists (
  select 1 from deck_impressions di
  where di.user_id = $1 and di.media_id = m.id
    and di.shown_at > now() - interval '24 hours'
)
```

**This also fixes a latent correctness bug.** v1 loads every excluded id into a JS `Set` with no `.limit()` (`generate.ts:133`). PostgREST caps rows at 1,000 by default, so past 1,000 watched+watch_later items the exclusion set silently truncates and **watched titles start reappearing**. An anti-join has no such ceiling.

Required indexes:

```sql
create index on user_media (user_id, hidden_until);
create index on deck_impressions (user_id, shown_at);
```

## 8. Filter interaction

Explicit status filters override cooldown, because the user is asking to see those titles:

| Filter | Behaviour |
|---|---|
| `status=watched` | Show watched titles; ignore cooldown |
| `status=watch_later` | Show the watch-later list; ignore cooldown |
| `status=unwatched` | Show rejected titles **including** those in cooldown |
| no status filter | Full §3 rules apply |

Collection and Watch Later screens read `user_media` directly and are unaffected by any of this.

## 9. Observability

Emit `deck_exclusion_stats` per bucket build: corpus size, eligible count, and counts excluded by each rule. When eligible drops below 2× bucket size, log a warning — that is the early signal that a user is exhausting the corpus, and it is exactly the condition v1 hit silently.

---

## Acceptance criteria

- [ ] A title marked `watched` never appears in any subsequent bucket.
- [ ] A title marked `watch_later` does not appear until watched or removed.
- [ ] First swipe-left hides a title for ≥14 days; second for ≥60; third permanently.
- [ ] Undo restores `status`, `reject_count`, **and** `hidden_until` — three mis-swipes plus three undos leave the title eligible.
- [ ] A title served but not acted on does not reappear within 24h.
- [ ] Exclusion is evaluated as a SQL anti-join; no code path loads excluded IDs into memory.
- [ ] A user with >1,000 watched items still never sees a watched title (the PostgREST 1,000-row truncation is gone).
- [ ] `status=unwatched` filter surfaces cooled-down titles.
- [ ] `deck_impressions` is written for every served item and pruned after 30 days.
- [ ] A warning is logged when eligible candidates fall below 2× bucket size.
