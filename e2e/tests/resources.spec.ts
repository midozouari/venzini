// UI-04 Resources, trips and warehouse forecast: UC-02, UC-10 (FR-07 to FR-13, FR-79, FR-84, FR-85;
// AC-02, AC-19), with the manager's read-only view and the dispatcher's access limits.
import { expect, test, type Page } from '@playwright/test';
import { clientNav, expectHeading, login, stubTiles } from './helpers';

async function asDispatcher(page: Page) {
  await stubTiles(page);
  await login(page, 'karim.b');
  await expect(page.getByRole('region', { name: 'Tankers' })).toBeVisible();
}

async function goToPastDay(page: Page) {
  await page.getByRole('button', { name: 'Previous day' }).click();
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByRole('banner')).toContainText('Sun 01 Nov 2026');
}

test.describe('dispatcher: resources', () => {
  test('saves after a confirmation listing the changes, with the open-trip warning (UC-02, WARN-RES-01)', async ({
    page,
  }) => {
    await asDispatcher(page);
    await expect(page.getByText('Last updated by Karim B.')).toContainText('version 3');
    const warning =
      'Tanker T-06 has not returned from trip R-11. Check before marking it available.';
    await expect(page.getByRole('region', { name: 'Tankers' })).toContainText(warning);
    await expect(page.getByRole('button', { name: 'Save resources' })).toBeDisabled();

    await page.getByRole('switch', { name: 'T-06 available' }).click();
    await page.getByLabel('Stock, Mornag Depot, Petrol 95, litres').fill('25000');
    await expect(page.getByText('2 changes not saved yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Save resources' }).click();

    const dialog = page.getByRole('dialog', { name: 'Save the resources for 03 Nov 2026?' });
    await expect(dialog).toContainText('T-06');
    await expect(dialog).toContainText('17,700 L → 25,000 L');
    await expect(dialog).toContainText(warning);
    await dialog.getByRole('button', { name: 'Save resources' }).click();

    await expect(page.getByText('Saved as version 4.')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Saved as version 4.' })).toContainText(
      warning,
    );
    await expect(page.getByText('Last updated by Karim B.')).toContainText('version 4');
  });

  test('refuses a negative stock under the field and keeps Save disabled', async ({ page }) => {
    await asDispatcher(page);
    await page.getByLabel('Stock, Rives Depot, Diesel, litres').fill('-5');
    await expect(page.getByText('Stock: must be a whole number, 0 or more.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save resources' })).toBeDisabled();
  });

  test('locks the resources of a decided day (BR-30, FR-11)', async ({ page }) => {
    await asDispatcher(page);
    await goToPastDay(page);
    await expect(
      page.getByText(
        'The plan for 01 Nov 2026 is already decided. This data can no longer be changed.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save resources' })).toHaveCount(0);
  });

  test('shows "No resources uploaded for this day" (FR-13)', async ({ page }) => {
    await asDispatcher(page);
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.getByText('No resources uploaded for this day')).toBeVisible();
  });
});

test.describe('dispatcher: trips', () => {
  test('records departure then return, shows the gap, and cancels a planned trip (UC-10, FR-84)', async ({
    page,
  }) => {
    await asDispatcher(page);
    await goToPastDay(page);
    await page
      .getByRole('navigation', { name: 'Resources views' })
      .getByRole('link', { name: /Trips/ })
      .click();
    await expectHeading(page, 'Trips');
    await expect(page.getByText('Plan for 01 Nov 2026 decided: 3 trips to record.')).toBeVisible();
    await expect(page.getByLabel('3 to record')).toBeVisible();

    const r09 = page.getByRole('listitem').filter({ hasText: 'R-09 · T-03' });
    await r09.getByRole('button', { name: 'Record departure' }).click();
    let dialog = page.getByRole('dialog', { name: 'Record the departure of R-09' });
    await dialog.getByLabel('Time').fill('06:00');
    await dialog.getByRole('button', { name: 'Record departure' }).click();
    await expect(r09).toContainText('Departed');

    await r09.getByRole('button', { name: 'Record return' }).click();
    dialog = page.getByRole('dialog', { name: 'Record the return of R-09' });
    await dialog.getByLabel('Time').fill('05:30');
    await dialog.getByRole('button', { name: 'Record return' }).click();
    await expect(dialog.getByRole('alert')).toHaveText(
      'Actual return: must be after the departure',
    );
    await dialog.getByLabel('Time').fill('13:00');
    await dialog.getByRole('button', { name: 'Record return' }).click();
    await expect(r09).toContainText('Returned');
    await expect(r09).toContainText('Gap −40 min (−8.7%)');

    const r12 = page.getByRole('listitem').filter({ hasText: 'R-12 · T-05' });
    await r12.getByRole('button', { name: 'Cancel trip' }).click();
    dialog = page.getByRole('dialog', { name: 'Cancel trip R-12?' });
    await dialog.getByRole('button', { name: 'Cancel trip' }).click();
    await expect(dialog.getByText('Reason is required.')).toBeVisible();
    await dialog.getByLabel('Reason').fill('Tanker breakdown');
    await dialog.getByRole('button', { name: 'Cancel trip' }).click();
    await expect(r12).toContainText('Cancelled');
    await expect(r12).toContainText('Reason: Tanker breakdown');
    await expect(page.getByLabel('1 to record')).toBeVisible();
  });

  test('says when a day has no trips yet', async ({ page }) => {
    await asDispatcher(page);
    await page
      .getByRole('navigation', { name: 'Resources views' })
      .getByRole('link', { name: /Trips/ })
      .click();
    await expect(page.getByText('No trips for 03 Nov 2026')).toBeVisible();
  });
});

test('dispatcher: warehouse forecast shows warehouse totals only (D-17)', async ({ page }) => {
  await asDispatcher(page);
  await page.getByRole('link', { name: 'Warehouse forecast' }).first().click();
  await expectHeading(page, 'Warehouse forecast');
  for (const wh of ['La Soukra Depot', 'Rives Depot', 'Mornag Depot'])
    await expect(
      page.getByRole('region', { name: `Petrol 95 forecast total, ${wh}` }),
    ).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Network' })).toHaveCount(0);
  await clientNav(page, '/forecast');
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
});

test('manager: resources and trips are read-only (FR-04, FR-79)', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'sara.m');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Resources' })
    .click();
  await expect(page.getByRole('region', { name: 'Tankers' })).toContainText('Not available');
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save resources' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Warehouse forecast' })).toHaveCount(0);
  await goToPastDay(page);
  await page
    .getByRole('navigation', { name: 'Resources views' })
    .getByRole('link', { name: /Trips/ })
    .click();
  await expect(page.getByText('Gap +45 min (+9.4%)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Record/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel trip' })).toHaveCount(0);
});
