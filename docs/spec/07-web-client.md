# 07 — Web Client

## Navigation

| Route | Purpose |
|---|---|
| `/` or `/deck` | Primary deck (default landing) |
| `/search` | Direct title lookup + track |
| `/collection` | User's media history |
| `/review-later` | Pending review queue |
| `/friends` | Friend management (Phase 3) |
| `/profile` | Settings, export, about |
| `/about` | TMDB attribution |

Desktop: sidebar or top nav. Mobile: bottom tab bar. **Deck is always one tap away.**

## Deck Page

### Visual Hierarchy

```text
             POSTER
         TITLE
    YEAR · TYPE · LANGUAGE
          PLOT (truncated)

[ HAVEN'T WATCHED ]  [ WATCHED ]
       [ REVIEW LATER ]
```

- Poster is primary; metadata secondary
- Filter button (⋮) opens drawer (Phase 1.5)
- Keyboard hints visible on desktop

### Keyboard Handler

- Global listener when deck focused
- Visible focus ring on selected action button
- Enter confirms; focus resets to Haven't Watched after action
- No mouse required

### Mobile Web Swipe

- Touch events on card container
- Minimum 80px horizontal / 100px vertical threshold
- Card translates with finger; spring back if below threshold
- Fallback buttons always visible

### Optimistic Updates

1. On action: immediately show next card
2. Fire API in background
3. On failure: revert + toast error + offer undo

### Preloading

Maintain queue of 3+ items client-side. Fetch next batch when index >= 15.

## Search Page

Separate from deck. Results show title, year, type. Actions: Watched / Haven't Watched / Review Later without entering deck.

## Collection Page

- Tabs: All, Movies, Series, Anime
- Filters: status, review_status
- Views: grid (default), compact list
- Sort: recently watched, alphabetical, release year
- Search within collection

## Review Later Page

List of items with `review_status=pending`. Tap to open review form (Phase 2 for write UI; MVP shows queue only with link to add note in Phase 2).

## Profile / Settings

- Username, avatar
- Watched / review counts
- Export JSON button
- Import (Phase 2)
- Privacy settings (Phase 3)
- Delete account
- About / TMDB credits with logo

## Accessibility

- All gestures have button equivalents
- ARIA labels on action buttons
- Visible focus states
- `prefers-reduced-motion`: disable card animations
- Minimum 44px touch targets
- Screen reader announces title + available actions

## Responsive Breakpoints

- Mobile: 320px+ — poster-first, bottom nav
- Tablet: side nav optional
- Desktop: larger poster, keyboard hints, sidebar nav

## Design Tokens

Shared via `@watchdeck/shared` or CSS variables:
- Dark theme default (media app convention)
- High contrast action buttons
- Focus color distinct from selection

## State Management

- React Query (TanStack Query) for server state
- Local state for deck queue, undo stack, swipe animation
- Supabase client for auth session

## Analytics Events (Anonymous)

- `deck_started`, `media_classified`, `undo_used`, `filter_used`, `search_used`
- No PII in event payloads
