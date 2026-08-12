import { expect, test } from '@playwright/test';
import { loginViaUi, signUpViaApi, testUsername } from './helpers';

/**
 * Regression: plan item 0.4.
 *
 * `save()` was `try/finally` with no `catch`. A 400 from the API
 * (`{"validation":"uuid","path":["media_id"]}`) left the UI completely
 * unchanged — the user had no idea the review had not saved.
 */
test.describe('Review editor error handling', () => {
  let username: string;

  test.beforeAll(async () => {
    username = testUsername();
    await signUpViaApi(username);
  });

  test('an invalid media id is rejected before submitting, with a visible message', async ({
    page,
  }) => {
    await loginViaUi(page, username);
    await page.goto('/review-later/not-a-uuid');

    await expect(
      page.getByText(/This review link is invalid/i),
      'invalid-link notice is shown',
    ).toBeVisible();

    await page.getByPlaceholder(/Your thoughts/i).fill('This should not be submittable.');

    await expect(
      page.getByRole('button', { name: /Save Review/i }),
      'save stays disabled for an invalid id',
    ).toBeDisabled();
  });

  test('a failing save surfaces an error and preserves the typed text', async ({ page }) => {
    await loginViaUi(page, username);
    // A well-formed uuid that does not exist -> the API rejects it, which is the
    // path that previously failed silently.
    await page.goto('/review-later/00000000-0000-4000-8000-000000000000');

    const text = 'A review that the server will refuse.';
    await page.getByPlaceholder(/Your thoughts/i).fill(text);
    await page.getByRole('button', { name: /Save Review/i }).click();

    await expect(page.getByRole('alert'), 'an error is surfaced to the user').toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByPlaceholder(/Your thoughts/i),
      'the user does not lose what they wrote',
    ).toHaveValue(text);

    await expect(page, 'stays on the editor rather than silently navigating').toHaveURL(
      /review-later\/00000000/,
    );
  });
});
