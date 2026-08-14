# 50 — Delivery Pipeline

Status: draft (2026-08-12)

Extends `10-ops-security-privacy.md` (§CI, §Analytics, §Monitoring), which is superseded by this
document wherever the two overlap. Primary input: `AUDIT-2026-08-12.md` §4.

---

## 1. Environments

| Env | Runs on | Supabase project | App URL | Deployed by |
|---|---|---|---|---|
| local | `pnpm dev` (Next 15.5.23 Turbopack, Expo SDK 54) | `deslckxkuvbfugdxibdn` (shared, ap-south-1) | `http://localhost:3000` | developer |
| preview | Vercel preview, `mubitracker-watchdeck-web` | `deslckxkuvbfugdxibdn` (shared) | `*.vercel.app` | push to any non-`main` branch / PR |
| production | Vercel production, functions pinned `bom1` (`apps/web/vercel.json`) | `deslckxkuvbfugdxibdn` | production domain | auto-deploy on push to `main` (`Sayandeep1013/mubitracker-watchdeck`) |

**Risk — one shared database.** Today local, preview and production all point at the same Supabase
project. Every preview deploy, every local run, and every CI smoke test writes to production
`profiles`, `user_media`, `reviews`, `friendships` and `deck_sessions`. A destructive migration
tested on a preview branch destroys production data with no separate blast radius.

**Intended separation.** Two additional Supabase projects in `ap-south-1`:

- `mubitracker-staging` — target for preview deploys and all CI smoke/E2E jobs. Seeded from
  migrations only; no production rows ever copied.
- `mubitracker-local` — optional; developers may instead run `supabase start` locally.

Migration order is always local → staging → production. Until staging exists, CI E2E jobs run
against production with `wqa*`/`mqa*` accounts only (§6) and no destructive assertions, and this is
recorded as accepted debt.

**Dated waiver (2026-08-14, Stage 5.5).** `mubitracker-staging` does not exist yet. Creating it
needs the account owner's Supabase dashboard access (project creation is not delegable to a
project-scoped API token), plus replaying all 18 migrations and updating Vercel's preview
environment variables — real footprint the user chose to defer rather than provision mid-session.
Per-push CI (`verify`/`mobile-bundle`/`contract-smoke`/`e2e-web`, `.github/workflows/ci.yml`) and
the nightly job (`.github/workflows/nightly.yml`) both target `vars.STAGING_URL`, which is
currently set to the production URL — exactly the accepted-debt path this section already
describes. Revisit when a staging project is actually provisioned: repoint `STAGING_URL` and
`E2E_SUPABASE_URL`/`E2E_SUPABASE_ANON_KEY` (GitHub repo Variables/Secrets) at it, replay migrations
there first, and this waiver is closed.

---

## 2. Environment variables

Authoritative list. "Server-only" means the value must never appear in a `NEXT_PUBLIC_*` or
`EXPO_PUBLIC_*` name, in the client bundle, or in a committed file.

| Variable | Scope | Server-only | Set in |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | no | `apps/web/.env.local`, Vercel (all envs), CI |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | no | same |
| `SUPABASE_SERVICE_ROLE_KEY` | web API routes | **yes** | `apps/web/.env.local`, Vercel (all envs), GitHub secret |
| `TMDB_V3_API_KEY` | web API routes | **yes** | same |
| `TMDB_READ_ACCESS_TOKEN` | web API routes | **yes** | same |
| `NEXT_PUBLIC_APP_URL` | web | no | Vercel per-env; local `http://localhost:3000` |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | no | `apps/mobile/.env`, EAS build profile |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | no | same |
| `EXPO_PUBLIC_API_URL` | mobile | no | same — points at the web deployment serving `/api/v1` |
| `BASE_URL` | CI/scripts | n/a | job env for `scripts/validate-deck-loop.mjs` |

Rules:

1. **Every build-affecting variable must be listed in `turbo.json` → `tasks.build.env`.** Turbo
   hashes only declared variables; an undeclared one produces a cache hit with the previous value
   baked in. This has already been hit once. The array is currently correct — do not add a new
   `NEXT_PUBLIC_*`/secret without adding it here in the same commit.
2. **CI currently sets `TMDB_API_KEY`, which no longer exists.** `.github/workflows/ci.yml` must be
   corrected to `TMDB_V3_API_KEY` + `TMDB_READ_ACCESS_TOKEN`; the placeholder build passes only
   because nothing reads TMDB at build time.
