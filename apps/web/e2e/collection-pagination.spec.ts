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
    await expect(pager, 'pager is rendered when total exceeds one page').toBeVisible();
    await expect(pager).toContainText('Page 1 of');

    const firstPageTitles = await page.locator('.grid p.truncate').allTextContents();
    expect(firstPageTitles.length).toBeGreaterThan(0);

    await expect(page.getByRole('button', { name: /Prev/ })).toBeDisabled();

    await page.getByRole('button', { name: /Next/ }).click();
    await expect(pager).toContainText('Page 2 of');

    const secondPageTitles = await page.locator('.grid p.truncate').allTextContents();
    expect(secondPageTitles.length, 'page 2 has items').toBeGreaterThan(0);
    expect(
      secondPageTitles,
      'page 2 shows different items than page 1',
    ).not.toEqual(firstPageTitles);

    await page.getByRole('button', { name: /Prev/ }).click();
    await expect(pager).toContainText('Page 1 of');
  });

  test('changing a filter resets to page 1', async ({ page }) => {
    await loginViaUi(page, username);
    await page.goto('/collection');

    await page.getByRole('button', { name: /Next/ }).click();
    await expect(page.getByRole('navigation', { name: 'Collection pages' })).toContainText('Page 2');

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
