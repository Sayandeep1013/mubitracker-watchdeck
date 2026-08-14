import { expect, test } from '@playwright/test';
import {
  getAccessToken,
  loginViaUi,
  seedCollection,
  signUpViaApi,
  testUsername,
} from './helpers';

/**
 * Regression: plan item 0.3.
 *
 * The collection API returned `total`/`page`/`pageSize`, but the UI discarded
 * them and nothing ever set `page > 1` — so 77 of 101 items were unreachable
 * with no pager rendered at all.
 */
test.describe('Collection pagination', () => {
  test.slow(); // seeding classifies 26 titles through the real API

  let username: string;

  test.beforeAll(async () => {
    username = testUsername();
    await signUpViaApi(username);
    const token = await getAccessToken(username);
    // One more than a full page (pageSize defaults to 24) so a 2nd page exists.
    const seeded = await seedCollection(token, 26);
    expect(seeded.length, 'seeded enough items for a second page').toBeGreaterThan(24);
  });

  test('renders a pager and reaches items beyond page 1', async ({ page }) => {
    await loginViaUi(page, username);
    await page.goto('/collection');

    const pager = page.getByRole('navigation', { name: 'Collection pages' });
    const titles = page.locator('.grid p.truncate');

    // The pager label updates from `page` state immediately, but the grid is
    // swapped for a "Loading..." block while the fetch is in flight — so always
    // wait for content to settle before reading titles.
    const settled = async () => {
      await expect(page.getByText('Loading...')).toBeHidden();
      await expect(titles.first()).toBeVisible();
    };

    await expect(pager, 'pager is rendered when total exceeds one page').toBeVisible();
    await expect(pager).toContainText('Page 1 of');
    await settled();

    const firstPageTitles = await titles.allTextContents();
    expect(firstPageTitles.length).toBeGreaterThan(0);

    await expect(pager.getByRole('button', { name: /Prev/ })).toBeDisabled();

    // Scoped to the pager nav, not a bare page-wide query — Next.js's dev
    // tools overlay (next dev only, never in production) adds its own
    // "Open Next.js Dev Tools" button whose accessible name also matches
    // a loose /Next/ regex, which made this a strict-mode violation when
    // testing locally against `next dev` instead of a production build.
    await pager.getByRole('button', { name: /Next/ }).click();
    await expect(pager).toContainText('Page 2 of');
    await settled();

    const secondPageTitles = await titles.allTextContents();
    expect(secondPageTitles.length, 'page 2 has items').toBeGreaterThan(0);
    expect(
      secondPageTitles,
      'page 2 shows different items than page 1',
    ).not.toEqual(firstPageTitles);

    await pager.getByRole('button', { name: /Prev/ }).click();
    await expect(pager).toContainText('Page 1 of');
    await settled();
    expect(await titles.allTextContents()).toEqual(firstPageTitles);
  });

  test('changing a filter resets to page 1', async ({ page }) => {
    await loginViaUi(page, username);
    await page.goto('/collection');

    const pagerNav = page.getByRole('navigation', { name: 'Collection pages' });
    await pagerNav.getByRole('button', { name: /Next/ }).click();
    await expect(pagerNav).toContainText('Page 2');

    await page.getByRole('button', { name: 'Movies', exact: true }).click();

    // Either we're back on page 1, or the filtered set is small enough that the
    // pager disappears entirely — both are correct, neither may strand the user.
    const pager = page.getByRole('navigation', { name: 'Collection pages' });
    if (await pager.isVisible()) {
      await expect(pager).toContainText('Page 1 of');
    }
    await expect(page.getByText('No items found')).toBeHidden();
  });
});
