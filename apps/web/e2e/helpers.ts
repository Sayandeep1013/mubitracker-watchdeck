import { expect, type APIRequestContext, type Page, request } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'https://mubitracker-watchdeck-web.vercel.app';
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY ?? '';

export const TEST_PASSWORD = 'TestPass123!';

/** Test accounts are prefixed so they are identifiable and cleanable (spec 50 §5). */
export function testUsername(prefix = 'wqa'): string {
  return `${prefix}${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

export async function signUpViaApi(username: string): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post('/api/v1/auth/signup', {
    data: { username, password: TEST_PASSWORD },
  });
  expect(res.status(), `signup for ${username}`).toBe(201);
  await ctx.dispose();
}

/**
 * Bearer token for direct API calls.
 *
 * The API authenticates via the `authorization` header (see
 * `apps/web/src/lib/api/helpers.ts`), not cookies — so seeding data through the
 * API needs a real Supabase access token, exactly as scripts/validate-deck-loop.mjs does.
 */
export async function getAccessToken(username: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error('E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY must be set to seed data');
  }
  const ctx = await request.newContext();
  const res = await ctx.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
    data: { email: `${username}@users.mubitracker.local`, password: TEST_PASSWORD },
  });
  expect(res.ok(), 'supabase sign-in').toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return body.access_token as string;
}

export async function apiContext(token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

/** Broad queries that reliably return many distinct titles. */
const SEED_QUERIES = ['star', 'love', 'man', 'war', 'night', 'day', 'life', 'dark'];

/**
 * Classify `count` titles so pagination/collection assertions have data.
 * Returns the media ids that were classified.
 *
 * Seeds via /search rather than /deck deliberately: the deck applies
 * randomised TMDB paging plus exclusion rules and can transiently fail or
 * under-fill (the exact failures Stage 2 of the plan exists to fix), which made
 * seeding flaky. Search is deterministic for a given query.
 */
export async function seedCollection(token: string, count: number): Promise<string[]> {
  const api = await apiContext(token);
  const ids = new Set<string>();

  for (const q of SEED_QUERIES) {
    if (ids.size >= count) break;

    const res = await api.get(`/api/v1/search?q=${q}&limit=50`);
    if (!res.ok()) continue; // tolerate a flaky query rather than failing the run
    const { results } = await res.json();

    for (const item of results ?? []) {
      if (ids.size >= count) break;
      if (ids.has(item.id)) continue;
      const put = await api.put(`/api/v1/user-media/${item.id}`, {
        data: { status: ids.size % 2 === 0 ? 'watched' : 'unwatched' },
      });
      if (put.ok()) ids.add(item.id);
    }
  }

  await api.dispose();
  expect(
    ids.size,
    `seeded ${ids.size} of ${count} titles — all seed queries exhausted`,
  ).toBeGreaterThanOrEqual(count);
  return [...ids];
}

/** Sign in through the real UI so the browser context carries a valid session. */
export async function loginViaUi(page: Page, username: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder(/Password/).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/deck/, { timeout: 30_000 });
}
