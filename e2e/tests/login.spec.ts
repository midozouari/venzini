// UI-01, UC-01 for each role, with the error states (SDD 7.3).
import { expect, test } from '@playwright/test';
import { clientNav, expectHeading, login, stubTiles } from './helpers';

test.beforeEach(async ({ page }) => stubTiles(page));

const ROLES = [
  {
    who: 'sara.m',
    name: 'Sara M.',
    role: 'Operations manager',
    home: '/network',
    title: 'Network overview',
    menu: [
      'Network',
      'Forecasts',
      'Resources',
      'Delivery plan',
      'Approvals',
      'Stations',
      'Decision history',
    ],
  },
  {
    who: 'karim.b',
    name: 'Karim B.',
    role: 'Dispatcher',
    home: '/resources',
    title: 'Resources',
    menu: ['Resources', 'Trips', 'Warehouse forecast', 'Decision history'],
  },
  {
    who: 'nadia.a',
    name: 'Nadia A.',
    role: 'System admin',
    home: '/admin/users',
    title: 'Users',
    menu: ['Users', 'Stations', 'Decision history'],
  },
];

for (const r of ROLES)
  test(`${r.role} logs in and lands on the home page with the role's menu`, async ({ page }) => {
    await login(page, r.who);
    await expect(page).toHaveURL(new RegExp(`${r.home}$`));
    await expectHeading(page, r.title);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('list').getByRole('link')).toHaveText([...r.menu]);
    const topBar = page.getByRole('banner');
    await expect(topBar.getByText(r.name, { exact: true })).toBeVisible();
    await expect(topBar.getByText(r.role, { exact: true })).toBeVisible();
  });

test('a wrong password shows ERR-AUTH-01 and stays on the login page', async ({ page }) => {
  await login(page, 'sara.m', 'wrong-password');
  await expect(page.getByRole('alert')).toHaveText('Login or password is incorrect.');
  await expect(page).toHaveURL(/\/login$/);
});

test('a deactivated account and a locked account are refused (ERR-AUTH-02, ERR-AUTH-03)', async ({
  page,
}) => {
  await login(page, 'omar.b');
  await expect(page.getByRole('alert')).toHaveText(
    'This account is deactivated. Contact your system admin.',
  );
  await page.getByLabel('Login').fill('rania.m');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Too many attempts. Try again in 12 minutes.');
});

test('a protected page sends to login, then back to that page (FR-01)', async ({ page }) => {
  await page.goto('/admin/stations');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fstations$/);
  await page.getByLabel('Login').fill('sara.m');
  await page.getByLabel('Password', { exact: true }).fill('venzini-demo');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/stations$/);
  await expectHeading(page, 'Stations');
});

test('a page outside the role shows "no access" (ERR-AUTH-04)', async ({ page }) => {
  await login(page, 'karim.b');
  await expect(page).toHaveURL(/\/resources$/);
  await clientNav(page, '/network');
  await expect(page.getByText("You don't have access to this page.")).toBeVisible();
  await page.getByRole('link', { name: 'Go to my home page' }).click();
  await expect(page).toHaveURL(/\/resources$/);
});

test('logout ends the session', async ({ page }) => {
  await login(page, 'nadia.a');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await clientNav(page, '/admin/users');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('screens of later steps open a calm placeholder', async ({ page }) => {
  await login(page, 'sara.m');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Approvals' })
    .click();
  await expectHeading(page, 'Review and approve');
  await expect(page.getByText('This screen arrives in Step 2c of the MVP.')).toBeVisible();
});
