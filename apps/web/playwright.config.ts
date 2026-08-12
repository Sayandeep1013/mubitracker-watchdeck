import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Targets the deployed app by default so the suite can run without
 * a local server; override with E2E_BASE_URL to test a preview or localhost.
 *
 * Seeding requires E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY (see e2e/helpers.ts)
 * because the API authenticates with a bearer token, not cookies.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared Supabase project — avoid cross-test interference
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://mubitracker-watchdeck-web.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
