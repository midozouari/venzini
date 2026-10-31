import { defineConfig, devices } from '@playwright/test';

// MVP end-to-end suite (SDD 8.1). Chrome, Firefox and Edge at 1366×768 (NFR-16).
const viewport = { width: 1366, height: 768 };
// The suite runs on the production MVP build (SDD 8.4, AC-21), served by `vite preview`.
const baseURL = 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport } },
  ],
  webServer: {
    command:
      'pnpm --filter @venzini/web build && pnpm --filter @venzini/web preview --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
