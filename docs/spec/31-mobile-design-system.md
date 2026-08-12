# 31 — Mobile Design System

Status: **draft** (2026-08-12)

Target: `apps/mobile` — **Expo SDK 54.0.36 / React Native 0.81.5 / React 19 / Reanimated 4.1.7**.
This is a React Native app. Everything below is expressed in `StyleSheet`, `Pressable`,
`react-native-reanimated` v4 and `react-native-safe-area-context` terms.
**Material Design 3 is the design *reference*** (spacing rhythm, 48dp touch targets, type scale,
emphasized-easing motion) — not an API. Do not add a Material component library.

Terminology matches spec `11-deck-ux-polish.md`: *card exit*, *card enter*, *toast*, *sticky action*,
*Haven't / Watched / Watch Later / Review Later*.

---

## 1. Design tokens

Today every screen hardcodes hex values — `apps/mobile/app/(tabs)/deck.tsx:242`,
`apps/mobile/app/(tabs)/search.tsx:59`, `apps/mobile/app/(tabs)/collection.tsx:34`,
`apps/mobile/app/login.tsx:91`, and `apps/mobile/app/(tabs)/_layout.tsx:16-21` each repeat
`#09090b` / `#18181b` / `#27272a`. Login uses `#dc2626` while the web accent is `#ef4444`.

Create **`apps/mobile/lib/theme.ts`** as the single source of truth. After this spec lands,
**no screen file may contain a hex literal** — all colour comes from `theme.color.*`.

| Token | Value | Role (M3 equivalent) |
|---|---|---|
| `color.bg` | `#09090b` | surface / background |
| `color.surface` | `#18181b` | surface-container |
| `color.surfaceHigh` | `#27272a` | surface-container-high, poster placeholder |
| `color.border` | `#27272a` | outline-variant |
| `color.primary` | `#ef4444` | primary (accent, confirm, active tab) |
| `color.onPrimary` | `#ffffff` | on-primary |
| `color.text` | `#fafafa` | on-surface |
| `color.textMuted` | `#71717a` | on-surface-variant |
| `color.success` | `#22c55e` | Watched cue |
| `color.danger` | `#ef4444` | Haven't cue + error |
| `color.warning` | `#f59e0b` | Watch Later cue |
| `color.review` | `#a855f7` | Review Later cue |

Semantic action colours (used by cue overlays, buttons and toasts alike):

| Action | Colour token | Icon (`@expo/vector-icons` Feather) |
|---|---|---|
| Watched | `color.success` | `check` |
| Haven't watched | `color.danger` | `x` |
| Watch Later | `color.warning` | `clock` |
| Review Later | `color.review` | `bookmark` |

**Spacing** — `space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }`. Only these values may
appear in `padding` / `margin` / `gap`. **Radii** — `radius = { sm: 8, md: 12, lg: 16, pill: 999 }`.

**Type scale** (M3-derived, mapped to RN):

| Token | fontSize | lineHeight | fontWeight | Use |
|---|---|---|---|---|
| `display` | 32 | 40 | `'700'` | Login wordmark |
| `headline` | 24 | 32 | `'700'` | Screen title, profile username |
| `title` | 20 | 28 | `'700'` | Deck card title |
| `body` | 16 | 24 | `'400'` | Inputs, review body, list titles |
| `label` | 14 | 20 | `'600'` | Buttons, action rows |
| `caption` | 12 | 16 | `'400'` | Meta line, status chips, hints |

```ts
// apps/mobile/lib/theme.ts
export const theme = { color, space, radius, type, motion, elevation } as const;
export type Theme = typeof theme;
```

---

## 2. Touch targets & accessibility

Mobile currently has **zero** `accessibilityLabel` / `accessibilityRole` and exactly one `hitSlop`
(`apps/mobile/app/(tabs)/deck.tsx:234`).

- **Minimum touch target 48×48dp.** Any `Pressable` whose visual box is smaller gets
  `hitSlop` to reach 48 (e.g. a 24dp icon → `hitSlop={12}`).
- Every `Pressable` declares `accessibilityRole="button"` and an `accessibilityLabel` that names the
  object, not the widget: `"Mark The Godfather as watched"`, not `"Watched"`.
