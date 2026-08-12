# 11 — Deck UX Polish (Filters, Motion, Toasts)

Status: **in progress** (2026-08-12)

## Goals

1. Filters actually return matching titles (especially **Anime**)
2. Deck feels responsive: card exit/enter motion + clear action icons
3. Review Later shows a short toast with the title that was queued
4. Collection / search / review-later / nav work with correct params and icons

## Root causes (verified)

| Bug | Cause |
|---|---|
| No anime in deck | `buildTmdbParams` ignores `classification`. Anime is only applied as a local post-filter on popular live-action pages → empty batch |
| Type chips feel broken | Filter drawer toggles format/classification independently; no selected state; “Series” forced `live_action` |
| Collection “Anime” empty | UI sends `format=anime`; API filters `media.format` (movie\|series only). Need `classification=anime` |
| Stiff deck | Instant index advance, no exit animation; nav/action icons are `?` placeholders |
| Review Later silent | Spec 05 said “no success modals”; product now wants a toast naming the title |

## Filter → TMDB mapping

| Mubitracker filter | TMDB discover params | Local post-filter |
|---|---|---|
| `classification=anime` | `with_genres=16` (+ AND user genres), default `with_original_language=ja` if language unset | Keep `classification === 'anime'` |
| `classification=documentary` | `with_genres=99` (AND user genres) | Keep documentary |
| `classification=animation` | `with_genres=16` | Keep animation (non-ja OK) |
| `language` | `with_original_language` (single) | — |
| `yearFrom`/`yearTo` | movie: `primary_release_date.*`; series: `first_air_date.*` | — |
| `format` | choose movie vs TV discover endpoint | Keep format match |

When `classification` includes `anime` and no `format`, discover **both** movies and series.

## Type chips (exclusive)

- Movies → `format: [movie]`
- Series → `format: [series]`
- Anime → `classification: [anime]` (both formats)
- Anime Movies → `format: [movie], classification: [anime]`
- Documentaries → `classification: [documentary]`

Selected chip shows active styles. Clear resets all.

## Motion (CSS-first, reduced-motion safe)

1. **Card exit** (~220ms): translate + fade + slight rotate by action (left / right / up)
2. **Card enter** (~200ms): fade + slight scale up
3. **Toast**: slide up + fade; auto-dismiss 2.5s
4. **Confirm press**: brief scale on action buttons

Respect `prefers-reduced-motion` (already in `globals.css`).

## Review Later toast

On successful queue (and optimistic UI):

```text
Queued for review · {title}
```

Optional link affordance text: “Open Review Later” (toast click → `/review-later`). Undo toast remains.

## Icons

Use `lucide-react` for nav + deck actions:

| Place | Icon |
|---|---|
| Deck | Layers |
| Search | Search |
| Collection | Library |
| Review Later | Bookmark |
| Friends | Users |
| Profile | User |
| Haven't watched | X |
| Watched | Check |
| Review later | BookmarkPlus |
| Filters | SlidersHorizontal |
| Undo toast | Undo2 |

## Out of scope

- Google OAuth linking
- 50-title human speed test
- Mobile native reanimated polish (web first)

## Acceptance

- [x] Anime filter returns anime titles (ja + animation) within one batch — validated `scripts/validate-anime-filter.mjs`
- [x] Type/genre/language/era chips show selection and refetch deck
- [x] Collection Anime tab lists anime classifications
- [x] Review Later shows toast with title
- [x] Card animates out on classify; next card animates in
- [x] Friends request client path (`POST /api/v1/friends`)
- [x] Deck reads `friend_id` / filter query from URL
- [x] Anime forces `ja` (no empty decks from language conflict)
- [x] TV genre IDs for series discover
- [x] Filter presets persist year ranges
- [x] Empty deck offers Filters + Clear
