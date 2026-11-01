// UI-05 Delivery planner: UC-05 generate, UC-06 edits with the scripted outcomes of SDD 7.2
// (FR-38, FR-43 to FR-46, FR-54 to FR-60, FR-65, FR-66, FR-75 to FR-77).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { clientNav, login, openPlanner, stubTiles } from './helpers';

const NO_RISK = 'No risk: this change keeps all deliveries on time and within limits.';
const OVERLOAD = 'Tanker T-02 is overloaded: 34,000 L on a 32,000 L tanker.';

const card = (page: Page, tanker: string, route: string) =>
  page.getByRole('listitem', { name: `${tanker}, route ${route}` });
const handle = (page: Page, name: string) =>
  page.getByRole('button', { name: `Drag ${name} to reorder or move it` });
const impact = (page: Page) => page.getByRole('region', { name: 'Impact of your changes' });

async function expand(page: Page, tanker: string, route: string) {
  await card(page, tanker, route).getByRole('button', { expanded: false }).first().click();
}

/** A real pointer drag, in small steps, so dnd-kit sees it like a person's drag. */
async function drag(page: Page, from: Locator, to: Locator) {
  await to.scrollIntoViewIfNeeded();
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 8, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 28), { steps: 16 });
  await page.mouse.up();
}

test('generates the plan: routes on the map, tanker filter and unserved reasons in full (UC-05, FR-38, FR-54)', async ({
  page,
}) => {
  await openPlanner(page);
  await expect(page.locator('.vz-stop')).toHaveCount(17);
  await expect(impact(page)).toContainText('Optimal plan, no changes');
  await expect(page.getByRole('region', { name: 'Not served today' })).toContainText(
    "ST019 is not served today: Diesel needs 11,700 L, but the tankers of WH-RIV have at most 11,500 L left. It moves up in tomorrow's plan.",
  );
  await page.getByRole('radio', { name: 'T-01' }).click();
  await expect(page.locator('.vz-stop')).toHaveCount(2);
  await page.getByRole('radio', { name: 'All routes' }).click();
  await expect(page.locator('.vz-stop')).toHaveCount(17);
});

test('demo 1: dragging ST012 onto T-02 overloads it and blocks approval; Reset restores the optimal plan (FR-56, FR-60, FR-77)', async ({
  page,
}) => {
  await openPlanner(page);
  await drag(page, handle(page, 'Westside Terminal (ST012)'), card(page, 'T-02', 'R-02'));
  const banner = page.getByRole('alert').filter({ hasText: 'Approval is blocked.' });
  await expect(banner).toContainText(OVERLOAD);
  await expect(card(page, 'T-02', 'R-02')).toContainText('Overloaded');
  await expect(impact(page)).toContainText('+$4.65 (+3.6%)');

  // Clicking a risk highlights it on the map (FR-65).
  await banner.getByRole('button', { name: 'Show on map' }).click();
  await expect(page.locator('.vz-route--hl').first()).toBeAttached();

  await page.getByRole('button', { name: 'Reset to optimal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset to the optimal plan?' });
  await dialog.getByRole('button', { name: 'Reset to optimal' }).click();
  await expect(banner).toHaveCount(0);
  await expect(impact(page)).toContainText('Optimal plan, no changes');
});

test('demo 1 by keyboard: "Move to tanker…" offers only tankers of the same warehouse (SDD 5.12.6)', async ({
  page,
}) => {
  await openPlanner(page);
  await page
    .getByRole('button', { name: 'Move Westside Terminal (ST012) to another tanker' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Move ST012 to another tanker' });
  await expect(dialog.getByRole('radio')).toHaveCount(1);
  await expect(dialog.getByRole('radio', { name: /T-02/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Move to T-02' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Approval is blocked.' })).toContainText(
    OVERLOAD,
  );
});

test('demo 2: moving ST003 to stop 3 on T-03 gives a medium RISK-04 (FR-55, FR-63, FR-64)', async ({
  page,
}) => {
  await openPlanner(page);
  await expand(page, 'T-03', 'R-03');
  await drag(
    page,
    handle(page, 'La Marsa Corniche (ST003)'),
    card(page, 'T-03', 'R-03').getByRole('listitem').filter({ hasText: 'ST005' }),
  );
  const stops = card(page, 'T-03', 'R-03').getByRole('list', { name: 'Stops of T-03' });
  await expect(stops.getByRole('listitem').last()).toContainText('ST003');
  await expect(impact(page)).toContainText(
    'This change makes ST003 arrive 90 min later than planned.',
  );
  await expect(impact(page)).toContainText('Medium');
});

test('demo 3: moving ST012 down on T-01 keeps every delivery on time: "No risk" (FR-66)', async ({
  page,
}) => {
  await openPlanner(page);
  await page.getByRole('button', { name: 'Move Westside Terminal (ST012) down' }).click();
  await expect(impact(page)).toContainText(NO_RISK);
  const stops = card(page, 'T-01', 'R-01').getByRole('list', { name: 'Stops of T-01' });
  await expect(stops.getByRole('listitem').first()).toContainText('ST014');
});

test('demo 4: a quantity above the limit shows ERR-VAL-05a and cannot be saved (FR-75, FR-76, FR-59)', async ({
  page,
}) => {
  await openPlanner(page);
  await page.getByRole('button', { name: /Westside Terminal · ST012/ }).click();
  await page.getByRole('button', { name: 'Edit quantity of Petrol 95 for ST012' }).click();
  const dialog = page.getByRole('dialog', { name: 'Petrol 95 for ST012' });
  await expect(dialog).toContainText('Max for this stop: 6,400 L.');
  const litres = dialog.getByLabel('Litres');
  await litres.fill('7000');
  await expect(dialog.getByRole('alert')).toHaveText(
    'This quantity exceeds the space left on tanker T-01. Enter 6,400 L or less.',
  );
  await expect(dialog.getByRole('button', { name: 'Save quantity' })).toBeDisabled();
  await litres.fill('6400');
  await dialog.getByRole('button', { name: 'Save quantity' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('New optimal plan made with the changed quantity for ST012.'),
  ).toBeVisible();
  await expect(card(page, 'T-01', 'R-01')).toContainText('Petrol 95 6,400 L');
});

test('refuses a drop on a tanker of another warehouse (WARN-EDIT-01)', async ({ page }) => {
  await openPlanner(page);
  await drag(page, handle(page, 'Westside Terminal (ST012)'), card(page, 'T-03', 'R-03'));
  await expect(page.getByRole('alert')).toContainText(
    'This tanker loads at another warehouse. Stations can only move between tankers of WH-RIV.',
  );
  await expect(impact(page)).toContainText('Optimal plan, no changes');
});

test('dispatcher and admin cannot open the planner or approvals (RBAC 6.1.1)', async ({ page }) => {
  await stubTiles(page);
  await login(page, 'karim.b');
  await expect(page.getByRole('region', { name: 'Tankers' })).toBeVisible();
  await clientNav(page, '/planner');
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
  await clientNav(page, '/approvals');
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
});
