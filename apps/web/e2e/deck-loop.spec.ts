import { expect, test } from '@playwright/test';
import { loginViaUi, signUpViaApi, testUsername } from './helpers';

/**
 * Spec 50 §4 journey 2: deck-loop — guards audit §1.1/§1.3 (repetition,
 * dead-ending). 20 consecutive classifications on a fresh account should
 * show 20 unique titles and never leave the deck stuck with no card.
 */
test.describe('Deck loop', () => {
  test.slow();
  let username: string;

  test.beforeAll(async () => {
    username = testUsername();
    await signUpViaApi(username);
  });

  test('20 classifications show 20 unique titles with no dead end', async ({ page }) => {
    await loginViaUi(page, username);
    await page.getByRole('button', { name: 'Confirm' }).waitFor({ timeout: 15_000 });

    const h2 = page.locator('h2').first();
    const seenTitles: string[] = [];
    for (let i = 0; i < 20; i++) {
      const title = (await h2.textContent())?.trim();
      expect(title, `card ${i + 1} has a title`).toBeTruthy();
      seenTitles.push(title!);

      // Alternate watched/haven't so both status branches exercise the
      // exclusion/cooldown path, not just one.
      await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
      await page.keyboard.press('Enter');

      // The Confirm button never unmounts across the exit/enter transition,
      // so waiting on it alone doesn't prove a *new* card loaded — wait for
      // the title text to actually change (or, on the very last card, at
      // least confirm the deck didn't dead-end).
      await expect(
        h2,
        `card ${i + 1} advanced to a new title, no dead end`,
      ).not.toHaveText(title!, { timeout: 10_000 });
    }

    const unique = new Set(seenTitles);
    expect(unique.size, `all ${seenTitles.length} titles were unique`).toBe(seenTitles.length);
  });
});
