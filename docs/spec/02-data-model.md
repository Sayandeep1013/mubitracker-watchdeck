# 02 — Data Model

## Design Principles

- One global `media` record per canonical title (keyed by provider + external_id)
- User-specific state lives in `user_media`, never on `media`
- `format` and `classification` are separate dimensions
- Reviews belong to users, not media globally

## Enums

### format
`movie` | `series`

### classification
`live_action` | `anime` | `documentary` | `animation`

User-facing "Anime Movie" = `format=movie` + `classification=anime`.

### user_media.status
`watched` | `unwatched`

### user_media.review_status
`none` | `pending` | `written`

### friendship.status
`pending` | `accepted` | `blocked`

### privacy_level
`public` | `friends` | `private`

## Core Tables

### profiles
Extends Supabase `auth.users`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | FK → auth.users |
| username | text UNIQUE | Public handle |
| avatar_url | text | Optional |
| profile_visibility | privacy_level | Default: private |
| collection_visibility | privacy_level | Default: friends |
| reviews_visibility | privacy_level | Default: friends |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### media

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Internal ID |
| format | format | movie or series |
| classification | classification | |
| title | text | |
| original_title | text | |
| overview | text | |
| release_date | date | |
| year | int | Denormalized |
| original_language | text | ISO 639-1 |
| poster_path | text | TMDB path, not full URL |
| backdrop_path | text | |
| runtime | int | Minutes, nullable |
| popularity | float | For deck sorting |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### media_external_ids

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| media_id | uuid FK | |
| provider | text | tmdb, imdb, mal |
| external_id | text | |

**UNIQUE(provider, external_id)**

### genres / media_genres
Standard many-to-many. Genres synced from TMDB on ingest.

### user_media

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| media_id | uuid FK | |
| status | text | watched / unwatched |
| review_status | text | none / pending / written |
| watched_at | timestamptz | Set when status → watched |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**UNIQUE(user_id, media_id)**

### reviews

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| media_id | uuid FK | |
| body | text | |
| is_spoiler | boolean | Default false |
| visibility | privacy_level | Default friends |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**UNIQUE(user_id, media_id)**

### friendships

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| requester_id | uuid FK | |
| receiver_id | uuid FK | |
| status | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**UNIQUE(LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id))** via application logic.

### filter_presets (Phase 1.5)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | text | e.g. "Horror Night" |
| filter_config | jsonb | Serialized filter DSL |
| created_at | timestamptz | |

### recommendations (Phase 3)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| sender_id | uuid FK | |
| receiver_id | uuid FK | |
| media_id | uuid FK | |
| message | text | Optional |
| created_at | timestamptz | |

### deck_sessions (optional)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| filter_config | jsonb | |
| shown_media_ids | uuid[] | Session dedup |
| created_at | timestamptz | |

## Indexes

```sql
CREATE INDEX idx_media_external_ids_provider ON media_external_ids(provider, external_id);
CREATE INDEX idx_user_media_user_status ON user_media(user_id, status);
CREATE INDEX idx_user_media_user_review ON user_media(user_id, review_status);
CREATE INDEX idx_media_year ON media(year);
CREATE INDEX idx_media_language ON media(original_language);
CREATE INDEX idx_media_classification ON media(classification);
```

## Anime Classification Heuristic (Ingest)

On TMDB normalize:
- `classification = anime` when genre includes Animation (16) AND `original_language = 'ja'`
- `classification = documentary` when genre includes Documentary (99)
- `classification = animation` when genre includes Animation (16) AND language ≠ ja
- Default: `live_action`

## Series Handling

Track at series/movie level only. No season or episode tables in MVP.

## Duplicate Prevention

Upsert by `(provider, external_id)`. Never create multiple records for the same TMDB ID.
