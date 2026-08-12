# 06 — Filter System

Phase 1.5 feature. MVP uses default broad deck only.

## Filter Categories (Initial)

| Category | Values |
|---|---|
| Type | Movies, Series, Anime, Anime Movies, Documentaries |
| Genre | Action, Adventure, Animation, Comedy, Crime, Drama, Fantasy, Horror, Mystery, Romance, Sci-Fi, Thriller, War, Western |
| Language | ISO 639-1 codes (en, ja, ko, hi, bn, de, fr, es, …) |
| Release Era | Before 1980, 1980s, 1990s, 2000s, 2010s, 2020s |
| Release Year | From / To (advanced) |

## Future Categories

Director, Actor, Writer, Studio, Country, Runtime, Rating, Keywords, Franchise — mapped to TMDB discover params when added.

## Logic Rules

### Within one category → OR

```text
Genre: Horror, Thriller, Mystery
→ Horror OR Thriller OR Mystery
```

TMDB mapping: `with_genres=27|53|9648` (pipe-separated)

### Between categories → AND

```text
Type=Movie AND Genre=Horror AND Language=Japanese
```

Each category adds an additional TMDB/local constraint.

## Type → Internal Mapping

| UI Type | format | classification |
|---|---|---|
| Movies | movie | any (exclude anime-only if needed) |
| Series | series | live_action or animation |
| Anime | series | anime |
| Anime Movies | movie | anime |
| Documentaries | any | documentary |

## Personal Filters (Local SQL)

These cannot be sent to TMDB:

| Filter | Implementation |
|---|---|
| Watched | `user_media.status = 'watched'` |
| Haven't Watched | anti-join watched |
| Review Later | `review_status = 'pending'` |
| Never Seen | no user_media row OR unwatched |

## Friend Filters (Phase 3)

| Mode | Logic |
|---|---|
| Alex has watched | Join Alex's user_media where status=watched |
| Alex has reviewed | Join Alex's reviews |
| Alex watched, I haven't | Alex watched AND NOT me watched |
| Friends have watched | Aggregate accepted friends |

**Privacy:** Server must verify friendship + visibility settings before returning friend data. Never rely on client-side hiding.

## TMDB Genre ID Map

| Genre | TMDB ID |
|---|---|
| Action | 28 |
| Adventure | 12 |
| Animation | 16 |
| Comedy | 35 |
| Crime | 80 |
| Documentary | 99 |
| Drama | 18 |
| Fantasy | 14 |
| Horror | 27 |
| Mystery | 9648 |
| Romance | 10749 |
| Sci-Fi | 878 |
| Thriller | 53 |
| War | 10752 |
| Western | 37 |

## Release Era → Date Range

| Era | year_from | year_to |
|---|---|---|
| Before 1980 | null | 1979 |
| 1980s | 1980 | 1989 |
| 1990s | 1990 | 1999 |
| 2000s | 2000 | 2009 |
| 2010s | 2010 | 2019 |
| 2020s | 2020 | null |

## Filter Presets

Users save named presets as JSONB:

```json
{
  "name": "Japanese Anime",
  "filters": {
    "classification": ["anime"],
    "language": ["ja"],
    "status": ["unwatched"]
  }
}
```

## Default Deck Modes (Future)

Everything, Movies, Series, Anime, Unwatched, Review Later, Friends — one-tap presets.

## API Parameters

```
GET /api/v1/deck?
  format=movie,series
  &classification=anime
  &genres=horror,thriller
  &language=ja
  &year_from=2010
  &year_to=2020
  &status=unwatched
  &sort=random
  &limit=20
```

Multi-value within param = OR. Multiple params = AND.

## Future: Natural Language Filters

Not in scope. Would translate NL → filter DSL server-side.
