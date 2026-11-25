import { test, expect, type Page } from '@playwright/test';
import { TITLE_BEATS, TITLE_COPY } from '../../src/data/content/titleCinematic';
import { INTRO_SEEN_KEY, SAVE_KEY, seedSave } from './helpers/seed';

/**
 * Story 8.10 (UX-DR28): the title cinematic on first launch. With no save and
 * no intro flag it plays (Phase 1 amber only) and sets the flag as it starts;
 * a tap, Enter, Space or Esc skips it; it ends on a real wake button, then
 * `A QUEEN, ALONE.`, the brood chamber and a coach mark on LAY EGG. Reduced
 * motion opens on its title frame. Settings → REPLAY INTRO plays it again
 * without touching the save; `seedSave(…, { introSeen: true })` skips it.
 */

// This spec is about the first launch: start with nothing stored (the config seeds the flag for every other spec).
test.use({ storageState: { cookies: [], origins: [] } });

const CINEMATIC = '[data-overlay="title-cinematic"]';
const WAKE = '[data-action="wake-queen"]';
const cinematic = (page: Page) => page.locator(CINEMATIC);

/** A Phase 1 colony with a little going on, so a reset would show. */
const PHASE1 = {
  phase: 'egg_laying',
  resources: { eggs: 7, larvae: 0, workers: 3, food: 120, nestCapacity: 50, wood: 0, stone: 0, nectar: 0 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
};

test('first launch plays it once: the flag is set as it starts, and it tells its story in Phase 1 amber', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.goto('/');
  await expect(cinematic(page)).toBeVisible();
  await expect(cinematic(page)).toHaveAttribute('data-stage', 'playing');
  // Set when it starts, not when it ends.
  expect(await page.evaluate((k) => localStorage.getItem(k), INTRO_SEEN_KEY)).not.toBeNull();
  // Phase 1 amber: the overlay's accent is the Phase 1 accent, whatever the root's phase.
  const accent = await cinematic(page).evaluate((el) => getComputedStyle(el).getPropertyValue('--color-accent').trim());
  const phase1 = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.dataset.palette = 'egg';
    document.body.appendChild(probe);
    const v = getComputedStyle(probe).getPropertyValue('--color-accent').trim();
    probe.remove();
    return v;
  });
  expect(accent).toBe(phase1);

  await page.clock.runFor(TITLE_BEATS.eggMs);
  await expect(page.locator('[data-title-line]')).toHaveText(TITLE_COPY.egg);
  await page.clock.runFor(TITLE_BEATS.queenMs - TITLE_BEATS.eggMs);
  await expect(page.locator('[data-title-line]')).toHaveText(TITLE_COPY.queen);
  await page.clock.runFor(TITLE_BEATS.titleMs - TITLE_BEATS.queenMs);
  await expect(cinematic(page)).toHaveAttribute('data-stage', 'title');
  await expect(page.locator('[data-title-tagline]')).toHaveText('ONE EGG. ONE QUEEN. ONE SWARM.');
  await expect(page.locator(WAKE)).toBeFocused();
});

test('it ends on a real [ TAP TO WAKE THE QUEEN ] button, then A QUEEN, ALONE., the brood chamber and a coach mark on LAY EGG', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.goto('/');
  await expect(cinematic(page)).toBeVisible();
  await page.keyboard.press('Escape');
  const wake = page.getByRole('button', { name: TITLE_COPY.wake });
  await expect(wake).toBeVisible();
  await expect(wake).toHaveText(`[ ${TITLE_COPY.wake} ]`);
  // Keyboard wakes her too: the focused button takes Enter.
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-title-alone]')).toHaveText(TITLE_COPY.alone);
  await page.clock.runFor(TITLE_BEATS.aloneMs);
  await expect(cinematic(page)).toHaveCount(0);
  // Let time flow again for the game (its effects run on animation frames).
  await page.clock.resume();

  // The brood chamber, with the coach mark on LAY EGG.
  const layEgg = page.locator('#click-egg');
  await expect(layEgg).toBeVisible();
  const mark = page.locator('[data-coach-mark="lay-egg"]');
  await expect(mark.locator('.coach-mark__caption')).toBeVisible();
  await expect(mark.locator('.coach-mark__caption')).toBeInViewport({ ratio: 1 });
  await expect(mark.locator('.coach-mark__caption')).toContainText(TITLE_COPY.layEggCoach);
  // Laying an egg is the lesson: it dismisses the mark, for good.
  await layEgg.click();
  await expect(mark).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-shell]')).toBeVisible();
  await expect(cinematic(page)).toHaveCount(0);
  await expect(mark).toHaveCount(0);
});

