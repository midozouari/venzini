// UI-07 Decision history: UC-08 list, filters, detail, read-only for all roles (FR-72, FR-73,
// NFR-14; SDD 7.3).
import { expect, test, type Page } from '@playwright/test';
import { clientNav, expectHeading, login, openPlanner, stubTiles } from './helpers';

test.beforeEach(async ({ page }) => stubTiles(page));

async function openHistory(page: Page, who: string) {
  await login(page, who);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Decision history' })
    .click();
  await expectHeading(page, 'Decision history');
}

const table = (page: Page) => page.getByRole('region', { name: 'Decisions' });
const rows = (page: Page) => table(page).locator('tbody tr');

for (const who of ['sara.m', 'karim.b', 'nadia.a'])
  test(`${who} reads the history newest first, with no edit or delete control`, async ({
    page,
  }) => {
    await openHistory(page, who);
    await expect(page.getByText('View only').first()).toBeVisible();
    await expect(rows(page)).toHaveCount(20);
    await expect(rows(page).first()).toContainText('17:04, 31 Oct 2026');
    await expect(rows(page).first()).toContainText('Rejected');
    await expect(rows(page).first()).toContainText('Not dispatched');
    await expect(table(page)).toContainText('1–20 of 30, newest first');
    await expect(page.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);
  });

test('filters by action and search, and pages through the list', async ({ page }) => {
  await openHistory(page, 'karim.b');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(table(page)).toContainText('21–30 of 30, newest first');
  await expect(rows(page)).toHaveCount(10);

  await page.getByLabel('Action').selectOption({ label: 'Modified' });
  await expect(page).toHaveURL(/\/history\?type=modified$/);
  await expect(rows(page)).toHaveCount(7);

  await page.getByRole('searchbox').fill('ST015');
  await expect(rows(page)).toHaveCount(1);
  await expect(page).toHaveURL(/q=ST015/);

  await page.getByRole('searchbox').fill('nobody here');
  await expect(page.getByText('No decisions match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(rows(page)).toHaveCount(20);
});

test('refuses a date range that ends before it starts', async ({ page }) => {
  await openHistory(page, 'sara.m');
  await page.getByLabel('From').fill('2026-10-30');
  await page.getByLabel('To').fill('2026-10-20');
  await expect(page.getByRole('alert')).toHaveText('To: must be on or after the start date');
  await page.getByLabel('To').fill('2026-10-30');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(rows(page).first()).toContainText('30 Oct 2026');
});

test('opens an entry with the keyboard and returns to the same row', async ({ page }) => {
  await openHistory(page, 'nadia.a');
  await page.getByRole('searchbox').fill('ST015');
  await expect(rows(page)).toHaveCount(1);
  const link = rows(page).getByRole('link');
  await link.focus();
  await page.keyboard.press('Enter');

  const panel = page.getByRole('dialog', { name: 'Approved: ST015 Mornag Plain' });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/history\/[0-9a-f-]+\?q=ST015$/);
  await expect(panel).toContainText('View only');
  const compare = panel.getByRole('table');
  await expect(compare.getByRole('row', { name: /Tanker/ })).toContainText('T-05');
  await expect(compare.getByRole('row', { name: /Tanker/ })).toContainText('T-06Changed');
  await expect(panel).toContainText('Moved ST015 to tanker T-06.');
  await expect(panel).toContainText('This change makes ST015 arrive 101 min later than planned.');
  await expect(panel).toContainText('+$8.60');
  await expect(panel.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/\/history\?q=ST015$/);
  await expect(link).toBeFocused();
});

test('an unknown entry says so', async ({ page }) => {
  await openHistory(page, 'karim.b');
  await clientNav(page, '/history/not-an-entry');
  await expect(page.getByRole('dialog')).toContainText("We couldn't find this decision.");
});

test('a decision made in Approvals appears at the top (FR-72)', async ({ page }) => {
  await openPlanner(page);
  await page.getByRole('link', { name: 'Go to approvals' }).click();
  await expectHeading(page, 'Review and approve');
  await page
    .getByRole('listitem', { name: /\(ST012\)$/ })
    .getByRole('button', { name: 'Approve ST012' })
    .click();
  await expect(page.getByRole('status').filter({ hasText: 'ST012 approved.' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Decision history' })
    .click();
  await expect(table(page)).toContainText('1–20 of 31, newest first');
  await expect(rows(page).first()).toContainText('Sara M.');
  await expect(rows(page).first()).toContainText('ST012');
  await rows(page).first().getByRole('link').click();
  await expect(page.getByRole('dialog', { name: /^Approved: ST012/ })).toContainText(
    'delivery day 03 Nov 2026',
  );
});
