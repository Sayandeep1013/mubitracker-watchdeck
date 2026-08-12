# 00 — Product Principles

## Identity

Watchdeck is a **frictionless personal media memory system**. It is not an IMDb clone, Letterboxd clone, MyAnimeList clone, social network, or recommendation engine.

## Core Loop

```text
ONE TITLE → ONE DECISION → NEXT TITLE
```

Supported decisions:
- Haven't Watched
- Watched
- Watched + Review Later (separate `review_status`, not a third watch status)

## Priority Stack

```text
Speed > Metadata > Social > Reviews > Statistics
```

The primary loop must never require: detail pages, date selection, ratings, reviews, confirmation dialogs, or manual navigation back to the deck.

## Supported Media

- Movies, TV series, anime series, anime movies, documentaries
- **Series-level tracking only** in MVP (no episode/season tracking)
- Additional media types may be added later via `format` + `classification`

## Clients

- Web/Desktop (keyboard-first)
- Mobile Web (touch/swipe)
- Native mobile (Phase 2, gesture-first)

All clients share one backend and one database. State syncs across devices.

## Non-Goals (Initial)

- AI recommendations
- Mood/emotion filters
- Social activity feed
- Episode-level tracking
- Streaming availability (Watchmode — future)
- Building a comprehensive media database UI

## Success Criteria (Version 1)

A user can:
1. Create account
2. Open deck and classify 50 titles rapidly
3. View collection with correct statuses
4. Mark items Review Later
5. Export JSON collection

**Primary metric:** average time between classifications — target **2–4 seconds**.

If users think "this is a movie database," the design failed.
If users think "I can go through these insanely fast," it succeeded.

## Product Rules

1. **Friends enhance discovery** — "What has my friend watched that I haven't?" — not a feed.
2. **Filters are a query language** for personal catalogues (Phase 1.5+).
3. **User owns their data** — export always available; import in Phase 2.
