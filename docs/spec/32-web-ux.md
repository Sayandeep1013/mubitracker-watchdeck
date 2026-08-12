# 32 — Web UX

Status: **draft** (2026-08-12)

Closes the web-side product and correctness gaps found in [`../AUDIT-2026-08-12.md`](../AUDIT-2026-08-12.md)
(§1.5, §1.6, §2.10–2.13, §3). Extends [`11-deck-ux-polish.md`](11-deck-ux-polish.md); nothing here
regresses the behaviour listed in audit §5.

---

## 1. Scope

| In | Out |
|---|---|
| Deck feedback contract (canonical for both clients) | Deck engine / pool exhaustion (spec `05` follow-up) |
| Collection pagination | Personalisation, ranking |
| Reviews list + edit screen | Deck performance work (filtered-load latency has its own fix) |
| Review editor context + error handling | Mobile implementation (mirrors this doc; tracked in `08`) |
| Mobile-web navigation | Analytics |
| Privacy settings control | Friends behaviour (see `40-friends-v2.md`) |
| Loading / error states, P2 fix list | |

---

## 2. Deck feedback — canonical contract

The web deck is the **reference implementation**. `apps/web/src/components/DeckCard.tsx` and
`apps/web/src/components/DeckView.tsx` already ship drag overlays, directional exit animations and
toasts; this section freezes them as the contract mobile must mirror, and fixes one inconsistency.

### 2.1 Gesture / key map (canonical)

| Input | Gesture | Action | Exit direction | Overlay |
|---|---|---|---|---|
| `←` | swipe left (>80px) | Select **Haven't watched** | left | red `IconX` |
| `→` | swipe right (>80px) | Select **Watched** | right | green `IconCheck` |
| `↑` | swipe up (< −100px) | **Watch Later** (immediate) | up | amber `IconClock` |
| `↓` | swipe down (>100px) | **Review Later** (immediate) | **down** | purple `IconBookmarkPlus` |
| `Enter` | tap **Confirm** | Commit current selection | per selection | — |
| `Z` | toast **Undo** | Undo last action | re-enter | — |
| `F` | tap **Filters** | Toggle filter drawer | — | — |

Locked semantics: `←`/`→` only **select** (sticky across cards); `↑`/`↓` **act immediately**.
Arrow keys are ignored while focus is in an `input`/`textarea` (already handled,
`DeckView.tsx` keydown handler).

**Fix required:** `performAction` maps both `watch_later` and `review_later` to exit direction
`'up'`. Add an `animate-deck-exit-down` keyframe in `apps/web/src/app/globals.css` and map
`review_later → 'down'` so motion matches the documented gesture.

### 2.2 Timings and motion

Exit 220ms (`EXIT_MS`), enter 200ms, toast auto-dismiss 2500ms, undo toast 4000ms. Drag transform is
`translate(x,y) rotate(x*0.05deg)` with opacity floor `0.7`. Overlays appear at |dragX| > 40 or
|dragY| > 60 — i.e. **before** the commit threshold, so the user always previews the outcome.
All motion respects `prefers-reduced-motion` (per spec `11`): transforms collapse to opacity fades.

### 2.3 Toasts

Every write produces exactly one toast: `Queued for review · {title}` (link *Open Reviews*),
`Saved to Watch Later · {title}` (link *Open Watch Later*), `Undone`, and on failure
`Could not save action — try again`. Watched/Haven't stay silent — the card exit *is* the feedback.

---

## 3. Collection pagination

`apps/web/src/app/collection/page.tsx` holds `page` state but nothing increments it, and `load()`
keeps only `data.items` — `total`, `page`, `pageSize` from
`apps/web/src/app/api/v1/collection/route.ts` are discarded. Result: 24 of 101 items reachable.

Spec:

- Store `total` and `pageSize`; derive `pageCount = Math.ceil(total / pageSize)`.
- Render a pager below the grid/list **whenever `pageCount > 1`**:
  `[‹ Prev] Page {page} of {pageCount} · {total} titles [Next ›]`, ends disabled at bounds.
- Every filter mutation (tab, status, sort, `q`, view) resets `page = 1` — already done for tabs and
  status; add it to `sort`.
