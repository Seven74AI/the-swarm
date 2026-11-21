import { test, expect, type Page } from '@playwright/test';

/**
 * Story 2.13 (AR13, D10, NFR10): the game installs and plays offline.
 *
 * The E2E bundle is a development build, which registers the service worker only
 * when the page opts in with `?sw=1` (production builds always do). Every other
 * spec runs without a worker. The production artifacts themselves (manifest,
 * precache list, no skipWaiting) are checked by tests/unit/build/pwaBuild.test.ts.
 */

const GAME = '/the-swarm/?sw=1';
const UPDATE_READY = 'A NEW VERSION IS READY';

// A returning player: the intro is done, so nothing covers the nest.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('the_swarm_onboarding', 'done'));
});

/** The worker has installed (precache done) and is active. */
async function workerReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

const controlled = (page: Page) => page.evaluate(() => navigator.serviceWorker.controller !== null);
const waitingState = (page: Page) =>
  page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? null);

/**
 * Deploy a new version. Playwright can't route the browser's own fetch of a worker
 * script, so the new version is a new script URL for the same scope: the browser
 * installs it as an update to the running registration, as it does for changed bytes.
 */
async function deployNextVersion(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/the-swarm/sw.js?next-version', { scope: '/the-swarm/' });
  });
  await expect.poll(() => waitingState(page)).toBe('installed');
}

/** Install the worker, then reload so it controls the page. */
async function controlledGame(page: Page): Promise<void> {
  await page.goto(GAME);
  await workerReady(page);
  await page.reload();
  expect(await controlled(page)).toBe(true);
}

const controllerScript = (page: Page) => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '');
const totalClicks = (page: Page) =>
  page.evaluate(() => (window as any).__swarm.manager.getState().stats.totalClicks as number);
const playTime = (page: Page) =>
  page.evaluate(() => (window as any).__swarm.manager.getState().stats.playTimeMs as number);

/** The game is up and running: it ticks, and a tap on LAY EGG counts. */
async function expectPlays(page: Page): Promise<void> {
  const lay = page.locator('#click-egg');
  await expect(lay).toBeVisible();
  await expect.poll(() => playTime(page), { timeout: 10_000 }).toBeGreaterThan(0);
  const before = await totalClicks(page);
  await lay.click();
  await expect.poll(() => totalClicks(page)).toBeGreaterThan(before);
}

test('loads once, goes offline, reloads, and the game plays', async ({ page, context }) => {
  await page.goto(GAME);
  await workerReady(page);
  await expectPlays(page);

  await context.setOffline(true);
  // The network really is gone: anything outside the precache fails.
  const uncached = await page.evaluate(() =>
    fetch(`/the-swarm/not-precached-${Date.now()}.txt`).then(
      () => 'reached',
      () => 'failed',
    ),
  );
  expect(uncached).toBe('failed');

  await page.reload();
  expect(await controlled(page)).toBe(true);
  await expectPlays(page);
});

test('a cold start with no connection opens the game from the cache', async ({ page, context }) => {
  await page.goto(GAME);
  await workerReady(page);
  await page.close();

  await context.setOffline(true);
  const cold = await context.newPage();
  await cold.goto(GAME);
  expect(await controlled(cold)).toBe(true);
  await expectPlays(cold);
});

test('a new version waits for the next cold start and never reloads the session', async ({ page, context }) => {
  await controlledGame(page);
  await expectPlays(page);
  await page.evaluate(() => {
    (window as any).__sameSession = true;
  });

  await deployNextVersion(page);

  // Told once; the session goes on with the old version, unreloaded.
  await expect(page.locator('[data-toast]', { hasText: UPDATE_READY })).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__sameSession === true)).toBe(true);
  expect(await controllerScript(page)).not.toContain('next-version');
  await expectPlays(page);

  // Cold start: every page of the old version closes, then the game opens again.
  // The browser activates the waiting version once no page of the old one is left;
  // watch for that from a same-origin page outside the game's scope.
  const cold = await context.newPage();
  await cold.goto('/outside-scope'); // '/' itself redirects into /the-swarm/
  // Closed as a player closes it (unload runs).
  await page.close({ runBeforeUnload: true });
  await expect
    .poll(() => cold.evaluate(async () => (await navigator.serviceWorker.getRegistration('/the-swarm/'))?.active?.scriptURL ?? ''))
    .toContain('next-version');
  await cold.goto(GAME);
  expect(await controllerScript(cold)).toContain('next-version');
  await expectPlays(cold);
  await expect(cold.locator('[data-toast]', { hasText: UPDATE_READY })).toHaveCount(0);
});

test('a reload is not a cold start: the waiting version keeps waiting and the player is told again', async ({ page }) => {
  await controlledGame(page);
  await deployNextVersion(page);
  await expect(page.locator('[data-toast]', { hasText: UPDATE_READY })).toBeVisible();
  await page.reload();
  // (After the reload the game registers /the-swarm/sw.js again, which the browser
  // installs as yet another waiting update; a real deploy keeps one script URL.)
  expect(await controllerScript(page)).not.toContain('next-version');
  await expect.poll(() => waitingState(page)).toBe('installed');
  await expect(page.locator('[data-toast]', { hasText: UPDATE_READY })).toBeVisible();
  await expectPlays(page);
});

test('without ?sw=1 a dev or E2E build registers no worker, so other specs run without one', async ({ page }) => {
  await page.goto('/the-swarm/');
  await expectPlays(page);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()) ?? null)).toBeNull();
});
