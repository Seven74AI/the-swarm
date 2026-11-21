import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Story 1.26 (UX-DR30, UX-DR31): LOG keeps the colony's history. The event
 * lines are saved with the game (last 100, newest first) and survive a
 * reload; a line that points at something jumps to it; LOG also shows
 * lifetime stats, a settings entry, and LEGACY (prestige and the Legacy tree)
 * once the GDD's prestige unlock condition is met. A prestige starts a new
 * chronicle. No balance numbers: assertions compare the page with its save.
 */

interface Swarm {
  bus: { emit(event: string, payload: unknown): void };
  actions: { prestige(): { ok: boolean } };
}

type Line = { message: string; timestamp: number; target?: string };

/**
 * Seed once per test: the init script runs again on reload, and must not
 * overwrite what the game saved before it.
 */
async function seed(page: Page, gameState: Record<string, unknown>, lines: Line[] = []): Promise<void> {
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 17, timestamp: Date.now(), playTimeMs: 0, gameState, chronicle: { entries: lines, milestones: [] } }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Colony below its goal, so it never latches during a test. */
const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 8, food: 500, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 3, tend: 0, dig: 0, guard: 0, researchers: 0 },
};

/** Expansion with the GDD's prestige unlock condition met. */
const LEGACY_MET = {
  ...COLONY,
  phase: 'expansion',
  battlesWon: 1,
  buildings: { barracks: { level: 5, count: 0 }, walls: { level: 5 }, warehouse: { level: 5 } },
  prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
};

const savedLines = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('the_swarm_save') ?? '{}').chronicle?.entries ?? []) as Line[]);

const emit = (page: Page, event: string, payload: unknown) =>
  page.evaluate(([e, p]) => (window as unknown as { __swarm: Swarm }).__swarm.bus.emit(e as string, p), [event, payload] as const);

test.describe('LOG tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('shows the full saved log, newest first, then lifetime stats and a settings entry', async ({ page }) => {
    const lines = Array.from({ length: 8 }, (_, i) => ({ message: `Saved line ${8 - i}`, timestamp: 8 - i }));
    await seed(page, COLONY, lines);
    await openTab(page, 'log');
    const shown = page.locator('[data-log-section="chronicle"] [data-log-line]');
    await expect(shown).toHaveCount(lines.length);
    await expect(shown.first()).toContainText(lines[0].message);
    await expect(shown.first()).toHaveAttribute('data-newest', 'true');
    await expect(shown.last()).toContainText(lines[lines.length - 1].message);
    // NEST still shows only its newest few.
    expect(await page.locator('#activity-log .log-entry').count()).toBeLessThan(lines.length);

    await expect(page.locator('[data-log-section="stats"] [data-lifetime-stat="eggs"]')).toBeVisible();
    await expect(page.locator('[data-log-section="settings"] [data-action="settings"]')).toBeVisible();
  });

  test('is never empty after Phase 1, even for a save that had no log yet', async ({ page }) => {
    await page.addInitScript((save: string) => {
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'complete');
    }, JSON.stringify({ version: 16, timestamp: Date.now(), playTimeMs: 0, gameState: COLONY }));
    await page.goto('/');
    await openTab(page, 'log');
    expect(await page.locator('[data-log-section="chronicle"] [data-log-line]').count()).toBeGreaterThan(0);
  });

  test('a new line is saved with the game and survives a reload', async ({ page }) => {
    await seed(page, COLONY, [{ message: 'An older line', timestamp: 1 }]);
    await emit(page, 'narrative', { message: 'A line written before the reload' });
    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();
    await openTab(page, 'log');
    const shown = page.locator('[data-log-section="chronicle"] [data-log-line]');
    await expect(shown.first()).toContainText('A line written before the reload');
    await expect(shown.nth(1)).toContainText('An older line');
    const saved = await savedLines(page);
    expect(saved[0].message).toBe('A line written before the reload');
  });

  test('tapping a line that points at something jumps to it', async ({ page }) => {
    await seed(page, COLONY, [{ message: 'The workers wait for orders.', timestamp: 1, target: 'worker_assignment' }]);
    await openTab(page, 'log');
    await page.locator('[data-log-section="chronicle"] [data-jump="worker_assignment"]').click();
    await expect(page.locator('[data-tab="wrkr"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#worker-assignment')).toBeInViewport();
  });

  test('LEGACY stays hidden until the prestige unlock condition is met', async ({ page }) => {
    await seed(page, { ...COLONY, phase: 'expansion', battlesWon: 1 });
    await openTab(page, 'log');
    await expect(page.locator('[data-log-section="chronicle"]')).toBeVisible();
    await expect(page.locator('[data-log-section="legacy"]')).toBeHidden();
    await expect(page.locator('#prestige-panel')).toBeHidden();
  });

  test('LEGACY hosts prestige (behind hold-to-confirm) and the Legacy tree once the condition is met', async ({ page }) => {
    await seed(page, LEGACY_MET);
    await openTab(page, 'log');
    const legacy = page.locator('[data-log-section="legacy"]');
    await expect(legacy).toBeVisible();
    await expect(legacy.locator('#prestige-panel')).toBeVisible();
    await expect(legacy.locator('#prestige-panel [data-action="prestige"]')).toBeVisible();
    await expect(legacy.locator('#prestige-tree-panel')).toBeAttached();
  });

  test('a prestige starts a new chronicle, and the save keeps the new one', async ({ page }) => {
    await seed(page, LEGACY_MET, [{ message: 'A line from the old run', timestamp: 1 }]);
    const result = await page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.actions.prestige());
    expect(result.ok).toBe(true);
    await expect(page.locator('#activity-log')).not.toContainText('A line from the old run');
    expect(await page.locator('#activity-log .log-entry').count()).toBeGreaterThan(0);
    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();
    await expect(page.locator('#activity-log')).not.toContainText('A line from the old run');
    const saved = await savedLines(page);
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.some((l) => l.message === 'A line from the old run')).toBe(false);
  });
});
