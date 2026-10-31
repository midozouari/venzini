import { expect, test } from '@playwright/test';

test('the app loads and shows the Venzini logo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Venzini' })).toBeVisible();
});