- Page changes scroll the list container to top and keep focus on the pressed pager button.
- Empty state distinguishes *no items at all* from *no items on this page*; the latter auto-corrects
  to `page = 1`.

Page size stays server-capped at 24 default / 100 max. Infinite scroll is explicitly **not** chosen —
a pager is testable and cheap.

---

## 4. Reviews list screen

`GET /api/v1/reviews` (returns `{ reviews: [{ ...review, media }] }`) has no caller, and
`PATCH`/`DELETE /api/v1/reviews/:id` are unreachable from the UI. Reviews are write-only.

New route `apps/web/src/app/reviews/page.tsx` with two tabs:

| Tab | Source | Row content | Primary action |
|---|---|---|---|
| **Written** | `GET /api/v1/reviews` | poster, title, year, updated date, spoiler badge, 2-line body clamp | Edit → `/reviews/{reviewId}` |
| **Pending** | `GET /api/v1/reviews/pending` | poster, title, year, type | Write → `/review-later/{mediaId}` |

Nav item **Reviews** points at `/reviews`; `/review-later` remains valid and is surfaced as the
Pending tab. Row overflow menu offers **Delete** with a confirm, calling `DELETE /api/v1/reviews/:id`
and removing the row optimistically (restore + error toast on failure). Spoiler bodies render blurred
with a *Show spoiler* toggle.

`/reviews/[id]` reuses one `ReviewEditor` component in `edit` mode: prefilled `body`, `is_spoiler`,
`visibility`; saves via `PATCH`.

---

## 5. Review editor — context and errors

`apps/web/src/app/review-later/[id]/page.tsx` renders a bare textarea: the user cannot see which
title they are reviewing, and `save()` uses `try/finally` with **no `catch`**, so a 400 (observed:
`{"validation":"uuid","path":["media_id"]}`) leaves the UI silent and unchanged.

Spec:

1. **Header** — fetch the media record on mount and render poster (w154), title, year, type above the
   textarea. While fetching, show a skeleton header; on failure show *Title unavailable* but keep the
   editor usable.
2. **Validation** — disable Save when `body` is empty or the route `id` is not a UUID; show
   *This title can't be reviewed — open it from Review Later* instead of firing a doomed request.
3. **Error handling** — wrap the call in `try/catch/finally`; on error keep the draft in state, keep
   the user on the page, and show an inline error banner with the server message plus a **Retry**
   button. Only navigate to `/reviews` on success.
4. **Draft safety** — persist the draft to `sessionStorage` keyed by media id; restore on remount;
   clear on successful save. Warn on unload with unsaved text.
5. Visibility selector (`public | friends | private`, default `friends`) exposed as a small select —
   the API already accepts it.

---

## 6. Mobile-web navigation

`apps/web/src/components/Nav.tsx` defines 7 links but the `md:hidden` bar renders
`links.slice(0, 5)`, and `NotificationBell` lives only in the desktop rail. Friends, Profile and
notifications are unreachable below the `md` breakpoint.

Spec — **5 items + More**, no 7-item cramming:

| Slot | Item |
|---|---|
| 1–4 | Deck, Search, Collection, Reviews |
| 5 | **More** (`IconMenu`) — opens a bottom sheet |
| Sheet | Watch Later, Friends, Profile, Notifications, About |

- The More icon carries the unread badge (same `9+` cap) whenever the bell has unread items, so the
  badge is never hidden.
- More is `active` when the current path belongs to any sheet destination.
- Sheet closes on selection, backdrop tap, `Esc`; it traps focus and is labelled `aria-label="More"`.
- Bar height accounts for `env(safe-area-inset-bottom)`.

---

## 7. Loading and error states

| Surface | Loading | Error |
|---|---|---|
| Deck (first batch, up to ~9s filtered) | Full card **skeleton** (poster block, title bars, four action buttons) — not a blank screen | Centred *Couldn't load the deck* + **Retry** (re-runs `fetchBatch({cursor:null,sessionId:null})`) + **Edit filters** |
| Deck (prefetch) | Silent; no visual change | Silent; retried on next advance |
| Collection | Grid of 8 poster skeletons | Message + Retry |
| Reviews / Review Later | 3 row skeletons | Message + Retry |
| Profile | Field skeletons | Message + Retry |
| Review save | Button spinner + disabled | §5.3 banner |

