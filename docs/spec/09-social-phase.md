# 09 — Social Phase (Phase 3)

Social features enhance discovery without turning Watchdeck into a social network. **No activity feed in v1 social.**

## Core Social Question

> "What has my friend watched that I haven't?"

Not: "What is my friend posting today?"

## Friend Model

```text
friendships(requester_id, receiver_id, status)
status: pending | accepted | blocked
```

- One row per pair; prevent duplicates in application logic
- Block supersedes pending/accepted

## Discovery Methods

1. Search username
2. Share profile link: `watchdeck.app/u/{username}`

## Friend Profile

Visible based on privacy settings:
- Avatar, username
- Watched count, review count
- Sections: Movies, Series, Anime, Reviews

## Privacy Settings (per user)

| Setting | Options | Default |
|---|---|---|
| profile_visibility | public / friends / private | private |
| collection_visibility | public / friends / private | friends |
| reviews_visibility | public / friends / private | friends |

**Server-side enforcement:** RLS policies + API middleware. Private data never returned to unauthorized users.

## Friend-Based Deck Filters

| Mode | Deck contents |
|---|---|
| Alex has watched | Titles Alex marked watched |
| Alex has reviewed | Titles Alex reviewed |
| Alex watched, I haven't | Alex watched ∩ my unwatched |
| Friends have watched | Union of friends' watched |

Requires accepted friendship AND collection_visibility permits access.

## Collection Comparison

Given user A and friend B:

```text
Both watched:          A ∩ B (watched)
You watched, B hasn't: A watched - B watched
B watched, you haven't: B watched - A watched
Neither watched:       optional, large set
```

API: `GET /api/v1/friends/:id/compare`

Response:
```json
{
  "both_watched": 73,
  "you_only": 41,
  "friend_only": 58,
  "both_watched_items": [MediaSummary],
  "friend_only_items": [MediaSummary]
}
```

Comparison can spawn a deck: "Track friend's unwatched recommendations."

## Recommendations

Simple object, not messaging:

```text
recommendations(sender_id, receiver_id, media_id, message?)
```

Recipient sees in Recommendations tab. Can one-tap add to deck or mark watched.

## Review Privacy

Reviews have visibility: private / friends / public. Default: friends.

## Explicit Non-Goals (Phase 3)

- Activity feed
- Comments on reviews
- Direct messaging
- Followers (non-mutual)

## Future (Phase 4+)

- Aggregate "Friends have watched" across multiple friends
- "From whom" filter (titles recommended by specific friend)
- Taste comparison charts