3. Mobile has no server-only variables. Anything the mobile client needs is public by construction;
   if a secret is required, it belongs behind `/api/v1`.

---

## 3. CI stages

Trigger: push to `main`, and all pull requests. Fail fast, ordered cheapest-first.

`install → typecheck → unit → lint → build (web) → mobile bundle → API contract smoke → E2E web`

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

env:
  TURBO_TELEMETRY_DISABLED: 1

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @mubitracker/shared build
      - run: pnpm typecheck
      - run: pnpm --filter @mubitracker/shared test
      - run: pnpm --filter @mubitracker/web lint
      - run: pnpm --filter @mubitracker/web build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          SUPABASE_SERVICE_ROLE_KEY: placeholder
          TMDB_V3_API_KEY: placeholder
          TMDB_READ_ACCESS_TOKEN: placeholder
          NEXT_PUBLIC_APP_URL: http://localhost:3000

  mobile-bundle:
    runs-on: ubuntu-latest
    needs: verify
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @mubitracker/shared build
      - run: pnpm --filter @mubitracker/mobile exec expo export --platform android
        env:
          EXPO_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          EXPO_PUBLIC_SUPABASE_ANON_KEY: placeholder
          EXPO_PUBLIC_API_URL: http://localhost:3000

  contract-smoke:
    runs-on: ubuntu-latest
    needs: verify
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: node scripts/validate-deck-loop.mjs
        env:
          BASE_URL: ${{ needs.verify.outputs.preview_url || vars.STAGING_URL }}

  e2e-web:
    runs-on: ubuntu-latest
    needs: contract-smoke
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

`mobile-bundle` catches the class of failure CI is blind to today: a Metro-resolvable import that
breaks under `expo export` (bad `@mubitracker/shared` export, native module used on web, Reanimated
4 worklet misuse). It is a bundle check, not a device run — no emulator, no APK.

A separate `nightly.yml` (cron `0 18 * * *`, i.e. 23:30 IST) runs Maestro device E2E (§4) and a
full `validate-deck-loop.mjs` against production.

---

## 4. Testing strategy

| Layer | Tool | Scope | Where it runs |
|---|---|---|---|
| Unit | vitest (`@mubitracker/shared`) | pure logic only: classification, filter normalization, cursor encoding, export/import schema | every push |
| API contract | `scripts/validate-deck-loop.mjs` + siblings | `/api/v1/*` status codes, response shape, idempotency | every push |
| E2E web | Playwright 1.62.1 | user journeys through real UI | every push |
| E2E mobile | Maestro 2.6.1 | gesture + navigation correctness on a real device | nightly only |

**Unit.** Anything with a network or Supabase dependency does not belong here. `generate.ts`
predicate construction should be extracted into pure helpers in `packages/shared` so exclusion logic
(audit §1.2, §2.4, §2.6) becomes unit-testable without a database.

**API contract.** Extend the existing script pattern to cover, per endpoint: happy path shape,
401 when unauthenticated, 400 with the documented `{ error: { code, message } }` envelope, and
idempotency for `PUT /user-media/:id`. Must include the regressions the audit found: `POST
/api/v1/reviews` rejecting a non-UUID `media_id`, `GET /api/v1/collection` returning `total`
alongside a page, and `GET /api/v1/deck` returning a non-null cursor on an under-filled batch.

**E2E web — critical journeys** (each is one Playwright spec):

1. `signup → deck → classify → collection` — new `wqa*` account, deck renders a card, swipe/keyboard
   right marks watched, item appears in Collection with the correct status.
2. `deck-loop` — 20 consecutive classifications, assert 20 unique titles and that the deck never
   dead-ends (guards audit §1.1/§1.3).
3. `filters` — apply a filter preset, assert a populated deck and record wall-clock time; fail if
   filter apply exceeds the budget in §6.
4. `collection-pagination` — an account with >24 items exposes pager controls and reaches page 2.
5. `friends-two-account` — two `wqa*` contexts: request → bell badge → accept → mutual → Compare.
6. `review` — swipe-down to Review Later, open editor, save, assert persistence and removal from
   pending; assert a failed save surfaces an error.

**E2E mobile.** Convention: a top-level `mobile-qa/` folder with `config.yaml` and `flows/*.yaml`.

```
mobile-qa/
  config.yaml          # appId: com.mubitracker.app, flows: flows/*.yaml
  flows/
    01-login.yaml
    02-deck-classify.yaml
    03-collection-refresh.yaml   # guards audit §1.4 (stale tabs)
    04-undo.yaml                 # guards audit §2.14
    05-search-actions.yaml
```

