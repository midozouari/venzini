// AC-21 MVP acceptance (SDD 7.3, 8.4): every screen and every use case UC-01 to UC-11 can be
// clicked through per role on the MVP build. One journey per role uses only the menu and the
// screens' own buttons (no reload: the mock data stays for the whole journey). The detailed checks
// of each flow live in the screen specs; the matrix is in e2e/AC-21.md.
import { expect, test, type Page } from '@playwright/test';
import { clientNav, expectHeading, login, stubTiles } from './helpers';

test.beforeEach(async ({ page }) => stubTiles(page));

const menu = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click();

/** A screen opened without an error card. */
async function opens(page: Page, title: string) {
  await expectHeading(page, title);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText(/could not be loaded/)).toHaveCount(0);
}

const ALL_SCREENS = [
  '/network',
  '/forecast',
  '/forecast/totals',
  '/resources',
  '/resources/trips',
  '/resources/warehouse-forecast',
  '/planner',
  '/approvals',
  '/history',
  '/admin/users',
  '/admin/stations',
];

/** Every screen outside the role shows "no access" (RBAC 6.1.1, ERR-AUTH-04). */
async function refusesOthers(page: Page, allowed: string[]) {
  for (const path of ALL_SCREENS.filter((p) => !allowed.includes(p))) {
    await clientNav(page, path);
    await expect(page.getByText("You don't have access to this page."), path).toBeVisible();
  }
}

test('operations manager: UC-01, UC-03 to UC-08 and UC-11 end to end', async ({ page }) => {
  // UC-01 log in → UC-03 monitor the network.
  await login(page, 'sara.m');
  await opens(page, 'Network overview');
  await expect(page.locator('.vz-marker')).toHaveCount(20);

  // UC-04 forecast of the most urgent station, then the totals.
  await page.getByRole('list', { name: 'Stockout alerts' }).getByRole('button').first().click();
  await page.getByRole('link', { name: 'Open forecast' }).click();
  await opens(page, 'Station forecast');
  await expect(page.getByRole('img', { name: /7-day forecast, Harbor Road/ })).toBeVisible();
  await page.getByRole('link', { name: 'Totals' }).click();
  await opens(page, 'Forecast totals');

  // Resources and trips: read-only for the manager.
  await menu(page, 'Resources');
  await opens(page, 'Resources');
  await expect(page.getByRole('button', { name: 'Save resources' })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Resources views' })
    .getByRole('link', { name: /Trips/ })
    .click();
  await opens(page, 'Trips');

  // UC-05 generate the plan → UC-06 edit it (scripted "No risk" reorder).
  await menu(page, 'Delivery plan');
  await opens(page, 'Delivery planner');
  await page.getByRole('button', { name: 'Generate plan' }).click();
  await page.getByRole('button', { name: 'Move Westside Terminal (ST012) down' }).click();
  await expect(page.getByRole('region', { name: 'Impact of your changes' })).toContainText(
    'No risk: this change keeps all deliveries on time and within limits.',
  );

  // UC-07 approve every action after a confirmation; the trips of the day appear.
  await menu(page, 'Approvals');
  await opens(page, 'Review and approve');
  await page.getByRole('button', { name: 'Approve all' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve all' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'decided' })).toBeVisible();

  // UC-08 the decisions are in the history, newest first, read-only.
  await menu(page, 'Decision history');
  await opens(page, 'Decision history');
  await expect(page.getByRole('region', { name: 'Decisions' })).toContainText(
    'of 48, newest first',
  );
  await page.getByRole('region', { name: 'Decisions' }).getByRole('link').first().click();
  await expect(page.getByRole('dialog')).toContainText('View only');
  await page.keyboard.press('Escape');

  // UC-11 stations (D-15).
  await menu(page, 'Stations');
  await opens(page, 'Administration');
  await expect(page.getByRole('region', { name: 'Stations' })).toContainText('ST020');

  await refusesOthers(page, [
    '/network',
    '/forecast',
    '/forecast/totals',
    '/resources',
    '/resources/trips',
    '/planner',
    '/approvals',
    '/history',
    '/admin/stations',
  ]);
});

test('dispatcher: UC-01, UC-02, UC-10 and UC-08 end to end', async ({ page }) => {
  await login(page, 'karim.b');
  await opens(page, 'Resources');

  // UC-02 upload the day's resources.
  await page.getByRole('switch', { name: 'T-06 available' }).click();
  await page.getByRole('button', { name: 'Save resources' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save resources' }).click();
  await expect(page.getByText('Saved as version 4.')).toBeVisible();

  // Warehouse forecast (D-17).
  await menu(page, 'Warehouse forecast');
  await opens(page, 'Warehouse forecast');

  // UC-10 record a trip of the decided day 01 Nov 2026.
  await menu(page, 'Trips');
  await page.getByRole('button', { name: 'Previous day' }).click();
  await page.getByRole('button', { name: 'Previous day' }).click();
  await opens(page, 'Trips');
  const r09 = page.getByRole('listitem').filter({ hasText: 'R-09 · T-03' });
  await r09.getByRole('button', { name: 'Record departure' }).click();
  await page.getByRole('dialog').getByLabel('Time').fill('06:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Record departure' }).click();
  await expect(r09).toContainText('Departed');

  // UC-08 the history, read-only.
  await menu(page, 'Decision history');
  await opens(page, 'Decision history');
  await expect(page.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);

  await refusesOthers(page, [
    '/resources',
    '/resources/trips',
    '/resources/warehouse-forecast',
    '/history',
  ]);
});

test('system admin: UC-01, UC-09, UC-11 and UC-08 end to end', async ({ page }) => {
  await login(page, 'nadia.a');
  await opens(page, 'Administration');

  // UC-09 create an account.
  await page.getByRole('button', { name: 'New user' }).click();
  const dialog = page.getByRole('dialog', { name: 'New user' });
  await dialog.getByLabel('Full name').fill('Hedi K.');
  await dialog.getByLabel('Login').fill('hedi.k');
  await dialog.getByLabel('Initial password').fill('hedi-demo-2026');
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByRole('status')).toHaveText('Hedi K. can now log in as hedi.k.');

  // UC-11 edit a station's delivery window.
  await menu(page, 'Stations');
  await page.getByRole('button', { name: 'Edit ST012 Westside Terminal' }).click();
  await page.getByRole('dialog').getByLabel('Window closes').fill('19:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Changes to ST012 Westside Terminal saved.');

  // UC-08 the history, read-only.
  await menu(page, 'Decision history');
  await opens(page, 'Decision history');

  await refusesOthers(page, ['/admin/users', '/admin/stations', '/history']);
});
