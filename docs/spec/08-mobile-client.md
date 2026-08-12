# 08 — Mobile Client (Phase 2)

## Stack

- **Expo** (SDK 52+)
- **React Native Gesture Handler** + **Reanimated** for swipe
- **Expo Router** for navigation
- **@mubitracker/shared** for types, schemas, API client

Not a WebView wrapper — native gesture handling required.

## Shared Code

From `@mubitracker/shared`:
- TypeScript types and enums
- Zod validation schemas
- API client (fetch wrapper with auth header injection)
- Filter definitions
- TMDB image URL helper

## Navigation (Bottom Tabs)

| Tab | Screen |
|---|---|
| Deck | Primary swipe interface |
| Search | Manual lookup |
| Collection | Grid/list |
| Review Later | Queue |
| Profile | Settings + export |

## Deck Gestures

| Gesture | Action |
|---|---|
| Swipe left | Haven't Watched |
| Swipe right | Watched |
| Swipe up | Review Later |

Implementation:
- `PanGestureHandler` on card
- Card follows translation; rotate slightly for feedback
- Threshold: 120px horizontal, 100px vertical
- Haptic feedback on confirm (Expo Haptics)

Fallback: three buttons below card for accessibility.

## Offline Queue

When network unavailable:
1. User can classify items already in loaded batch (up to 20)
2. Actions stored in AsyncStorage:

```typescript
interface OfflineAction {
  mediaId: string;
  status: 'watched' | 'unwatched';
  reviewStatus: 'none' | 'pending';
  timestamp: string;
  synced: boolean;
}
```

3. On reconnect: sync queue FIFO via `PUT /user-media/:id`
4. Conflict policy: server wins; show sync summary

## Auth

Supabase Auth with `@supabase/supabase-js` + secure storage for session (Expo SecureStore).

## Reviews Write UI (Phase 2)

- Full-screen modal from Review Later list
- Fields: body (required), spoiler toggle
- Optional rating deferred

## Import (Phase 2)

- File picker for `mubitracker.json`
- Validate schema v1
- Upsert user_media + reviews via `/api/v1/import`

## Build & Deploy

- EAS Build for iOS + Android
- Environment: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_API_URL`

## Parity Checklist

- [ ] Deck swipe loop matches web speed target
- [ ] Search + direct track
- [ ] Collection with filters
- [ ] Review Later queue
- [ ] Export
- [ ] Offline batch classification
- [ ] Filter presets (Phase 1.5)
- [ ] Undo
