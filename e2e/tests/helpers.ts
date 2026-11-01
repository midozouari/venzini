import { expect, type Page } from '@playwright/test';

/**
 * Map tiles for tests. The mock service worker fetches every request itself, so Playwright cannot
 * stub tile requests; instead the app reads its tile source from a test hook set before start.
 * 'ok' = a blank image served from memory (offline); 'fail' = an address that refuses at once.
 */
const BLANK_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export async function stubTiles(page: Page, mode: 'ok' | 'fail' = 'ok') {
  const tileUrl = mode === 'ok' ? BLANK_TILE : 'http://127.0.0.1:9/{z}/{x}/{y}.png';
  await page.addInitScript((url) => {
    (window as unknown as { __VENZINI_TEST__: { tileUrl: string } }).__VENZINI_TEST__ = {
      tileUrl: url,
    };
  }, tileUrl);
}

export const DEMO_PASSWORD = 'venzini-demo';

export async function login(page: Page, who: string, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Login').fill(who);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** Logs in on the login page already shown, without a reload (a reload resets the mock API). */
export async function loginHere(page: Page, who: string, password = DEMO_PASSWORD) {
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Login').fill(who);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** In-app navigation without a page reload (a reload resets the mock API, AC-21). */
export async function clientNav(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

export async function expectHeading(page: Page, title: string) {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

/** The manager opens the planner from the network overview and generates the day's plan. */
export async function openPlanner(page: Page) {
  await stubTiles(page);
  await login(page, 'sara.m');
  await expect(page).toHaveURL(/\/network$/);
  await page.getByRole('link', { name: 'Plan deliveries' }).click();
  await expectHeading(page, 'Delivery planner');
  await page.getByRole('button', { name: 'Generate plan' }).click();
  await expect(page.getByRole('region', { name: 'Routes' })).toBeVisible();
}
