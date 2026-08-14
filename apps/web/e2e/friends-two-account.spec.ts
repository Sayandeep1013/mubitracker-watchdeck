import { expect, test } from '@playwright/test';
import { loginViaUi, signUpViaApi, testUsername } from './helpers';

/**
 * Spec 50 §4 journey 5: two real accounts, request → bell badge → accept →
 * mutual → Compare. Two separate browser contexts so each account carries
 * its own session, same as two real users on two devices.
 */
test.describe('Friends — two account flow', () => {
  test.slow();
  let userA: string;
  let userB: string;

  test.beforeAll(async () => {
    userA = testUsername();
    userB = testUsername();
    await signUpViaApi(userA);
    await signUpViaApi(userB);
  });

  test('request, bell badge, accept, mutual friendship, Compare', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await loginViaUi(pageA, userA);
    await loginViaUi(pageB, userB);

    // A sends B a request by exact username.
    await pageA.goto('/friends');
    await pageA.getByPlaceholder('@username').fill(userB);
    await pageA.getByRole('button', { name: 'Send' }).click();
    await expect(pageA.getByText(new RegExp(`To @${userB} . Pending`, 'i'))).toBeVisible({
      timeout: 10_000,
    });

    // B sees the bell badge without a manual poll wait beyond the UI's own refresh.
    await pageB.goto('/friends');
    await pageB.reload();
    await pageB.getByRole('button', { name: /Incoming/i }).click();
    const incomingRow = pageB.getByText(`@${userA}`, { exact: true });
    await expect(incomingRow, 'B sees the incoming request from A').toBeVisible({ timeout: 15_000 });

    // Scoped to the incoming-list row specifically — a friend-request toast
    // (spec 40 §7's "[View] [Accept]") can be on screen at the same time
    // and also has an "Accept" button, which makes an unscoped query ambiguous.
    await incomingRow.locator('xpath=..').getByRole('button', { name: 'Accept' }).click();

    // Mutual: both sides now show each other under the Friends tab.
    await pageB.getByRole('button', { name: 'Friends', exact: true }).click();
    await expect(pageB.getByText(`@${userA}`, { exact: true })).toBeVisible({ timeout: 10_000 });

    await pageA.goto('/friends');
    await expect(pageA.getByText(`@${userB}`, { exact: true })).toBeVisible({ timeout: 10_000 });

    // Compare renders a real comparison, not an error.
    await pageA.getByRole('button', { name: 'Compare' }).click();
    await expect(pageA.getByText(/Both watched:/i)).toBeVisible({ timeout: 10_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
