import { defineConfig, devices } from '@playwright/test';

/**
 * Frontend runs on :3000, backend API on :4000 (NOT :3001 — that's a stale assumption
 * from the original spec; verified against backend/.env.example and server.js this repo).
 * Both servers are expected to already be running (see README) — Next.js dev-server
 * boot time is too unpredictable to drive reliably from Playwright's own webServer.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // The backend's login/register limiters are IP-keyed (5 req/15min, not
  // per-account), and the catalog limiter is 60/min — all shared across every
  // test hitting localhost:4000. Running fully parallel floods them within
  // seconds and produces mass 429s that look like broken tests but aren't.
  // Serial execution is what makes this suite viable against the real limits.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] }, // mobile WebKit, 390x844
    },
  ],
});