for (const [name, skip] of [
  ['a tap', (p: Page) => p.locator(CINEMATIC).click({ position: { x: 20, y: 200 } })],
  ['Enter', (p: Page) => p.keyboard.press('Enter')],
  ['Space', (p: Page) => p.keyboard.press('Space')],
  ['Esc', (p: Page) => p.keyboard.press('Escape')],
] as const) {
  test(`${name} skips it to the wake button`, async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await page.goto('/');
    await expect(cinematic(page)).toHaveAttribute('data-stage', 'playing');
    await skip(page);
    await expect(cinematic(page)).toHaveAttribute('data-stage', 'title');
    await expect(page.locator(WAKE)).toBeVisible();
  });
}

test('left mid-way, it never plays by itself again: the flag was set when it started', async ({ page, context }) => {
  await page.goto('/');
  await expect(cinematic(page)).toHaveAttribute('data-stage', 'playing');
  await page.close();
  // A new launch with the flag but no save: the brood chamber, no cinematic.
  const next = await context.newPage();
  await next.addInitScript((k) => localStorage.removeItem(k), SAVE_KEY);
  await next.goto('/');
  await expect(next.locator('[data-shell]')).toBeVisible();
  await expect(next.locator('#click-egg')).toBeVisible();
  await expect(next.locator(CINEMATIC)).toHaveCount(0);
});

test('under reduced motion it opens on its title frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(cinematic(page)).toHaveAttribute('data-stage', 'title');
  await expect(page.locator('[data-title-tagline]')).toBeVisible();
  await expect(page.locator(WAKE)).toBeVisible();
});

test('settings → REPLAY INTRO plays it again without touching the save', async ({ page }) => {
  await seedSave(page, PHASE1, { introSeen: true });
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  await expect(cinematic(page)).toHaveCount(0);
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), SAVE_KEY);
  const before = await stored();

  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await page.locator('[data-settings-sheet] [data-action="replay-intro"]').click();
  await expect(cinematic(page)).toHaveAttribute('data-stage', 'playing');
  await expect(page.locator('[data-settings-sheet]')).toHaveCount(0);
  await page.keyboard.press('Space');
  await page.locator(WAKE).click();
  await expect(cinematic(page)).toHaveCount(0);

  // The same run: the save is still there, in the same phase with the same workers, and the flag is still set.
  const after = await stored();
  expect(after.gameState?.phase).toBe(before.gameState?.phase);
  expect(after.gameState?.resources?.workers).toBe(before.gameState?.resources?.workers);
  expect(after.gameState?.resources?.workers).toBeGreaterThan(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), INTRO_SEEN_KEY)).not.toBeNull();
});

test('seedSave(…, { introSeen: true }) skips it, even without a save; { introSeen: false } plays it', async ({ page, context }) => {
  await seedSave(page, null, { introSeen: true });
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  await expect(page.locator('#click-egg')).toBeVisible();
  await expect(cinematic(page)).toHaveCount(0);

  const fresh = await context.newPage();
  await seedSave(fresh, null, { introSeen: false });
  await fresh.goto('/');
  await expect(fresh.locator(CINEMATIC)).toBeVisible();
});

/**
 * #490: the first coach mark is the game's first sentence to a new player. At
 * every phone width, and at 200 % text, the whole instruction is shown: it
 * wraps instead of clipping, and nothing of it is cut off or ellipsed.
 */
for (const { width, fontPx } of [
  { width: 320, fontPx: 16 },
  { width: 360, fontPx: 16 },
  { width: 412, fontPx: 16 },
  { width: 320, fontPx: 32 },
  { width: 412, fontPx: 32 },
]) {
  test(`the LAY EGG coach mark shows its whole instruction at ${width} px, ${fontPx * 6.25} % text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.addInitScript((px: number) => {
      const apply = () => document.documentElement?.style.setProperty('font-size', `${px}px`);
      apply();
      document.addEventListener('DOMContentLoaded', apply);
    }, fontPx);
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await page.goto('/');
    await expect(cinematic(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: TITLE_COPY.wake }).click();
    await page.clock.runFor(TITLE_BEATS.aloneMs);
    await expect(cinematic(page)).toHaveCount(0);
    await page.clock.resume();

    const text = page.locator('[data-coach-mark="lay-egg"] .coach-mark__text');
    await expect(text).toBeVisible();
    await expect(text).toHaveText(TITLE_COPY.layEggCoach);
    const fit = await text.evaluate((el) => {
      const style = getComputedStyle(el);
      // Words wrap whole: each word's text sits on a single line box.
      const node = el.firstChild;
      const split: string[] = [];
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while (node && (m = re.exec(node.textContent ?? ''))) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) split.push(m[0]);
      }
      return {
        split,
        wide: el.scrollWidth - el.clientWidth,
        tall: el.scrollHeight - el.clientHeight,
        ellipsis: style.textOverflow === 'ellipsis' && style.whiteSpace === 'nowrap',
      };
    });
    expect(fit.split).toEqual([]);
    expect(fit.wide).toBeLessThanOrEqual(0);
    expect(fit.tall).toBeLessThanOrEqual(0);
    expect(fit.ellipsis).toBe(false);
    await expect(page.locator('[data-coach-mark="lay-egg"] .coach-mark__caption')).toBeInViewport({ ratio: 1 });
  });
}
