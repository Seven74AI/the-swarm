import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
  // E2E runs against a production bundle served by `vite preview`: page loads are
  // much cheaper than the dev server's per-module transforms (~25% faster suite),
  // and it tests what actually ships. E2E_BUILD=1 adds the harness pages to the
  // build (see vite.config.ts). A dev server already on :5173 is reused locally.
  webServer: {
    command: 'pnpm exec vite build && pnpm exec vite preview --outDir dist-e2e --port 5173 --strictPort',
    env: { E2E_BUILD: '1' },
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
