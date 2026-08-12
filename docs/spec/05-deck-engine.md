# 05 — Deck Engine

The deck is the heart of Mubitracker. This document defines server-side generation, batching, and client prefetch behavior.

## UX Contract

One card visible at a time. After action:
1. Record via API (optimistic on client)
2. Animate card away
3. Show next card immediately
4. Preserve filters and focus
5. No success modals — transition is feedback

## Batch Configuration

| Setting | Value |
|---|---|
| Batch size | 20 |
| Prefetch trigger | When user reaches item 15 of current batch |
| Preload on client | Next 1–2 items always ready |

## Default Deck (Phase 1 — No Filters)

```text
1. Pick random TMDB discover page (movies + TV, popularity.desc)
2. Fetch page from TMDB
3. Normalize + upsert each result to media table
4. Anti-join: exclude media_ids where user_media.status = watched
5. Exclude media_ids in current session's shown_media_ids
6. Return up to `limit` items
7. If batch underfilled, fetch next TMDB page and repeat (max 5 pages)
```

Alternate media types per request: alternate between movie discover and TV discover for variety.

## Filtered Deck (Phase 1.5)

```text
1. Parse Mubitracker filter DSL → TMDB discover params + local filters
2. TMDB params: with_genres, with_original_language, date ranges, format
3. Local filters: status, review_status, friend overlap (Phase 3)
4. Fetch TMDB candidates, upsert, anti-join locally
5. Shuffle result set
6. Return batch
```

### Hybrid Pattern (Critical)

TMDB **cannot** filter by user watch status or friend relationships. Those require PostgreSQL anti-join:

```sql
SELECT m.* FROM media m
WHERE m.id NOT IN (
  SELECT media_id FROM user_media
  WHERE user_id = $1 AND status = 'watched'
)
AND m.id = ANY($candidate_ids)
ORDER BY random()
LIMIT 20;
```

For large anti-join sets, fetch TMDB pages in a loop until batch is full or max attempts reached.

## Randomization

- **No filters:** random TMDB page offset + session dedup
- **With filters:** filter first, then shuffle candidates
- **Never:** `ORDER BY RANDOM()` on millions of rows at scale
- **MVP acceptable:** `ORDER BY random()` on small candidate sets (<10k)

## Session Dedup

Optional `deck_session_id`:
- Store last N shown media IDs (array or join table)
- Prevents same title appearing twice in one session
- Session expires after 24h or on filter change

## Cursor Pagination

Opaque cursor encodes: `{ tmdbPage, tmdbType, sessionId, filterHash }`.

Client passes cursor when fetching next batch at item 15.

## Empty Deck Handling

When filtered deck cannot fill batch (all watched):
```json
{
  "items": [],
  "cursor": null,
  "message": "No unwatched titles match these filters. Try broadening your filters."
}
```

## Undo (Phase 1.5)

Client maintains action stack (max 20):
```typescript
{ mediaId, previousStatus, previousReviewStatus, timestamp }
```

On undo (keyboard `Z` or button):
1. Pop stack
2. `PUT /user-media/:id` with previous values
3. Re-insert card at front of deck (client-only)

## Offline Queue (Phase 2)

Local storage queue:
```json
[{ "media_id", "status", "review_status", "timestamp", "synced": false }]
```

On reconnect: flush queue in order via API.

## Performance Rules

- Do not query entire media table per keystroke
- Deck endpoint target: <500ms p95 with warm cache
- TMDB calls batched; in-flight dedup by provider_id

## Desktop Controls

| Key | Action |
|---|---|
| ← | Focus Haven't Watched |
| → | Focus Watched |
| Enter | Confirm selection |
| ↑ | Watched + Review Later |
| Z | Undo (Phase 1.5) |

Default focus: Haven't Watched.

## Mobile Gestures

| Gesture | Action |
|---|---|
| Swipe left | Haven't Watched |
| Swipe right | Watched |
| Swipe up | Watched + Review Later |

Minimum swipe distance threshold required. Card follows finger; animate away on threshold.
