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
  // E2E runs against a bundle served by `vite preview`: page loads are much cheaper
  // than the dev server's per-module transforms (~25% faster suite). It is a
  // development-mode, unminified build with the harness pages (E2E_BUILD=1, see
  // vite.config.ts), so dev-only code (debug cheats) behaves as on the dev server.
  // A dev server already on :5173 is reused locally.
  webServer: {
    command: 'pnpm exec vite build --mode development && pnpm exec vite preview --outDir dist-e2e --port 5173 --strictPort',
    env: { E2E_BUILD: '1', NODE_ENV: 'development' },
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
