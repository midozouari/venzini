// Accessibility (SDD 5.12.6, AC-18): no serious or critical axe-core violation on each screen.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { login, stubTiles } from './helpers';

async function seriousViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('network overview', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'sara.m');
  await expect(page.locator('.vz-marker')).toHaveCount(19);
  await page.waitForTimeout(600); // let entry animations finish
  expect(await seriousViolations(page)).toEqual([]);
});