- `TextInput` gets `accessibilityLabel`; error text gets `accessibilityLiveRegion="polite"`.
- Lists set `accessibilityRole="list"` on the container via `FlatList` defaults; rows are buttons.
- Disabled buttons set `accessibilityState={{ disabled: true }}` and drop to `opacity 0.5`.
- **Rule: no action may be gesture-only.** Every swipe must have an equivalent visible control.
  The deck is gesture-only today (`apps/mobile/app/(tabs)/deck.tsx:148-163` is the only path to
  classify) — this is an accessibility failure and a parity gap with web
  (`apps/web/src/components/DeckCard.tsx:124-184`).

**Deck fallback button row** (required, mirrors web):
two rows of two 48dp-tall buttons — `Haven't` / `Watched`, then `Watch Later` / `Review Later` —
each `flex: 1`, `radius.md`, 1px `color.border`, tinted to its action colour when it is the
**sticky action**. Below them a full-width `Confirm` button in `color.primary`.

---

## 3. Safe areas

Wrap the app once in `<SafeAreaProvider>` inside `apps/mobile/app/_layout.tsx:54`, then:

- Tab screens use `useSafeAreaInsets()` and apply `paddingTop: insets.top + space.lg`.
- **`apps/mobile/app/review/[id].tsx:18` renders under the status bar** — it is a `presentation:
  'modal'` route (`apps/mobile/app/_layout.tsx:60`) with a bare `View`. Replace with
  `<SafeAreaView edges={['top','bottom']}>` and wrap in `KeyboardAvoidingView`.
- **`apps/mobile/app/login.tsx:51` needs `KeyboardAvoidingView`** —
  `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`, inside a
  `ScrollView keyboardShouldPersistTaps="handled"` so the submit button stays reachable.
- Any bottom-anchored element (toast, deck button row) adds `insets.bottom` above the tab bar.

---

## 4. Motion — the swipe deck

Today the card only translates and rotates (`apps/mobile/app/(tabs)/deck.tsx:165-171`), has **no
opacity falloff, no cue overlays, and no exit animation** — on commit it springs back to centre
(`deck.tsx:161-162`) while the index advances, so the card visibly snaps rather than leaves.

**Constants** (`theme.motion`):

| Name | Value |
|---|---|
| `SWIPE_THRESHOLD_X` | 120 px |
| `SWIPE_THRESHOLD_Y` | 100 px |
| `CUE_THRESHOLD` | 40 px (horizontal), 60 px (vertical) |
| `ROTATION_FACTOR` | 0.05 deg/px (matches `DeckCard.tsx:36`) |
| `EXIT_DURATION` | 220 ms |
| `ENTER_DURATION` | 200 ms |
| `EXIT_EASING` | `Easing.bezier(0.05, 0.7, 0.1, 1)` (M3 emphasized-decelerate) |
| `SPRING` | `{ damping: 18, stiffness: 220, mass: 0.6 }` |

**4.1 Drag-time transform** — opacity falls off exactly like web (`DeckCard.tsx:37`):

```ts
const style = useAnimatedStyle(() => ({
  transform: [
    { translateX: tx.value },
    { translateY: ty.value },
    { rotate: `${tx.value * 0.05}deg` },
  ],
  opacity: 1 - Math.min(Math.abs(tx.value) / 300, 0.3),
}));
```

**4.2 Cue overlays** — four absolutely-positioned overlays on the poster, mirroring
`apps/web/src/components/DeckCard.tsx:84-102`. Each fades in over its drag range; icon 64dp,
tint at 20% alpha over the poster.

| Direction | Action | Tint | Icon | Opacity ramp |
|---|---|---|---|---|
| → right | Watched | `success` @ 0.2 | `check` | `interpolate(tx, [40, 120], [0, 1], CLAMP)` |
| ← left | Haven't | `danger` @ 0.2 | `x` | `interpolate(-tx, [40, 120], [0, 1], CLAMP)` |
| ↑ up | Watch Later | `warning` @ 0.2 | `clock` | `interpolate(-ty, [60, 100], [0, 1], CLAMP)` |
| ↓ down | Review Later | `review` @ 0.2 | `bookmark` | `interpolate(ty, [60, 100], [0, 1], CLAMP)` |

**4.3 Commit exit** — on threshold crossing, fling the card off-screen, *then* advance the index
from the animation callback so the next card never appears mid-flight.

