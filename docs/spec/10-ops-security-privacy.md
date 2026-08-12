# 10 — Operations, Security & Privacy

## Authentication & Authorization

- Supabase Auth: email/password (MVP); Google OAuth later
- JWT validated on every API route
- Row Level Security (RLS) on all user-data tables
- Service role key server-only for admin/ingest operations

## RLS Policy Summary

| Table | Select | Insert/Update/Delete |
|---|---|---|
| profiles | Public fields if visibility allows; own row always | Own row only |
| user_media | Own row only | Own row only |
| reviews | Own + visibility rules | Own only |
| friendships | Involved parties | Requester/receiver rules |
| filter_presets | Own only | Own only |
| media | Public read (cached metadata) | Service role only |
| recommendations | Sender or receiver | Sender creates |

## Threat Model (MVP)

Users must never:
- Change another user's watch status
- Read private reviews or collections
- Modify another user's profile
- Access friend data without accepted friendship + visibility

## Account Deletion

`DELETE /api/v1/profile` cascades:
- profile
- user_media
- reviews
- friendships (both directions)
- filter_presets
- recommendations (sent and received)
- deck_sessions

Media records remain (global cache).

## Data Ownership

- Export always available (JSON v1)
- Import in Phase 2
- User data portable via provider_id in export

## Backups

- Supabase automated daily backups (Pro plan for PITR when production)
- Export encourages user-side backup

## TMDB Compliance

About/Credits page must include:
- Approved TMDB logo ([logos page](https://www.themoviedb.org/about/logos-attribution))
- Disclaimer: *"This product uses the TMDB API but is not endorsed or certified by TMDB."*
- Link to https://www.themoviedb.org/

## Error Handling

| Failure | Behavior |
|---|---|
| TMDB down | Serve cache; search shows unavailable message |
| Auth expired | Redirect to login |
| Rate limited | Backoff + retry; user sees brief delay |
| Empty deck | Actionable message to broaden filters |

## Analytics

Product metrics only (no PII):
- deck_started, media_classified, watch_action, filter_used, undo_used
- Aggregate: avg classification interval, titles per session

## Admin Panel (Future)

Internal only:
- View users, media, provider IDs
- Merge duplicate media
- Inspect API failures

Not in MVP.

## Environment Security

- Secrets in `.env.local` / Vercel env vars
- Never commit `.env`
- CORS: restrict to app domains in production

## CI (Phase 0)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (unit tests for normalization, filters)

## Monitoring (Future)

- Vercel analytics
- Supabase dashboard for DB health
- TMDB 429 rate tracking in logs