The deck currently surfaces load failures only as a transient toast and offers no retry (mobile does);
the retry affordance is mandatory. Skeletons must not shift layout when real content arrives.

---

## 8. Privacy settings UI

No control exists for `profile_visibility`, so every account keeps the schema default `'private'`
(`supabase/migrations/20250812000000_initial_schema.sql:17`) and prefix friend search matches nobody.
`PATCH /api/v1/profile` and `client.updateProfile()` already accept all three fields.

On `/profile`, add a **Privacy** card with three selects:

| Field | Options | Default | Helper text |
|---|---|---|---|
| `profile_visibility` | Public / Private | Private | "Public lets people find you by typing part of your username. Anyone who knows your exact handle can always send a request." |
| `collection_visibility` | Public / Friends / Private | Friends | "Who can see what you've watched." |
| `reviews_visibility` | Public / Friends / Private | Friends | "Who can read your reviews." |

Changes save immediately (optimistic, revert + toast on failure). The card also shows
`@{username}` with a **Copy handle** button. Full behaviour and defaults policy: `40-friends-v2.md` §2.

---

## 9. Fix list (audit §3, web-side)

| # | Defect | Location | Fix |
|---|---|---|---|
| 9.1 | Invalid class `text-neutral-00` | `apps/web/src/app/profile/page.tsx` (Watched stat label) | `text-neutral-500`, matching sibling stat labels |
| 9.2 | Literal `text-neutral-????00` | `apps/web/src/app/profile/page.tsx` (About link) | `text-neutral-300` |
| 9.3 | TMDB logo blocked (`ERR_BLOCKED_BY_ORB`) | `apps/web/src/app/about/page.tsx` — remote `themoviedb.org` SVG | **Self-host**: commit the TMDB primary logo to `apps/web/public/tmdb.svg` and serve locally; keep the attribution sentence and outbound link |
| 9.4 | Empty state names the wrong key ("press ↑") | `apps/web/src/app/review-later/page.tsx` | "press ↓ or choose Review Later" — matches §2.1 |
| 9.5 | Import always reports "Invalid JSON" | `apps/web/src/app/profile/page.tsx` `importData()` | Separate parse from request: `JSON.parse` failure → *That's not valid JSON*; request failure → server message; success → `Imported {n}, skipped {m}`. Replace `alert()` with toasts |
| 9.6 | Lowercase status chips beside "All" | `apps/web/src/app/collection/page.tsx` status filter row | Render labels `All / Watched / Unwatched`, keep the lowercase values as the query params |

---

## 10. Acceptance criteria

- [ ] `↓` and swipe-down animate the card **downward** and queue Review Later; `↑` animates upward
- [ ] All seven inputs in §2.1 work on `/deck` and match the on-card hint row
- [ ] `/collection` shows a pager when `total > pageSize`; every one of 101 items is reachable by paging
- [ ] Changing tab, status, sort, search or view resets to page 1
- [ ] `/reviews` lists saved reviews with poster + title, and Written/Pending tabs both populate
- [ ] Editing a review persists via `PATCH /api/v1/reviews/:id`; deleting removes it from the list
- [ ] Review editor shows poster + title + year of the reviewed title
- [ ] A `400` from `POST /api/v1/reviews` shows an inline error, keeps the draft, and does not navigate
- [ ] Below `md`, Friends, Profile and Notifications are reachable within two taps; unread badge visible
- [ ] `/profile` exposes profile / collection / reviews visibility; setting profile to Public makes the
      account appear in another user's prefix search
- [ ] Deck shows a skeleton (never a blank screen) during a filtered load and a Retry on failure
- [ ] No `text-neutral-00` or `text-neutral-????00` strings remain in `apps/web/src`
- [ ] `/about` renders the TMDB logo from a local asset with no network error in the console
- [ ] Review Later empty state names `↓`
- [ ] Pasting malformed JSON and a valid-but-rejected payload produce different import messages
- [ ] Collection status chips read `All / Watched / Unwatched`
