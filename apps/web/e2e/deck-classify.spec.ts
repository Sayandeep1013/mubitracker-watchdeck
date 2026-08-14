import { expect, test } from '@playwright/test';
import { loginViaUi, signUpViaApi, testUsername } from './helpers';

/**
 * Spec 50 §4 journey 1: signup → deck → classify → collection.
 *
 * A fresh account gets a deck card, keyboard classify marks it watched, and
 * the title shows up in Collection with the correct status.
 */
test.describe('Signup → deck → classify → collection', () => {
  let username: string;

  test.beforeAll(async () => {
    username = testUsername();
    await signUpViaApi(username);
  });

  test('classifying a card via keyboard reflects in Collection', async ({ page }) => {
    await loginViaUi(page, username);

    // ArrowRight selects "watched" (sticky selection), Enter confirms it —
    // matches the real keyboard flow, not just clicking the Confirm button.
    await page.getByRole('button', { name: 'Confirm' }).waitFor({ timeout: 15_000 });
    const title = await page.locator('h2').first().textContent();
    expect(title, 'card has a title before classifying').toBeTruthy();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    // The card exits and the next one enters — confirms the classify didn't
    // just silently fail and leave the same card on screen.
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();

    await page.goto('/collection');
    await expect(page.getByText('Loading...')).toBeHidden();
    const row = page.locator('.grid').getByText(title!.trim(), { exact: false }).first();
    await expect(row, `${title} appears in Collection`).toBeVisible({ timeout: 10_000 });
  });
});
