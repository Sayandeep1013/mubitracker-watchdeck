import { expect, test } from '@playwright/test';
import { loginViaUi, signUpViaApi, testUsername } from './helpers';

/**
 * Spec 50 §4 journey 3 / spec 20 §6's < 800ms p95 filtered-deck budget.
 *
 * That budget is a v2 (bucket engine) target — v1 (still production
 * default, DECK_ENGINE unset) is documented at 9.1-9.6s for the same
 * request (spec 20 §6's own measured table), so asserting 800ms
 * unconditionally here would just make this test permanently red against
 * today's production. Detect which engine actually answered (same
 * `bucketId` presence check DeckView.tsx itself uses) and only enforce
 * the budget when v2 responded.
 */
test.describe('Filters', () => {
  let username: string;

  test.beforeAll(async () => {
    username = testUsername();
    await signUpViaApi(username);
  });

  test('applying a type filter returns a populated (or explicitly empty) deck', async ({ page }) => {
    await loginViaUi(page, username);
    await page.getByRole('button', { name: 'Confirm' }).waitFor({ timeout: 15_000 });

    await page.getByRole('button', { name: /Filters/i }).click();
    await page.getByRole('button', { name: 'Movies', exact: true }).click();

    const deckResponse = page.waitForResponse(
      (res) => res.url().includes('/api/v1/deck') && res.request().method() === 'GET',
    );
    const start = Date.now();
    await page.getByRole('button', { name: 'Apply Filters' }).click();
    const res = await deckResponse;
    const latencyMs = Date.now() - start;
    const body = await res.json();
    const isV2 = 'bucketId' in body && body.bucketId != null;

    console.log(`[filters] engine=${isV2 ? 'v2' : 'v1'} latency=${latencyMs}ms items=${body.items?.length}`);

    if (isV2) {
      expect(latencyMs, 'v2 filtered deck meets the <800ms p95 budget (spec 20 §6)').toBeLessThan(800);
    }

    // Populated or an explicit empty/partial state — never a silent hang.
    const hasItems = (body.items?.length ?? 0) > 0;
    if (!hasItems) {
      await expect(
        page.getByText(/deck is empty|no titles match|couldn.?t load/i),
        'an explicit empty/error state is shown, not a blank hang',
      ).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
    }
  });
});
