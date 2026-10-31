// Accessibility (SDD 5.12.6, AC-18): no serious or critical axe-core violation on each screen.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clientNav, login, stubTiles } from './helpers';

async function seriousViolations(page: Page) {
  // Measure the final look: wait until every entry animation (fade, slide) has finished.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  );
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

test('stock dialog over the blurred app', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'sara.m');
  await page.getByRole('button', { name: 'Show stock' }).click();
  await expect(page.getByRole('dialog', { name: 'Warehouse stock' })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await seriousViolations(page)).toEqual([]);
});

test('a screen on the navy canvas (placeholder and no-access card)', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'karim.b');
  await expect(page).toHaveURL(/\/resources$/); // wait for the home redirect first
  await clientNav(page, '/network');
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('link', { name: 'Decision history' }).click();
  await expect(page.getByText('This screen arrives in Step 2d of the MVP.')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('station forecast (uncertain) and totals', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'sara.m');
  await expect(page).toHaveURL(/\/network$/);
  await clientNav(page, '/forecast?station=ST014&fuel=DIESEL');
  await expect(
    page.getByText('Confidence is 66%: weather data is missing for 2 of 7 days.'),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('link', { name: 'Totals' }).click();
  await page.getByRole('radio', { name: 'By warehouse' }).click();
  await expect(page.getByRole('region', { name: /Rives Depot/ })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('resources, the save confirmation, trips and the record dialog (dispatcher)', async ({
  page,
}) => {
  await stubTiles(page);
  await login(page, 'karim.b');
  await expect(page.getByRole('region', { name: 'Tankers' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('switch', { name: 'T-06 available' }).click();
  await page.getByRole('button', { name: 'Save resources' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Previous day' }).click();
  await page.getByRole('button', { name: 'Previous day' }).click();
  await page
    .getByRole('navigation', { name: 'Resources views' })
    .getByRole('link', { name: /Trips/ })
    .click();
  await expect(page.getByText('Plan for 01 Nov 2026 decided: 3 trips to record.')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Record departure' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
