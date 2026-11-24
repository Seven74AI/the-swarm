import { test, expect, type Page } from '@playwright/test';
import { DECISIONS } from '../../src/data/content/decisions';
import { Phase } from '../../src/phases/phases';
import { settleReveals } from './helpers/reveal';
import { openTab, type SegmentId, type TabId } from './helpers/tabs';

/**
 * #465 (MVP retro F1): no rendered text shows component or function source.
 *
 * The playtest found the egg-chamber upgrade cards printing
 * `function GlyphFood(p) { return …` (#432): a component interpolated into a
 * template string. TypeScript accepts any value there, so only reading the
 * rendered text catches it. For a seeded save in each MVP phase (1–3), this
 * walks every tab and FRONT segment the phase shows, and every sheet a player
 * can reach there: the offline summary and a decision of that phase (both at
 * boot), the resource sheet with every group open, settings, each chamber peek
 * the nest scene opens, and (in Combat) the battle summary. It reads what the
 * page renders as text and refuses anything that looks like source.
 */

/** What source code looks like once it leaks into text. */
const SOURCE = [
  /\bfunction\s*[\w$]*\s*\(/, // a function's toString()
  /=>/, // an arrow function's toString()
  /\[object \w+\]/, // an object interpolated into a string
  /\breturn\s*[({[<]/, // a function body (`return (`, `return {`); "scouts return" is fine
  /\b_?jsxs?\(|\bh\(\s*["'\w]/, // a compiled JSX call
];

const MVP: readonly { phase: Phase; state: Record<string, unknown> }[] = [
  {
    phase: Phase.EGG_LAYING,
    state: {
      phase: 'egg_laying',
      resources: { eggs: 3, larvae: 2, workers: 2, food: 40, nestCapacity: 25, wood: 0, stone: 0, nectar: 0 },
      eggPipeline: { count: 3, progress: 0 },
      larvaPipeline: { count: 2, progress: 0 },
      workersAssigned: { gather: 1, tend: 1, dig: 0, guard: 0, researchers: 0 },
    },
  },
  {
    phase: Phase.COLONY,
    state: {
      phase: 'colony',
      resources: { eggs: 2, larvae: 2, workers: 10, food: 400, nestCapacity: 100, wood: 20, stone: 20, nectar: 5 },
      eggPipeline: { count: 2, progress: 0 },
      larvaPipeline: { count: 2, progress: 0 },
      workersAssigned: { gather: 6, tend: 2, dig: 1, guard: 1, researchers: 0 },
    },
  },
  {
    phase: Phase.COMBAT,
    state: {
      phase: 'combat',
      resources: { eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 1000, wood: 50, stone: 50, nectar: 10 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 4, tend: 4, dig: 4, guard: 4, researchers: 0 },
      combatSoldiers: 50,
      equipment: { weapon: 5, armor: 5 },
    },
  },
];

const PLACES: readonly { tab: TabId; segment?: SegmentId }[] = [
  { tab: 'nest' },
  { tab: 'wrkr' },
  { tab: 'build' },
  { tab: 'front', segment: 'war' },
  { tab: 'front', segment: 'map' },
  { tab: 'front', segment: 'stars' },
  { tab: 'log' },
];

/** Away long enough for the offline summary at boot. */
const AWAY_MS = 120_000;

async function seed(page: Page, phase: Phase, state: Record<string, unknown>): Promise<void> {
  const decision = DECISIONS.find((d) => d.phases.includes(phase));
  if (!decision) throw new Error(`no decision for ${phase}`);
  const timestamp = Date.now() - AWAY_MS;
  const gameState = {
    ...state,
    stats: { totalEggsLaid: 30, totalClicks: 30, playTimeMs: 600_000 },
    lastSaveTimestamp: timestamp,
    decision: { open: { id: decision.id, remainingMs: null, openedAtSessionMs: 0, roll: 0.5 }, nextSpawnSessionMs: 0 },
  };
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 17, timestamp, playTimeMs: 600_000, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Everything the page renders as text right now. */
const pageText = (page: Page) => page.evaluate(() => document.body.innerText);

/** The lines of `text` that look like source, tagged with where they were read. */
function leaks(where: string, text: string): string[] {
  return text
    .split('\n')
    .filter((line) => SOURCE.some((re) => re.test(line)))
    .map((line) => `${where}: ${line.trim().slice(0, 120)}`);
}

async function closeSheet(page: Page, sheet: ReturnType<Page['locator']>): Promise<void> {
  await sheet.locator('[data-sheet-close]').first().click();
  await expect(sheet).toHaveCount(0);
}

test.describe('no rendered text shows component source (#465)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  for (const { phase, state } of MVP) {
    test(`${phase}: every tab and sheet reads as copy, not code`, async ({ page }) => {
      test.setTimeout(120_000);
      const found: string[] = [];
      const read = async (where: string) => {
        const text = await pageText(page);
        expect(text.trim(), `${where} renders text`).not.toBe('');
        found.push(...leaks(where, text));
      };

      await seed(page, phase, state);

      // Boot: the offline summary first, then the decision of this phase (Story 1.14 priority).
      const offline = page.locator('.offline-summary-popup');
      await expect(offline).toBeVisible({ timeout: 10_000 });
      await read('offline summary');
      await closeSheet(page, offline);

      const decision = page.locator('#decision-popup');
      await expect(decision).toBeVisible({ timeout: 10_000 });
      await read('decision sheet');
      await decision.locator('button[data-choice]:not([aria-disabled="true"])').first().click();
      await expect(decision).toHaveCount(0);
      await settleReveals(page);

      // Every tab and FRONT segment this phase shows.
      // Phase 1 has no tab bar: the NEST is the whole screen.
      let places = 0;
      await read('first screen');
      for (const { tab, segment } of PLACES) {
        if (!(await page.locator(`[data-tab="${tab}"]`).isVisible())) continue;
        await openTab(page, tab);
        if (segment) {
          if (!(await page.locator(`[data-segment="${segment}"]`).isVisible())) continue;
          await openTab(page, tab, segment);
        }
        await settleReveals(page);
        await read(segment ? `${tab} · ${segment}` : tab);
        places++;
      }
      if (phase !== Phase.EGG_LAYING) expect(places, 'tabs visited').toBeGreaterThan(1);

      // The resource sheet, every group open.
      await page.locator('[data-resource-strip]').click();
      const resources = page.locator('[data-resource-sheet]');
      await expect(resources).toBeVisible();
      for (const toggle of await resources.locator('[data-resource-group][data-open="false"] [data-action="toggle-group"]').all()) {
        await toggle.click();
      }
      await read('resource sheet');

      // Settings, opened from the resource sheet.
      await resources.locator('[data-action="settings"]').click();
      const settings = page.locator('[data-settings-sheet]');
      await expect(settings).toBeVisible();
      await read('settings sheet');
      await closeSheet(page, settings);

      // Each chamber peek: every chamber of the nest scene peeks, except one that feeds the brood (Story 9.4).
      if (await page.locator('[data-tab="nest"]').isVisible()) await openTab(page, 'nest');
      await settleReveals(page);
      const chambers = await page
        .locator('[data-scene="nest"] button[data-chamber]:not([data-feeds])')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-chamber') ?? ''));
      let peeks = 0;
      for (const id of chambers) {
        await page.locator(`[data-scene="nest"] button[data-chamber="${id}"]`).click();
        const peek = page.locator(`[data-sheet="peek"][data-chamber-peek="${id}"]`);
        await expect(peek).toBeVisible();
        await read(`chamber peek · ${id}`);
        await closeSheet(page, peek);
        peeks++;
      }
      expect(peeks, 'chamber peeks opened').toBeGreaterThan(0);

      // Combat: the battle summary.
      if (phase === Phase.COMBAT) {
        await openTab(page, 'front', 'war');
        await page.locator('[data-primary-for="front"] [data-action="fight"]').click();
        const summary = page.locator('[data-battle-summary]');
        await expect(summary).toBeVisible({ timeout: 10_000 });
        await read('battle summary');
        await closeSheet(page, summary);
      }

      expect(found, found.join('\n')).toEqual([]);
    });
  }
});
