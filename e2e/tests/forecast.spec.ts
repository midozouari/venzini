// UI-03 Station forecast and totals, UC-04 (FR-17 to FR-23, FR-83, FR-85; AC-04, AC-05).
import { expect, test, type Page } from '@playwright/test';
import { clientNav, expectHeading, login, stubTiles } from './helpers';

test.beforeEach(async ({ page }) => {
  await stubTiles(page);
  await login(page, 'sara.m');
  await expect(page).toHaveURL(/\/network$/);
});

test('opens the forecast of a station from the network overview (FR-17)', async ({ page }) => {
  await page.getByRole('list', { name: 'Stockout alerts' }).getByRole('button').first().click();
  await page.getByRole('link', { name: 'Open forecast' }).click();
  await expectHeading(page, 'Station forecast');
  await expect(
    page.getByRole('button', { name: /^Station: Harbor Road \(ST014\)$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /7-day forecast, Harbor Road, Petrol 95/ }),
  ).toBeVisible();
});

test('shows the uncertain ST014 Diesel forecast with its reason (FR-23, BR-27)', async ({
  page,
}) => {
  await clientNav(page, '/forecast?station=ST014&fuel=DIESEL');
  await expect(page.getByText('Overall confidence').locator('..')).toContainText('66%');
  await expect(page.getByText('Uncertain forecast').first()).toBeVisible();
  await expect(
    page.getByText('Confidence is 66%: weather data is missing for 2 of 7 days.'),
  ).toBeVisible();
  await expect(page.getByText('80% range (uncertain)')).toBeVisible();
});

test('shows the short-history ST020 Petrol 95 forecast on a similar-stations baseline (FR-83)', async ({
  page,
}) => {
  await clientNav(page, '/forecast?station=ST020&fuel=P95');
  await expect(page.getByText('Similar-stations baseline')).toBeVisible();
  await expect(
    page.getByText(
      'Little sales history for ST020 Petrol 95: forecast based on similar stations, confidence 60%.',
    ),
  ).toBeVisible();
});

test('changes station and fuel, and shows the 7 days as a table (FR-18, FR-21)', async ({
  page,
}) => {
  await clientNav(page, '/forecast');
  // The searchable picker: type part of a name, ID or region, then choose (keyboard only).
  await page.getByRole('button', { name: /^Station:/ }).click();
  await page.getByPlaceholder('Search by ID, name or region').fill('borj l');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: /^Station: Borj Louzir \(ST005\)$/ }),
  ).toBeFocused();
  await page.getByRole('radio', { name: 'Diesel' }).click();
  await expect(page).toHaveURL(/station=ST005&fuel=DIESEL/);
  await page.getByRole('button', { name: /Show as table/ }).click();
  const table = page.getByRole('table', { name: 'Daily forecast and recent actual sales' });
  await expect(table.getByRole('row')).toHaveCount(15); // header + 7 actual days + 7 forecast days
  await expect(table.getByRole('row', { name: /Tue 03 Nov 2026/ })).toContainText('%');
  // Normal-confidence forecast: no uncertain flag.
  await expect(page.getByText('Uncertain forecast')).toHaveCount(0);
});

async function firstDayTotal(page: Page, caption: string): Promise<number> {
  const cell = page
    .getByRole('table', { name: caption })
    .getByRole('row', { name: /Tue 03 Nov 2026/ })
    .getByRole('cell')
    .first();
  return Number((await cell.innerText()).replace(/[^\d]/g, ''));
}

test('totals: the network total equals the sum of the warehouse totals (FR-85, AC-04)', async ({
  page,
}) => {
  await clientNav(page, '/forecast/totals');
  await expectHeading(page, 'Forecast totals');
  await page.getByRole('button', { name: 'Show as table' }).click();
  const network = await firstDayTotal(page, 'Petrol 95 forecast total, All stations');
  await page.getByRole('radio', { name: 'By warehouse' }).click();
  let sum = 0;
  for (const wh of ['La Soukra Depot', 'Rives Depot', 'Mornag Depot'])
    sum += await firstDayTotal(page, `Petrol 95 forecast total, ${wh}`);
  expect(sum).toBe(network);
  await expect(page.getByText('All active stations are included.')).toBeVisible();
});
