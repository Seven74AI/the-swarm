import { test, expect, type Page } from '@playwright/test';
import { tapContinue } from './helpers/phase';

/**
 * Story 2.12 (AR6, D4 → Durability): at the first meaningful play the game asks
 * `navigator.storage.persist()` once, and a mobile browser that isn't the
 * installed app gets a one-time add-to-home-screen hint, remembered outside the
 * save. `navigator.storage` is stubbed so the calls can be counted.
 */

/** Stub navigator.storage (persisted false, persist granted) and count persist() calls in sessionStorage. */
async function stubStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: async () => false,
        persist: async () => {
          sessionStorage.setItem('persist-calls', String(Number(sessionStorage.getItem('persist-calls') ?? '0') + 1));
          return true;
        },
      },
    });
  });
}

async function seed(page: Page, version: number, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    // Seed once: a reload must load what the game saved, not this seed again.
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'done');
  }, JSON.stringify({ version, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Wait until this load's persist request has an outcome (the hint decision is made at the same moment). */
const settled = (page: Page) =>
  page.waitForFunction(
    () =>
      (window as unknown as { __swarm?: { platform: { durability: { status(): unknown } } } }).__swarm?.platform.durability.status() !=
      null,
  );

const persistCalls = (page: Page) => page.evaluate(() => Number(sessionStorage.getItem('persist-calls') ?? '0'));

/** An Egg Laying save whose goal is met (the v14 migration latches it). */
const EGG_LAYING_MET = { phase: 'egg_laying', resources: { workers: 1_000, food: 500, nestCapacity: 2_000 } };
/** A run already past the first phase. */
const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 5, food: 500, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
};

test.describe('persistent storage (desktop)', () => {
  test('is not asked during the first phase, then asked once when the phase is committed', async ({ page }) => {
    await stubStorage(page);
    await seed(page, 14, EGG_LAYING_MET);
    await expect(page.locator('[data-action="continue"]')).toBeVisible();
    expect(await persistCalls(page)).toBe(0);
    await tapContinue(page);
    await expect.poll(() => persistCalls(page)).toBe(1);
    // A desktop browser gets no home-screen hint.
    await expect(page.locator('[data-home-screen-hint]')).toHaveCount(0);
  });

  test('a run past the first phase asks on load, and a later load never asks again', async ({ page }) => {
    await stubStorage(page);
    await seed(page, 15, COLONY);
    await expect.poll(() => persistCalls(page)).toBe(1);
    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();
    await settled(page);
    expect(await persistCalls(page)).toBe(1);
  });
});

test.describe('add-to-home-screen hint (mobile browser)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('shows once at the first meaningful play and is remembered across reloads', async ({ page }) => {
    await stubStorage(page);
    await seed(page, 15, COLONY);
    const hint = page.locator('[data-home-screen-hint]');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('HOME SCREEN');
    await hint.locator('[data-sheet-close]').click();
    await expect(hint).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('the_swarm_home_hint'))).not.toBeNull();
    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();
    await settled(page);
    await expect(hint).toHaveCount(0);
  });

  test('the installed app never shows it', async ({ page }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q === '(display-mode: standalone)' ? ({ ...real(q), matches: true } as MediaQueryList) : real(q);
    });
    await stubStorage(page);
    await seed(page, 15, COLONY);
    await expect.poll(() => persistCalls(page)).toBe(1);
    await expect(page.locator('[data-home-screen-hint]')).toHaveCount(0);
  });
});
