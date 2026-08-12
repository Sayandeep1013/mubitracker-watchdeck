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

/**
 * Classify `count` titles so pagination/collection assertions have data.
 * Returns the media ids that were classified.
 */
export async function seedCollection(token: string, count: number): Promise<string[]> {
  const api = await apiContext(token);
  const ids: string[] = [];

  while (ids.length < count) {
    const res = await api.get(`/api/v1/deck?limit=${Math.min(20, count - ids.length + 5)}`);
    expect(res.ok(), 'deck fetch while seeding').toBeTruthy();
    const { items } = await res.json();
    if (!items?.length) break;

    for (const item of items) {
      if (ids.length >= count) break;
      const put = await api.put(`/api/v1/user-media/${item.id}`, {
        data: { status: ids.length % 2 === 0 ? 'watched' : 'unwatched' },
      });
      if (put.ok()) ids.push(item.id);
    }
  }

  await api.dispose();
  return ids;
}

/** Sign in through the real UI so the browser context carries a valid session. */
export async function loginViaUi(page: Page, username: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder(/Password/).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/deck/, { timeout: 30_000 });
}
