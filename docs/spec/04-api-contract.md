# 04 — API Contract

Base path: `/api/v1`. All authenticated routes require Supabase JWT in `Authorization: Bearer <token>`.

## Auth

Handled by Supabase client SDK. Profile created on first login via trigger or `/api/v1/profile` POST.

## Endpoints

### Profile

```
GET  /api/v1/profile
PATCH /api/v1/profile
DELETE /api/v1/profile          # Account deletion cascade
```

### Search

```
GET /api/v1/search?q={query}&limit=20
```

Response:
```json
{
  "results": [MediaSummary],
  "total": number
}
```

### Media

```
GET /api/v1/media/:id
```

### Deck

```
GET /api/v1/deck?limit=20&cursor={cursor}
```

Query params (Phase 1 — basic):
- `limit` (default 20, max 50)
- `cursor` (opaque pagination token)
- `session_id` (optional, for dedup)

Query params (Phase 1.5 — filters):
- `format`, `classification`, `genres`, `language`, `year_from`, `year_to`
- `status` (watched|unwatched), `review_status`
- `sort` (random|popular|newest)
- `friend_id` (Phase 3)

Response:
```json
{
  "items": [DeckItem],
  "cursor": "string | null",
  "session_id": "uuid"
}
```

`DeckItem` = `MediaSummary` + optional `userStatus` if known.

### User Media

```
PUT /api/v1/user-media/:mediaId
```

Body:
```json
{
  "status": "watched" | "unwatched",
  "review_status": "none" | "pending" | "written"
}
```

Idempotent. `UNIQUE(user_id, media_id)`.

```
POST /api/v1/user-media/review-later
Body: { "media_id": "uuid" }
```
Sets `status=watched`, `review_status=pending`.

### Collection

```
GET /api/v1/collection?format=&status=&review_status=&sort=&q=&page=
```

### Review Later

```
GET /api/v1/reviews/pending
```

### Reviews

```
POST   /api/v1/reviews
PATCH  /api/v1/reviews/:id
DELETE /api/v1/reviews/:id
```

Body: `{ "media_id", "body", "is_spoiler?", "visibility?" }`

### Export / Import

```
GET  /api/v1/export
POST /api/v1/import          # Phase 2
```

Export schema v1:
```json
{
  "export_version": 1,
  "exported_at": "ISO8601",
  "media": [{
    "provider": "tmdb",
    "provider_id": "12345",
    "title": "...",
    "format": "movie",
    "classification": "live_action",
    "status": "watched",
    "review_status": "none",
    "watched_at": "ISO8601",
    "review": { "body": "...", "is_spoiler": false } | null
  }]
}
```

### Filter Presets (Phase 1.5)

```
GET    /api/v1/filter-presets
POST   /api/v1/filter-presets
DELETE /api/v1/filter-presets/:id
```

### Undo (Phase 1.5)

```
POST /api/v1/user-media/undo
Body: { "media_id", "previous_status", "previous_review_status" }
```

### Friends (Phase 3)

```
GET  /api/v1/friends
POST /api/v1/friends/request   Body: { "username" | "user_id" }
POST /api/v1/friends/:id/accept
POST /api/v1/friends/:id/block
GET  /api/v1/friends/:id/profile
GET  /api/v1/friends/:id/collection
GET  /api/v1/friends/compare
```

### Recommendations (Phase 3)

```
GET  /api/v1/recommendations
POST /api/v1/recommendations   Body: { "receiver_id", "media_id", "message?" }
```

## Error Format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Human readable"
  }
}
```

## Idempotency

Repeated `PUT /user-media/:id` with same values is a no-op. Setting `watched` multiple times keeps single `watched` record with latest `watched_at` optional policy (keep first or update — document: **keep first watched_at**).