```ts
const fly = (dir: 'left'|'right'|'up'|'down', act: () => void) => {
  const { width, height } = Dimensions.get('window');
  const cfg = { duration: 220, easing: Easing.bezier(0.05, 0.7, 0.1, 1) };
  if (dir === 'left' || dir === 'right')
    tx.value = withTiming((dir === 'right' ? 1 : -1) * width * 1.25, cfg);
  else ty.value = withTiming((dir === 'down' ? 1 : -1) * height * 0.9, cfg);
  opacity.value = withTiming(0, { duration: 180 }, (done) => { if (done) runOnJS(act)(); });
};
```

Below threshold: `tx.value = withSpring(0, SPRING)` (and `ty`) — the current behaviour, retained.

**4.4 Enter** — the incoming card mounts with `opacity 0`, `scale 0.94`, `translateY 12`, animating to
`1 / 1 / 0` over `ENTER_DURATION` with the same easing. Reset `tx`/`ty`/`opacity` to their rest
values *before* the new card renders.

**4.5 Haptics** (`expo-haptics`, already a dependency):

| Event | Call |
|---|---|
| Cue overlay first crosses threshold | `selectionAsync()` (once per drag, latched) |
| Watched / Haven't commit | `impactAsync(Medium)` |
| Watch Later / Review Later commit | `impactAsync(Light)` |
| Undo | `notificationAsync(Success)` |
| Action failed / queued offline | `notificationAsync(Warning)` |

---

## 5. Feedback & state

**Toast** — mobile has none; web has `apps/web/src/components/ActionToast.tsx`. Add
`apps/mobile/components/Toast.tsx` + a `ToastProvider` mounted in `apps/mobile/app/_layout.tsx`.

- Absolutely positioned, `bottom: insets.bottom + 88`, `width: min(92%, 384)`, centred.
- `surface` background, 1px border tinted by tone: `neutral | success | warning | review | error`.
- Enter: `translateY 24 → 0` + `opacity 0 → 1`, 180 ms. Auto-dismiss **2500 ms**; exit reverses.
- Optional trailing **Undo** `Pressable` (48dp target, `accessibilityLabel="Undo last action"`),
  which cancels the auto-dismiss timer while pressed.
- `accessibilityLiveRegion="polite"`. Max one toast; a new toast replaces the current one.
- Copy matches spec `11`: `Queued for review · {title}`, `Saved to Watch Later · {title}`.

**Every screen must implement four states**: `loading` (skeleton or centred spinner),
`empty` (icon + one-line explanation + primary CTA), `error` (message + **Retry** button), `ready`.
Collection (`apps/mobile/app/(tabs)/collection.tsx:9-11`) and Review Later
(`apps/mobile/app/(tabs)/review-later.tsx:10-12`) have no `.catch()` at all — a rejected fetch leaves
a permanently blank screen. Every `apiClient` call gets `.catch()` → error state → toast.

---

## 6. Per-screen layout specs

