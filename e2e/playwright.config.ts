import { defineConfig, devices } from '@playwright/test';

// MVP end-to-end suite (SDD 8.1). Chrome, Firefox and Edge at 1366×768 (NFR-16).
const viewport = { width: 1366, height: 768 };
const baseURL = 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
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
    command: 'pnpm --filter @venzini/web dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
