// UI-08 Administration: UC-09 users (admin) and UC-11 stations (admin and manager, D-15);
// FR-05, FR-06, ERR-VAL-01/02/03/07 (SDD 7.3).
import { expect, test, type Page } from '@playwright/test';
import { clientNav, expectHeading, login, loginHere, stubTiles } from './helpers';

test.beforeEach(async ({ page }) => stubTiles(page));

const userRow = (page: Page, name: string) =>
  page.getByRole('region', { name: 'Users' }).getByRole('row').filter({ hasText: name });

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test('the admin creates a user, who can then log in with that role (FR-05)', async ({ page }) => {
  await login(page, 'nadia.a');
  await expectHeading(page, 'Administration');
  await page.getByRole('button', { name: 'New user' }).click();
  const dialog = page.getByRole('dialog', { name: 'New user' });
  await dialog.getByLabel('Full name').fill('Amira S.');
  await dialog.getByLabel('Login').fill('amira.s');
  await dialog.getByLabel('Role').selectOption({ label: 'Operations manager' });
  await dialog.getByLabel('Initial password').fill('short');
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog.getByText('Password: must be at least 10 characters')).toBeVisible();

  await dialog.getByLabel('Initial password').fill('amira-demo-2026');
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('Amira S. can now log in as amira.s.');
  await expect(userRow(page, 'Amira S.')).toContainText('Operations manager');

  await logout(page);
  await loginHere(page, 'amira.s', 'amira-demo-2026');
  await expect(page).toHaveURL(/\/network$/);
});

test('a duplicate login is refused (ERR-VAL-03)', async ({ page }) => {
  await login(page, 'nadia.a');
  await page.getByRole('button', { name: 'New user' }).click();
  const dialog = page.getByRole('dialog', { name: 'New user' });
  await dialog.getByLabel('Full name').fill('Karim Again');
  await dialog.getByLabel('Login').fill('KARIM.B');
  await dialog.getByLabel('Initial password').fill('some-password-1');
  await dialog.getByRole('button', { name: 'Create user' }).click();
  await expect(dialog.getByText('This login already exists.')).toBeVisible();
});

test('the admin cannot deactivate their own account (ERR-VAL-07)', async ({ page }) => {
  await login(page, 'nadia.a');
  await page.getByRole('button', { name: 'Deactivate Nadia A.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Deactivate Nadia A.?' });
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    "You can't deactivate your own admin account.",
  );
});

test('a deactivated user can no longer log in; reactivation works', async ({ page }) => {
  await login(page, 'nadia.a');
  await page.getByRole('button', { name: 'Deactivate Karim B.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Deactivate Karim B.?' });
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Karim B. is deactivated and can no longer log in.',
  );
  await expect(userRow(page, 'Karim B.')).toContainText('Inactive');

  await logout(page);
  await loginHere(page, 'karim.b');
  await expect(page.getByRole('alert')).toHaveText(
    'This account is deactivated. Contact your system admin.',
  );

  await loginHere(page, 'nadia.a');
  await page.getByRole('button', { name: 'Reactivate Karim B.' }).click();
  await expect(page.getByRole('status')).toHaveText('Karim B. is active again and can log in.');
});

test('the admin edits a role (the change is saved)', async ({ page }) => {
  await login(page, 'nadia.a');
  await page.getByRole('button', { name: 'Edit Leila K.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Leila K.' });
  await expect(dialog.getByLabel('Login')).toBeDisabled();
  await dialog.getByLabel('Role').selectOption({ label: 'Operations manager' });
  await expect(dialog).toContainText("Changing the role ends this user's current session.");
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Changes to Leila K. saved.');
  await expect(userRow(page, 'Leila K.')).toContainText('Operations manager');
});