| Screen | Layout | Required states | Defects to resolve |
|---|---|---|---|
| **Deck** `app/(tabs)/deck.tsx` | Safe-area column: hint row → undo pill → animated card (poster 220×330, `radius.md`, title `type.title`, meta `caption`) → IMDb link → **fallback button row** (§2) | loading / empty / error already exist — keep | Gesture-only (no buttons); ↑ mapped to Review Later (`deck.tsx:158`); no ↓; no Watch Later anywhere; no exit animation; hint string at `deck.tsx:209` is wrong; undo desync for review-later (`deck.tsx:83-90`) |
| **Search** `app/(tabs)/search.tsx` | Input + Go → `FlatList` of 72dp rows: 48×72 poster, title, **`{year} · {displayType}`** meta line, 4 action buttons | loading, empty ("No results for …"), error, idle ("Search for a film or series") | Poster only renders when `posterPath` exists (`search.tsx:37-39`) — needs a `surfaceHigh` placeholder; no year/type; actions are fire-and-forget with no `await`, no state, no `catch` (`search.tsx:43-48`) — must await, show a toast, and mark the row |
| **Collection** `app/(tabs)/collection.tsx` | 2-column grid, poster `aspectRatio 2/3`, title `numberOfLines={1}`, status chip | all four | No loading/empty/error; no `.catch()` (`collection.tsx:10`); status chip renders lowercase — capitalize; stale after swipes (needs `useFocusEffect`) |
| **Review Later** `app/(tabs)/review-later.tsx` | List of rows → `/review/[id]` | all four | No loading/error; no `.catch()` (`review-later.tsx:11`); empty copy must name **↓**, not ↑ |
| **Profile** `app/(tabs)/profile.tsx` | Username `headline` → **stats card** (watched / haven't / watch later / reviews counts) → Export / Sign Out | all four | No stats at all (`profile.tsx:26-34`); Export is a dead-end `Alert` (`profile.tsx:15-18`) — must write a file and open the share sheet; buttons use `surfaceHigh`, primary action should use `color.primary` |
| **Login** `app/login.tsx` | `KeyboardAvoidingView` → `ScrollView` → wordmark → 2 inputs → submit → mode switch | idle / submitting / error | No `KeyboardAvoidingView` (`login.tsx:51`); accent is `#dc2626` (`login.tsx:95`) — must be `color.primary`; inputs need `accessibilityLabel` |
| **Review modal** `app/review/[id].tsx` | `SafeAreaView` + `KeyboardAvoidingView` → **title header** → body `TextInput` → Save | loading title / saving / error | Renders under the status bar (`review/[id].tsx:18`); **never shows which title is being reviewed** (audit 2.13) — fetch and render it; `createReview` has no `catch` (`review/[id].tsx:13`) — errors must surface as an error toast, and Save must be disabled while in flight |

---

## 7. Gesture map

Mobile must match web and spec `13-deck-actions-watch-later.md`:

| Gesture | Action | Web today | Mobile today |
|---|---|---|---|
| ← swipe left | Haven't watched | ✅ | ✅ (`deck.tsx:156`) |
| → swipe right | Watched | ✅ | ✅ (`deck.tsx:154`) |
| ↑ swipe up | **Watch Later** | ✅ | ❌ mapped to **Review Later** (`deck.tsx:158-160`) |
| ↓ swipe down | **Review Later** | ✅ | ❌ not implemented |

The ↑ remap and the new ↓ handler are **required**; the on-screen hint (`deck.tsx:209`) becomes
`← Haven't · Watched → · ↑ Watch Later · ↓ Review Later`. Watch Later calls `apiClient.watchLater`.
Undo must record `lastAction` for **all four** directions, fixing the desync at `deck.tsx:83-90`.

---

## Acceptance criteria

- [ ] `apps/mobile/lib/theme.ts` exists and exports `color`, `space`, `radius`, `type`, `motion`.
- [ ] `grep -rn "#[0-9a-fA-F]\{6\}" apps/mobile/app` returns **zero** matches.
- [ ] Every `Pressable` in `apps/mobile/app` has `accessibilityRole` and a non-empty `accessibilityLabel`.
- [ ] Every interactive control measures ≥48×48dp including `hitSlop`.
- [ ] Deck renders four action buttons + Confirm; every swipe action is reachable without gestures.
- [ ] `SafeAreaProvider` is mounted in `app/_layout.tsx`; `review/[id].tsx` no longer paints under the status bar.
- [ ] `login.tsx` and `review/[id].tsx` use `KeyboardAvoidingView`; the submit button stays visible with the keyboard open.
- [ ] Dragging >40px horizontally or >60px vertically shows the correct tinted cue overlay and icon for all four directions.
- [ ] Card opacity falls to 0.7 at 300px horizontal drag.
- [ ] Committing a swipe animates the card fully off-screen in ~220ms; the next card fades+scales in over ~200ms.
- [ ] Index advances only from the exit-animation completion callback (no mid-flight card swap).
- [ ] Haptics fire per the §4.5 table, once per drag for the cue latch.
- [ ] A toast component exists, auto-dismisses at 2500ms, and offers Undo after a deck classification.
- [ ] Deck, Search, Collection, Review Later, Profile, Login and Review each render distinct loading, empty and error states.
- [ ] Every `apiClient` call in `apps/mobile/app` has a `.catch()`.
- [ ] Search rows show a poster placeholder when `posterPath` is null and a `{year} · {displayType}` line.
- [ ] Search actions `await`, update the row, and emit a toast.
- [ ] Profile shows watched / haven't / watch later / review counts.
- [ ] Review modal displays the title being reviewed.
- [ ] Review Later empty state names **↓**.
- [ ] ↑ writes Watch Later and ↓ writes Review Later; undo restores the correct item for all four directions.