**Constraint:** a Maestro no-op costs ~24s of device/driver overhead, so a five-flow suite is
several minutes before any assertion runs. Device E2E therefore belongs in the nightly job and in
pre-release gating — never per-push. Per-push mobile coverage is the `expo export` bundle check only.

---

## 5. Test data policy

- Web test accounts: username prefix `wqa`. Mobile: `mqa`. CI-generated: `<prefix><timestamp>`.
- Auth email is derived, `<username>@users.mubitracker.local` — never a real address.
- Fixed password from the `QA_TEST_PASSWORD` secret; never hardcoded in a committed flow.
- `scripts/validate-deck-loop.mjs` currently defaults to `deck_<stamp>`; change the default to `wqa`.
- No test account may be granted friendship with a real user account.

Cleanup: `scripts/cleanup-test-accounts.mjs`, service-role, deleting every profile matching
`^(wqa|mqa|deck_)` older than 24h and cascading exactly as `DELETE /api/v1/profile` does.

```bash
node scripts/cleanup-test-accounts.mjs --older-than 24h --dry-run   # prints, deletes nothing
node scripts/cleanup-test-accounts.mjs --older-than 24h --confirm   # nightly job, post-E2E
```

The script must refuse to run without `--confirm` and must refuse any prefix outside the allowlist.

---

## 6. Observability

Today there is **no analytics of any kind**, so the product's headline metric — 2–4s per
classification — cannot be measured, only guessed at. This is the single largest engineering gap.

Minimal client event set (no PII; `user_id` is the Supabase UUID, never username or email):

| Event | Properties |
|---|---|
| `deck_batch_served` | `count`, `latency_ms`, `filtered` (bool), `filter_keys[]`, `cursor_null` (bool), `source` (`cold`/`prefetch`) |
| `media_classified` | `media_id`, `status`, `input` (`swipe`/`key`/`button`), `ms_since_card_shown`, `platform` |
| `undo_used` | `depth`, `restored_status`, `platform` |
| `deck_empty` | `filtered`, `filter_keys[]`, `batches_served_this_session` |
| `filter_applied` | `filter_keys[]`, `preset` (bool), `latency_ms`, `result_count` |

`ms_since_card_shown` on `media_classified` **is** the headline metric. Report p50/p90 per platform.

Server-side timing logs, structured JSON on one line, emitted from the API route:

```
{ "evt":"deck.generate", "ms":9143, "tmdb_pages":12, "tmdb_ms":8102,
  "candidates":240, "excluded":149, "returned":3, "filtered":true, "req_id":"…" }
{ "evt":"tmdb.call", "path":"/discover/movie", "ms":612, "status":200, "cached":false }
```

Every `/api/v1/*` response carries an `x-request-id` that appears in both the log line and the
client event, so a slow classification is traceable end-to-end.

Error tracking: an exception reporter (Sentry or equivalent) wired into the web `error.tsx` /
`global-error.tsx`, every API route's catch, and the mobile root. Alert on: TMDB 429 rate,
`deck.generate` p90 > 3s, `deck_empty` rate > 5% of sessions, and any 5xx on `/api/v1/deck`.

---

## 7. Caching & rate limiting

Current state: nothing is cached; the only rate control is a 35ms per-instance gate in `tmdb.ts`,
which is meaningless on serverless where N concurrent instances each keep their own timer.

| Layer | Policy |
|---|---|
| TMDB `/discover` | Cache the response body keyed by the full query, TTL 6h, in Supabase (`tmdb_cache` table) or a KV store — must be shared across instances, not in-process |
| TMDB `/movie/:id`, `/tv/:id` | TTL 24h; also written through to `media` |
| TMDB `/search` | TTL 15m — search is 6.2s today and repeats heavily |
| TMDB genre lists | TTL 30d, refreshed on deploy |
| `/api/v1/deck` | never cached at the edge (per-user), but candidate pages come from the cache above |
| `/api/v1/collection`, `/profile` | `Cache-Control: private, no-store` |

Additional requirements:

1. **In-flight dedup** — concurrent identical TMDB requests within one instance share one promise.
2. **Real rate limiting** — a shared counter (KV/Postgres) enforcing a global TMDB budget, with
   exponential backoff and jitter on 429, replacing the 35ms sleep.
3. **`media` as a candidate source** — once populated, the deck reads local rows first and falls
   back to TMDB. This is what makes the deck survive TMDB being down (audit §4) instead of 500-ing.

