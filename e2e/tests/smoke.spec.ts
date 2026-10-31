import { expect, test } from '@playwright/test';

test('the app loads and shows the Venzini logo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Venzini' })).toBeVisible();
});

test('the browser mock API answers /api/v1 requests (SDD 7.1)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Venzini' })).toBeVisible();
  const result = await page.evaluate(async () => {
    const health = await fetch('/api/v1/health').then((r) => r.json());
    const me = await fetch('/api/v1/me');
    const login = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'venzini' },
      body: JSON.stringify({ login: 'sara.m', password: 'venzini-demo' }),
    }).then((r) => r.json());
    const network = await fetch('/api/v1/network').then((r) => r.json());
    return { health, meStatus: me.status, home: login.home, stations: network.stations.length };
  });
  expect(result).toEqual({
    health: { status: 'ok' },
    meStatus: 401,
    home: '/network',
    stations: 20,
  });
});
