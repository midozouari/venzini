// UI-02 Network overview, UC-03 (FR-14 to FR-16, AC-03).
import { expect, test } from '@playwright/test';
import { expectHeading, login, stubTiles } from './helpers';

test.describe('network overview', () => {
  test('shows a marker per station with data, the warehouses and the key figures (FR-14)', async ({
    page,
  }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    await expectHeading(page, 'Network overview');
    await expect(page.locator('.vz-marker')).toHaveCount(19);
    await expect(page.locator('.vz-warehouse')).toHaveCount(3);
    const kpis = page.getByRole('region', { name: 'Key figures' });
    await expect(kpis).toContainText('High-risk stations3of 20 stations');
    await expect(kpis).toContainText('Tankers available5 of 6');
    await expect(kpis).toContainText('No plan yet');
    await expect(page.getByRole('banner')).toContainText('Tue 03 Nov 2026');
  });

  test('lists high-risk alerts, shortest time first, with their reason (FR-15)', async ({
    page,
  }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    const alerts = page.getByRole('list', { name: 'Stockout alerts' }).getByRole('button');
    await expect(alerts).toHaveCount(3);
    await expect(alerts.nth(0)).toContainText('Harbor Road');
    await expect(alerts.nth(0)).toContainText(
      'ST014 is high risk: current Diesel stock covers 14 hours of forecast demand.',
    );
    await expect(alerts.nth(1)).toContainText('Borj Louzir');
    await expect(alerts.nth(2)).toContainText('Bardo Road');
  });

  test('opens station details from the list by keyboard, and closes with Esc (FR-16, NFR-27)', async ({
    page,
  }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    const first = page.getByRole('list', { name: 'Stockout alerts' }).getByRole('button').first();
    await first.focus();
    await page.keyboard.press('Enter');
    const details = page.getByRole('region', { name: 'Harbor Road' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('Diesel');
    await expect(details).toContainText('Safety stock 3,500 L');
    await expect(details.getByRole('link', { name: 'Open forecast' })).toHaveAttribute(
      'href',
      '/forecast?station=ST014',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Stockout alerts' })).toBeVisible();
  });

  test('opens station details from a map marker', async ({ page }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    // An isolated station: close stations can overlap at the overview zoom (list or zoom reach them).
    await page.locator('.leaflet-marker-icon[title^="Borj Cedria (ST018)"]').click();
    await expect(page.getByRole('region', { name: 'Borj Cedria' })).toBeVisible();
  });

  test('reveals medium, low and no-data stations on demand', async ({ page }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    await page.getByRole('button', { name: /Medium risk · 5/ }).click();
    await page.getByRole('button', { name: /Data unavailable · 1/ }).click();
    await expect(page.getByText('Data unavailable for ST017: no tank level.')).toBeVisible();
  });

  test('keeps the stations on a plain background when the map is unavailable (ERR-SYS-03)', async ({
    page,
  }) => {
    await stubTiles(page, 'fail');
    await login(page, 'sara.m');
    await expect(
      page.getByText('Map background unavailable; routes are still shown.'),
    ).toBeVisible();
    await expect(page.locator('.vz-marker')).toHaveCount(19);
  });

  test('changes the delivery day from the top bar', async ({ page }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(page.getByRole('banner')).toContainText('Wed 04 Nov 2026');
    await expect(page.getByRole('region', { name: 'Key figures' })).toContainText(
      'No resources uploaded for this day.',
    );
  });

  test('keeps the map in its own card: nothing overlaps it (design revision)', async ({ page }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    await expect(page.locator('.vz-marker')).toHaveCount(19);
    const box = async (name: string) => (await page.getByRole('region', { name }).boundingBox())!;
    const map = await box('Network map');
    const kpis = await box('Key figures');
    const risk = (await page
      .getByRole('heading', { name: 'Stations at highest risk' })
      .boundingBox())!;
    expect(kpis.y + kpis.height).toBeLessThanOrEqual(map.y); // KPI row above the map
    expect(map.x + map.width).toBeLessThanOrEqual(risk.x); // risk panel to the right
    expect(map.height).toBeGreaterThan(300);
  });

  test('shows the warehouse stock in a dialog, without resizing the map', async ({ page }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    // While the dialog is open the rest of the page is hidden from assistive technology
    // (correct modal behavior), so the map card is found by its label attribute.
    const map = page.locator('[aria-label="Network map"]');
    // Measure once the layout is final: markers drawn and the Inter font loaded.
    await expect(page.locator('.vz-marker')).toHaveCount(19);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const before = (await map.boundingBox())!;
    await page.getByRole('button', { name: 'Show stock' }).click();
    const dialog = page.getByRole('dialog', { name: 'Warehouse stock' });
    await expect(dialog).toContainText('Rives Depot');
    await expect(dialog).toContainText('480,000 L');
    expect((await map.boundingBox())!.height).toBeCloseTo(before.height, 0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
