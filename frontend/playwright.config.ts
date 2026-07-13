import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the running dev/docker stack (frontend on :5173,
 * backend on :3000). Start both before running `npx playwright test`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    // Skip the intro splash so tests go straight to the app.
    storageState: undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
