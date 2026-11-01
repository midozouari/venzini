// UI-02 Network overview, UC-03 (FR-14 to FR-16, AC-03).
import { expect, test } from '@playwright/test';
import { expectHeading, login, stubTiles } from './helpers';

test.describe('network overview', () => {
  test('shows a marker per station (a grey one without data), the warehouses and the key figures (FR-14)', async ({
    page,
  }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    await expectHeading(page, 'Network overview');
    await expect(page.locator('.vz-marker')).toHaveCount(20);
    await expect(page.locator('.vz-marker.vz-marker--nodata')).toHaveCount(1);
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

  test('shows a station without data as a grey "no data" marker that opens its reason', async ({
    page,
  }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    const marker = page.locator('.leaflet-marker-icon[title$="(ST017), no data"]');
    await expect(marker.locator('.vz-marker--nodata')).toBeVisible();
    await marker.click();
    await expect(
      page.getByRole('region').getByText('Data unavailable for ST017: no tank level.'),
    ).toBeVisible();
  });

  test('keeps the stations on a plain background when the map is unavailable (ERR-SYS-03)', async ({
    page,
  }) => {
    await stubTiles(page, 'fail');
    await login(page, 'sara.m');
    await expect(
      page.getByText('Map background unavailable; routes are still shown.'),
    ).toBeVisible();
    await expect(page.locator('.vz-marker')).toHaveCount(20);
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

  test('puts the map card on top and the KPI row below it, all visible without scrolling', async ({
    page,
  }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    await expect(page.locator('.vz-marker')).toHaveCount(20);
    const box = async (name: string) => (await page.getByRole('region', { name }).boundingBox())!;
    const map = await box('Network map');
    const kpis = await box('Key figures');
    const risk = (await page
      .getByRole('heading', { name: 'Stations at highest risk' })
      .boundingBox())!;
    expect(map.y + map.height).toBeLessThanOrEqual(kpis.y); // map above the KPI row
    expect(map.x + map.width).toBeLessThanOrEqual(risk.x); // risk panel to the right
    expect(map.height).toBeGreaterThan(300);
    // At 1366×768 the KPI cards and the main action stay on screen, with no page scroll.
    expect(kpis.y + kpis.height).toBeLessThanOrEqual(768);
    await expect(page.getByRole('link', { name: 'Plan deliveries' })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      768,
    );
  });

  test('shows the warehouse stock in a dialog, without resizing the map', async ({ page }) => {
    await stubTiles(page);
    await login(page, 'sara.m');
    // While the dialog is open the rest of the page is hidden from assistive technology
    // (correct modal behavior), so the map card is found by its label attribute.
    const map = page.locator('[aria-label="Network map"]');
    // Measure once the layout is final: markers drawn and the Inter font loaded.
    await expect(page.locator('.vz-marker')).toHaveCount(20);
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

  // Regression: browsers stop an idle service worker (e.g. in a background tab). The restarted
  // worker no longer knew the page, requests reached the web server, and the risk panel showed
  // "The network could not be loaded" with the plan-edit wording of ERR-SYS-01.
  test('keeps working after the browser restarts the mock worker', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'stopping a service worker needs Chromium DevTools');
    await stubTiles(page);
    await login(page, 'sara.m');
    await expect(page.locator('.vz-marker')).toHaveCount(20);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');

    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(page.getByRole('region', { name: 'Key figures' })).toContainText(
      'No resources uploaded for this day.',
    );
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(
      page.getByRole('list', { name: 'Stockout alerts' }).getByRole('button'),
    ).toHaveCount(3);
    await expect(page.getByText('The network could not be loaded')).toHaveCount(0);
  });
});
