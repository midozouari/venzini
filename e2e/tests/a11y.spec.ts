// Accessibility (SDD 5.12.6, AC-18): no serious or critical axe-core violation on each screen.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clientNav, login, openPlanner, stubTiles } from './helpers';

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

test('a card on the navy canvas (no-access card)', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'karim.b');
  await expect(page).toHaveURL(/\/resources$/); // wait for the home redirect first
  await clientNav(page, '/network');
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await seriousViolations(page)).toEqual([]);
});

test('decision history, its filters and the entry side panel', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'karim.b');
  await page.getByRole('link', { name: 'Decision history' }).click();
  await expect(page.getByRole('region', { name: 'Decisions' }).locator('tbody tr')).toHaveCount(20);
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByLabel('From').fill('2026-10-30');
  await page.getByLabel('To').fill('2026-10-20');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByLabel('To').fill('');
  await page.getByLabel('From').fill('');
  await page.getByRole('searchbox').fill('ST015');
  await expect(page.getByRole('link', { name: /Open the decision of/ })).toHaveCount(1);
  await page.getByRole('link', { name: /Open the decision of/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Original recommendation');
  await page.getByText('Input versions').click();
  expect(await seriousViolations(page)).toEqual([]);
});

test('administration: users, stations and their dialogs', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'nadia.a');
  await expect(page.getByRole('region', { name: 'Users' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'New user' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByRole('dialog').getByText('Full name is required.')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Deactivate Karim B.' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Stations' }).first().click();
  await expect(page.getByRole('region', { name: 'Stations' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Edit ST012 Westside Terminal' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
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

test('delivery planner, with its move and quantity dialogs', async ({ page }) => {
  await openPlanner(page);
  await expect(page.locator('.vz-stop')).toHaveCount(17);
  expect(await seriousViolations(page)).toEqual([]);

  await page
    .getByRole('button', { name: 'Move Westside Terminal (ST012) to another tanker' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Move ST012 to another tanker' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: /Westside Terminal · ST012/ }).click();
  await page.getByRole('button', { name: 'Edit quantity of Petrol 95 for ST012' }).click();
  const dialog = page.getByRole('dialog', { name: 'Petrol 95 for ST012' });
  await dialog.getByLabel('Litres').fill('7000');
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('planner with an overload, and approvals blocked by it', async ({ page }) => {
  await openPlanner(page);
  await page
    .getByRole('button', { name: 'Move Westside Terminal (ST012) to another tanker' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move to T-02' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Approval is blocked.' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('link', { name: 'Go to approvals' }).click();
  await expect(page.getByRole('button', { name: 'Approve all' })).toBeDisabled();
  expect(await seriousViolations(page)).toEqual([]);
});

test('approvals with the reject and approve-all dialogs', async ({ page }) => {
  await openPlanner(page);
  await page.getByRole('link', { name: 'Go to approvals' }).click();
  await expect(page.getByText('Recommendations require manager approval')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Reject ST014' }).click();
  await expect(page.getByRole('dialog', { name: 'Reject ST014 Harbor Road?' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Approve all' }).click();
  await expect(page.getByRole('dialog', { name: 'Approve all 17 pending actions?' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
