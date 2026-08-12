# 01 — Architecture

## Stack (Option A)

| Layer | Choice |
|---|---|
| Web + API | Next.js 15 (App Router, Route Handlers) |
| Mobile | Expo + React Native (Phase 2) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Hosting | Vercel (web), Supabase (DB) |
| Package manager | pnpm + Turborepo |

API routes are structured for later extraction to `apps/api` without contract changes.

## Monorepo Layout

```text
watchdeck/
  apps/
    web/              # Next.js — deck, search, collection, API routes
    mobile/           # Expo (Phase 2)
  packages/
    shared/           # types, zod schemas, enums, api-client, constants
  supabase/
    migrations/       # SQL schema + RLS
  docs/spec/
```

## System Diagram

```text
                    WATCHDECK
                        │
        ┌───────────────┴───────────────┐
        │                               │
    WEB CLIENT                    MOBILE APP
        │                               │
        └───────────────┬───────────────┘
                        │
                  WATCHDECK API
                  (Next.js routes)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   PostgreSQL        Supabase Auth    Media Providers
   (Supabase)                          TMDB (+ Jikan later)
```

## Architectural Rules

1. **Frontend never calls TMDB directly** — all media data flows through Watchdeck API.
2. **TMDB/Jikan are data providers**, not the application database.
3. Watchdeck owns: user ↔ media relationships, reviews, friendships.
4. Providers supply: metadata, search, discovery candidates.

## MediaProvider Interface

```typescript
interface MediaProvider {
  search(query: string, options?: SearchOptions): Promise<NormalizedMedia[]>;
  getDetails(providerId: string, mediaType: MediaFormat): Promise<NormalizedMedia>;
  discover(filters: DiscoverFilters): Promise<NormalizedMedia[]>;
  getGenres(): Promise<Genre[]>;
  getExternalIds(providerId: string, mediaType: MediaFormat): Promise<ExternalId[]>;
}
```

Implementations: `TmdbProvider` (Phase 1), `JikanProvider` stub (Phase 4).

## Environment Variables

```text
# Server only
TMDB_API_KEY=
DATABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Public
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never commit secrets. Redis is **not** used in Phase 1.

## Deployment

- **Web:** Vercel, auto-deploy from main
- **DB:** Supabase managed PostgreSQL with daily backups
- **Mobile:** EAS Build (Phase 2)

## Implementation Order

See plan document. Filter engine comes after MVP loop is validated (Phase 1.5).
