import { defineConfig, devices } from '@playwright/test';

const CHROMIUM_ARGS = ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox'];

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
      // Touch-only specs need a touch device: they run in `mobile` below.
      testIgnore: /mobile-touch\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: CHROMIUM_ARGS },
      },
    },
    {
      // #370: the mobile-first game on a phone, by touch (hasTouch, isMobile). A smoke
      // subset, so CI time stays near the desktop run: the touch specs, the map tile
      // claim, and the golden path.
      name: 'mobile',
      testMatch: [/mobile-touch\.spec\.ts/, /map-territory\.spec\.ts/, /golden-path\.spec\.ts/],
      use: {
        ...devices['Pixel 7'],
        launchOptions: { args: CHROMIUM_ARGS },
        // A mobile browser shows the one-time add-to-home-screen hint (Story 2.13) over
        // everything. These tests are about playing, so they start with it seen;
        // storage-durability.spec tests the hint itself.
        storageState: {
          cookies: [],
          origins: [{ origin: 'http://localhost:5173', localStorage: [{ name: 'the_swarm_home_hint', value: 'seen' }] }],
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
