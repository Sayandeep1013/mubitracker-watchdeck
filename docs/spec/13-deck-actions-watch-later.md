# 13 — Deck Actions, Watch Later & Search Filters

Status: **approved** (2026-08-12)

## Goals

1. Type chips are **multi-select** (Anime + Anime Movies, Movies + Series, …)
2. **Sticky action**: last confirmed action stays selected for the next card
3. New **Watch Later** queue (want to watch someday) — separate from Review Later
4. Keyboard: **↑ Watch Later**, **↓ Review Later**, ← unwatched, → watched, Enter confirms
5. Review Later items reliably appear under Reviews
6. Search supports the same core filters (type / genre / language)

## Watch status model

Extend `user_media.status`:

| Status | Meaning | Default deck |
|---|---|---|
| `unwatched` | Classified as haven't watched | Excluded once set… actually unwatched means tracked as no — exclude from deck |
| `watched` | Seen it | Excluded |
| `watch_later` | Want to watch later | Excluded until removed/watched |

`review_status` unchanged: `none | pending | written`  
**Review Later** = `status=watched` + `review_status=pending`  
**Watch Later** = `status=watch_later` + `review_status=none`

## Keyboard / gestures

| Input | Action |
|---|---|
| ← / swipe left | Select Haven't Watched |
| → / swipe right | Select Watched |
| ↑ / swipe up | **Watch Later** (immediate or select+confirm — immediate like current review-later up) |
| ↓ | **Review Later** (immediate) |
| Enter | Confirm current selection |
| Z | Undo |

Sticky: after Confirm (or immediate ↑/↓/swipe), the **selectedAction** for the next card remains the last non-immediate selection when using ←/→/Enter. For ↑/↓ immediate actions, keep previous ←/→ selection sticky (don't switch sticky to review/watch later unless those were selected via buttons then Enter).

Simpler rule: sticky applies to the three buttons' selection state; immediate ↑/↓ don't change sticky selection.

## Multi-select types

Type chips toggle independently (additive). Applying Anime + Anime Movies → `classification=anime` and `format=movie,series` as implied by chips, or union of each chip's format/classification sets.

## Search filters

Search page: optional drawer/chips for format, classification, language applied client-side on results (and/or query params to API).

## Nav

Add **Watch Later** page `/watch-later` (bookmark-clock). Reviews stays Review Later queue.
