import { test, expect, type Page } from '@playwright/test';

/**
 * Story 8.8 (FR42, AR12): sound is off by default, makes no audio context
 * before the first user gesture, and plays synthesized Web Audio cues once it
 * is on. An init script counts every AudioContext the page makes and every
 * sound source it starts.
 */

declare global {
  interface Window {
    __audioProbe: { contexts: number; started: number };
  }
}

async function probeAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { contexts: 0, started: 0 };
    window.__audioProbe = probe;
    const Real = window.AudioContext;
    if (!Real) return;
    const countStarts = <T extends { start: (...a: never[]) => void }>(node: T): T => {
      const start = node.start.bind(node);
      node.start = ((...a: never[]) => {
        probe.started += 1;
        start(...a);
      }) as T['start'];
      return node;
    };
    class Counted extends Real {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        probe.contexts += 1;
      }
      createOscillator() {
        return countStarts(super.createOscillator());
      }
      createBufferSource() {
        return countStarts(super.createBufferSource());
      }
    }
    window.AudioContext = Counted;
  });
}

const probe = (page: Page) => page.evaluate(() => ({ ...window.__audioProbe }));

async function boot(page: Page, sound?: boolean): Promise<void> {
  await probeAudio(page);
  await page.addInitScript((on) => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    if (on !== null) localStorage.setItem('the_swarm_settings', JSON.stringify({ version: 3, settings: { sound: on } }));
  }, sound ?? null);
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
}

const layEgg = (page: Page) => page.locator('[data-nest-primary="lay"]');

test('sound is off by default: taps make no audio context and play nothing', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(() => (window as any).__swarm.platform.settings.settings.value.sound)).toBe(false);
  for (let i = 0; i < 3; i += 1) await layEgg(page).click();
  // The tap still shows: the egg count's +N particle (audio is never the only channel).
  await expect(page.locator('.click-particle').first()).toBeAttached();
  expect(await probe(page)).toEqual({ contexts: 0, started: 0 });
});

test('with sound on, no audio context exists before the first gesture; the first tap makes one and clicks', async ({ page }) => {
  await boot(page, true);
  // Ticks run and the UI is up, but nobody has touched the page yet.
  await page.waitForFunction(() => (window as any).__swarm.loop);
  await expect(layEgg(page)).toBeVisible();
  expect((await probe(page)).contexts).toBe(0);

  await layEgg(page).click();
  await expect.poll(async () => (await probe(page)).started).toBeGreaterThan(0);
  await layEgg(page).click();
  expect((await probe(page)).contexts).toBe(1);
});

test('the tap that turns sound on unlocks it, and turning it off silences the next tap', async ({ page }) => {
  await boot(page);
  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await page.locator('[data-setting="sound"] [data-option="true"]').click();
  await expect.poll(async () => (await probe(page)).contexts).toBe(1);

  await page.locator('[data-setting="sound"] [data-option="false"]').click();
  await page.locator('[data-sheet-close]').click();
  await expect(page.locator('[data-settings-sheet]')).toHaveCount(0);
  const before = (await probe(page)).started;
  for (let i = 0; i < 3; i += 1) await layEgg(page).click();
  expect((await probe(page)).started).toBe(before);
});
