import { test, expect, type Page } from '@playwright/test';
import { settleReveals } from './helpers/reveal';

/**
 * Story 8.9 (FR41, UX-DR37): every important moment has its own feel, as the
 * game-feel table (platform/gameFeel.ts) lists it.
 *
 * - Lay egg: an egg appears by the queen, `+N` types in next to EGG, a light haptic.
 * - A long hold floats `+N` at most 8 times a second, and the held button still
 *   changes luminance at most 3 times in any second (flash rule, Story 1.11).
 * - A buy's light haptic plays at the press, once, and follows the haptics setting;
 *   with haptics off the moment still shows.
 * - A decision sheet's headline types in; under reduced motion it is simply there.
 *
 * `navigator.vibrate` is replaced by an init script that records each call.
 */

declare global {
  interface Window {
    __vibes: unknown[];
  }
}

const EGG_LAYING = {
  phase: 'egg_laying',
  resources: { eggs: 0, larvae: 0, workers: 1, food: 1_000_000, nestCapacity: 50 },
  stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 60_000 },
};

async function seed(page: Page, gameState: Record<string, unknown>, settings: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(
    ([save, prefs]: [string, string]) => {
      window.__vibes = [];
      Object.defineProperty(Navigator.prototype, 'vibrate', {
        configurable: true,
        value(pattern: unknown) {
          window.__vibes.push(pattern);
          return true;
        },
      });
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'done');
      localStorage.setItem('the_swarm_settings', prefs);
    },
    [
      JSON.stringify({ version: 18, timestamp: Date.now(), playTimeMs: 60_000, gameState: { lastSaveTimestamp: Date.now(), ...gameState } }),
      JSON.stringify({ version: 3, settings }),
    ] as [string, string],
  );
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** One frame at 60 Hz. */
const FRAME_MS = 17;

const vibes = (page: Page) => page.evaluate(() => [...window.__vibes]);
const layEgg = (page: Page) => page.locator('#click-egg');

test.describe('game feel (Story 8.9)', () => {
  test('lay egg: an egg appears by the queen, +N types in next to EGG, and a light haptic plays', async ({ page }) => {
    await seed(page, EGG_LAYING, { haptics: true });
    await expect(page.locator('[data-scene="nest"]')).toBeVisible();
    await expect(page.locator('[data-arrive="egg"]')).toHaveCount(0);
    await layEgg(page).click();
    const particle = page.locator('.click-particle').first();
    await expect(particle).toBeAttached();
    await expect(particle).toContainText('EGG');
    await expect(particle.locator('[data-type-in]')).toHaveText(/^\+\d+$/);
    await expect(page.locator('[data-scene="nest"] [data-arrive="egg"]').first()).toBeAttached();
    await expect.poll(async () => (await vibes(page)).length).toBeGreaterThan(0);
  });

  test('a 2.5 s hold floats +N at most 8 times a second and keeps the flash rule', async ({ page }) => {
    await seed(page, EGG_LAYING);
    const button = layEgg(page);
    await expect(button).toBeVisible();
    await settleReveals(page);
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const watching = page.evaluate(
      (ms) =>
        new Promise<{ floats: number[]; changes: number[] }>((resolve) => {
          const el = document.querySelector('#click-egg') as HTMLElement;
          const floats: number[] = [];
          const changes: number[] = [];
          const start = performance.now();
          const obs = new MutationObserver((records) => {
            for (const r of records)
              for (const n of r.addedNodes) if (n instanceof HTMLElement && n.matches('.click-particle')) floats.push(performance.now() - start);
          });
          obs.observe(el.parentElement!, { childList: true, subtree: true });
          let last = '';
          const frame = (): void => {
            const cs = getComputedStyle(el);
            const cursor = el.querySelector('[data-cursor]');
            const cur = cursor ? getComputedStyle(cursor) : null;
            const sig = [cs.backgroundColor, cs.color, cs.borderColor, cur?.opacity, cur?.color].join('|');
            const now = performance.now() - start;
            if (last && sig !== last) changes.push(now);
            last = sig;
            (window as unknown as { __sampling: boolean }).__sampling = true;
            if (now < ms) requestAnimationFrame(frame);
            else {
              obs.disconnect();
              resolve({ floats, changes });
            }
          };
          requestAnimationFrame(frame);
        }),
      2600,
    );
    // Press only once the sampler has its first frame, so it sees the press itself.
    await page.waitForFunction(() => (window as unknown as { __sampling?: boolean }).__sampling === true);
    await page.mouse.down();
    const { floats, changes } = await watching;
    await page.mouse.up();
    const laid = await page.evaluate(() => (window as any).__swarm.manager.getState().stats.totalClicks);
    expect(laid, 'the hold kept laying').toBeGreaterThan(floats.length);
    expect(floats.length).toBeGreaterThan(8);
    // A float is seen when it renders, up to a frame after the gate let it through: allow one frame of jitter.
    for (const t of floats) expect(floats.filter((u) => u >= t && u < t + 1000 - FRAME_MS).length, `floats: ${floats.map(Math.round)}`).toBeLessThanOrEqual(8);
    expect(changes.length).toBeGreaterThan(0);
    for (const t of changes) expect(changes.filter((u) => u >= t && u < t + 1000).length, `changes: ${changes.map(Math.round)}`).toBeLessThanOrEqual(3);
  });

  test('a buy: the light haptic plays once at the press, floats +N, and follows the haptics setting', async ({ page }) => {
    await seed(page, EGG_LAYING, { haptics: true });
    const buy = page.locator('[data-action="buy-click-power"]');
    await expect(buy).toBeVisible();
    await buy.click();
    await expect(buy.locator('[data-float]').first()).toBeAttached();
    expect(await vibes(page)).toHaveLength(1);

    await page.evaluate(() => (window as any).__swarm.platform.settings.update({ haptics: false }));
    await buy.click();
    // Never the only feedback: with haptics off the press still floats its +N.
    await expect(buy.locator('[data-float]').first()).toBeAttached();
    expect(await vibes(page)).toHaveLength(1);
  });
});

test.describe('decision headline (Story 8.9)', () => {
  const DECISION = {
    phase: 'colony',
    resources: { eggs: 0, larvae: 0, workers: 10, food: 400, nestCapacity: 50 },
    workersAssigned: { gather: 6, tend: 2, dig: 1, guard: 1, researchers: 0 },
    stats: { totalEggsLaid: 30, totalClicks: 30, playTimeMs: 10 * 3_600_000 },
    decision: { open: { id: 'beetle_sighting', remainingMs: 25_000, openedAtSessionMs: 0, roll: 0.99 }, nextSpawnSessionMs: 0 },
  };

  test('the decision sheet rises and its headline types in, whole for assistive tech', async ({ page }) => {
    await seed(page, DECISION);
    const typed = page.locator('#decision-popup [data-sheet-headline] [data-type-in]');
    await expect(typed).toBeVisible();
    await expect(typed).toHaveCSS('animation-name', 'type-in');
    await expect(page.locator('#decision-popup [data-sheet-headline]')).toHaveText(/\S/);
  });

  test('under reduced motion the headline is simply there', async ({ page }) => {
    await seed(page, DECISION, { reducedMotion: 'on' });
    const typed = page.locator('#decision-popup [data-sheet-headline] [data-type-in]');
    await expect(typed).toBeVisible();
    await expect(typed).toHaveCSS('animation-name', 'none');
  });
});
