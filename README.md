# Mubitracker

A frictionless personal media memory system. Track movies, TV, and anime with one decision per title.

## Stack

- **Web:** Next.js 15 + TypeScript
- **Mobile:** Expo (React Native)
- **Backend:** Next.js API routes
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (or local Supabase CLI)
- TMDB API key

### Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Fill in Supabase and TMDB credentials
pnpm dev
```

### Database

Apply migrations via Supabase dashboard or CLI:

```bash
supabase db push
```

## Monorepo Structure

```text
apps/web       — Next.js web app + API
apps/mobile    — Expo mobile app
packages/shared — Types, schemas, API client
supabase/migrations — PostgreSQL schema
docs/spec      — Product & technical specifications
```

## Documentation

See [docs/spec/](docs/spec/) for full specifications.

## License

Personal project. TMDB data subject to [TMDB API terms](https://www.themoviedb.org/api-terms-of-use).