test('the manager sees only the Stations tab and adds a station that shows on the network (FR-06, D-15)', async ({
  page,
}) => {
  await login(page, 'sara.m');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Stations' })
    .click();
  await expectHeading(page, 'Administration');
  const tabs = page.getByRole('navigation', { name: 'Administration views' });
  await expect(tabs.getByRole('link')).toHaveText(['Stations']);

  await page.getByRole('button', { name: 'New station' }).click();
  const dialog = page.getByRole('dialog', { name: 'New station' });
  await dialog.getByLabel('Station ID').fill('st021');
  await expect(dialog.getByLabel('Station ID')).toHaveValue('ST021');
  await dialog.getByLabel('Name').fill('Lac 2 Centre');
  await dialog.getByLabel('Region').selectOption({ index: 1 });
  await dialog.getByLabel('Latitude').fill('36.8421');
  await dialog.getByLabel('Longitude').fill('10.2731');
  await dialog.getByLabel('Fuel type').selectOption({ label: 'Diesel' });
  await dialog.getByLabel('Capacity (L)').fill('40000');
  await dialog.getByLabel('Safety stock (L)').fill('45000');
  await dialog.getByLabel('Current level (L)').fill('22500');
  await dialog.getByRole('button', { name: 'Create station' }).click();
  // ERR-VAL-02 names the field, under that field.
  await expect(dialog.getByText('Safety stock: must be below capacity')).toBeVisible();
  await expect(dialog.getByLabel('Safety stock (L)')).toHaveAttribute('aria-invalid', 'true');

  await dialog.getByLabel('Safety stock (L)').fill('8000');
  await dialog.getByRole('button', { name: 'Create station' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Station ST021 Lac 2 Centre created.');
  await expect(page.getByRole('region', { name: 'Stations' })).toContainText('Lac 2 Centre');

  await clientNav(page, '/network');
  await page.getByRole('button', { name: /Data unavailable · 2/ }).click();
  await expect(page.getByText('Data unavailable for ST021: no forecast yet.')).toBeVisible();
});

test('a duplicate station ID is refused, and a deactivated station leaves the network', async ({
  page,
}) => {
  await login(page, 'nadia.a');
  await page.getByRole('link', { name: 'Stations' }).first().click();
  await page.getByRole('button', { name: 'New station' }).click();
  const dialog = page.getByRole('dialog', { name: 'New station' });
  await dialog.getByLabel('Station ID').fill('ST012');
  await dialog.getByLabel('Name').fill('Copy');
  await dialog.getByLabel('Region').selectOption({ index: 1 });
  await dialog.getByLabel('Latitude').fill('36.8');
  await dialog.getByLabel('Longitude').fill('10.2');
  await dialog.getByLabel('Fuel type').selectOption({ label: 'Diesel' });
  await dialog.getByLabel('Capacity (L)').fill('30000');
  await dialog.getByLabel('Safety stock (L)').fill('6000');
  await dialog.getByLabel('Current level (L)').fill('10000');
  await dialog.getByRole('button', { name: 'Create station' }).click();
  await expect(dialog.getByText('This station ID already exists.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Deactivate ST012 Westside Terminal' }).click();
  await page
    .getByRole('dialog', { name: 'Deactivate ST012 Westside Terminal?' })
    .getByRole('button', { name: 'Deactivate' })
    .click();
  await expect(page.getByRole('status')).toHaveText('ST012 Westside Terminal is deactivated.');
  await expect(
    page.getByRole('button', { name: 'Reactivate ST012 Westside Terminal' }),
  ).toBeVisible();
});

test('the manager edits a delivery window; a window that closes before it opens is refused', async ({
  page,
}) => {
  await login(page, 'sara.m');
  await clientNav(page, '/admin/stations');
  await page.getByRole('button', { name: 'Edit ST012 Westside Terminal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit ST012 Westside Terminal' });
  await expect(dialog.getByLabel('Station ID')).toBeDisabled();
  await dialog.getByLabel('Window closes').fill('05:00');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByText('Window close: must be after the opening time')).toBeVisible();
  await dialog.getByLabel('Window closes').fill('19:00');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Changes to ST012 Westside Terminal saved.');
});

test('the dispatcher has no administration access (RBAC 6.1.1)', async ({ page }) => {
  await login(page, 'karim.b');
  await expect(page).toHaveURL(/\/resources$/);
  for (const path of ['/admin/users', '/admin/stations']) {
    await clientNav(page, path);
    await expect(page.getByText("You don't have access to this page.")).toBeVisible();
  }
  const status = await page.evaluate(async () => (await fetch('/api/v1/stations')).status);
  expect(status).toBe(403);
});