---

## 8. Release & rollback

**Web.** `main` auto-deploys to production. Rollback is `vercel rollback <deployment-url>` or
Instant Rollback in the dashboard — always prefer rolling back over hot-fixing forward. Promote a
verified preview with `vercel promote <url>`. Every production deploy is smoke-tested immediately:

```bash
BASE_URL=https://<production-domain> node scripts/validate-deck-loop.mjs
```

**Supabase.** `supabase/migrations/*.sql` is the sole source of truth for schema; no change is ever
made through the dashboard. Forward-only — a mistake is corrected by a new migration, never by
editing an applied one.

*Filename convention (must be documented and fixed):* four migrations are stamped `20250812*` and
one `20260812073308`, so lexical order no longer matches real chronology. Convention going forward
is `YYYYMMDDHHMMSS_snake_case_description.sql` using the real UTC date. The existing five files are
already applied and must **not** be renamed; the inconsistency is recorded here instead.

Apply order: local → staging → production, each verified with `supabase migration list`.
Take a manual backup before any migration that drops or alters a column.

**Mobile.** EAS is not set up. Prerequisites before the first release: an Expo account and project
ID, `eas.json` with `development`/`preview`/`production` profiles, `EXPO_PUBLIC_*` values per
profile, Android package name and signing credentials, `app.json` version/`versionCode` policy, and
store listing assets. Until then mobile ships only as a local dev build, and `expo export` in CI is
the only mobile release gate.

---

## 9. Definition of done

A task is not complete until all of the following hold:

1. Typecheck, lint, unit tests and the web build pass locally and in CI.
2. New pure logic has vitest coverage; new or changed `/api/v1` behaviour has a contract assertion.
3. A user-visible change has either a Playwright spec (web) or a Maestro flow (mobile), or an
   explicit written note saying why not.
4. Mobile-affecting changes pass `expo export`.
5. Any behaviour with a latency claim emits the corresponding event from §6.
6. New environment variables are added to `turbo.json` build `env`, Vercel, CI, and §2 of this doc.
7. Schema changes ship as a migration file, applied and verified.
8. Test data created during verification is cleaned up or matches the `wqa*`/`mqa*` convention.
9. The relevant spec in `docs/spec/` is updated in the same commit — no code/spec drift.
10. Verified against a real deployment, not only localhost.

---

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` contains jobs `verify`, `mobile-bundle`, `contract-smoke`, `e2e-web`.
- [ ] CI no longer references `TMDB_API_KEY`; it sets `TMDB_V3_API_KEY` and `TMDB_READ_ACCESS_TOKEN`.
- [ ] `pnpm --filter @mubitracker/mobile exec expo export --platform android` exits 0 in CI.
- [ ] A `playwright.config.ts` exists and `pnpm exec playwright test` runs ≥6 specs covering the
      journeys in §4, including the two-account friends flow.
- [ ] `mobile-qa/config.yaml` exists with ≥5 flows under `mobile-qa/flows/`.
- [ ] Maestro flows run in `nightly.yml` on a schedule and **not** in the per-push workflow.
- [ ] `scripts/cleanup-test-accounts.mjs` exists, supports `--dry-run`/`--confirm`, refuses prefixes
      outside `wqa|mqa|deck_`, and runs after the nightly E2E job.
- [ ] `scripts/validate-deck-loop.mjs` default test username starts with `wqa`.
- [ ] All five events in §6 are emitted by both web and mobile, and a query returns p50/p90 of
      `media_classified.ms_since_card_shown` per platform.
- [ ] `deck.generate` and `tmdb.call` structured log lines appear in Vercel logs with `ms` populated.
- [ ] Every `/api/v1/*` response includes an `x-request-id` header.
- [ ] An error reporter captures an intentionally thrown API error and shows it in its dashboard.
- [ ] A TMDB `/discover` cache exists, is shared across instances, and a repeated identical deck
      request records `"cached":true`.
- [ ] The 35ms `setTimeout` gate in `tmdb.ts` is removed and replaced by a shared-counter limiter.
- [ ] `/api/v1/deck` returns 200 with local `media` candidates when TMDB is unreachable.
- [ ] A separate staging Supabase project exists and preview deploys point at it, or a dated waiver
      is recorded in this file.
- [ ] `docs/spec/10-ops-security-privacy.md` §CI links to this document.
- [ ] The next migration added uses `YYYYMMDDHHMMSS_` with the correct UTC year.
