import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';
import { REVEAL, tapContinue, waitOutReveal } from './helpers/phase';

/**
 * E2E: the phase reveal (Story 1.20, UX-DR27).
 * Seeds a game state whose Colony goal is met, taps CONTINUE (Story 1.19), and
 * checks the reveal: a full-screen overlay that blocks input for at most 3.5 s,
 * shows the phase name and one line, cross-fades the palette, holds sheets, and
 * can be skipped (tap, Enter, Esc) only once that reveal has been seen.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  // Create an 8×8 empty map grid
  const mapTiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      mapTiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }

  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'egg_laying',
      resources: {
        eggs: 5, larvae: 0, workers: 10, food: 200,
        nestCapacity: 50, wood: 0, stone: 0, nectar: 0,
        voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
      buildings: {
        barracks: { level: 0, count: 0 },
        walls: { level: 0 },
        warehouse: { level: 0 },
      },
      territory: { ownedTiles: 0, bonuses: {} },
      mapTiles,
      expeditions: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
      upgrades: {},
      stats: { totalEggsLaid: 50, totalClicks: 60, playTimeMs: 0 },
      unlockedPanels: [],
      lastSaveTimestamp: 0,
      combatSoldiers: 0,
      soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
      soldierPipeline: { count: 0, progress: 0 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0,
      battlesLost: 0,
      spaceship: { level: 0, fuel: 0, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      victoryAchieved: false,
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
      autoProduction: {
        enabled: false,
        researches: {},
        buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 },
        progress: 0,
      },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'available' as const, progress: 0 },
          antimatterContainment: { state: 'locked' as const, progress: 0 },
          darkMatterDetection: { state: 'locked' as const, progress: 0 },
        },
      },
      conversions: { particleLab: 0 },
      offlineEfficiency: 0.5,
      entropy: 0,
      entropyDampener: { level: 0 },
      prestigeTree: { purchased: [] },
      ...overrides,
    },
  };
}

type Swarm = {
  manager: { getState(): { phase: string; lifetime: { revealsSeen: string[] } } };
  bus: { emit(name: string, payload: unknown): void };
};
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.manager.getState());
const colorBg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());

async function seed(page: Page, overrides?: Record<string, unknown>) {
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(makeSaveData(overrides)));
}

test.describe('Phase reveal (fake clock)', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });
    await page.clock.runFor(1000);
    // The goal is met; the phase waits for CONTINUE (Story 1.19).
    await expect(page.locator('#phase-indicator')).toContainText('The Lonely Queen');
  });

  test('CONTINUE plays a full-screen reveal: phase name, one typed line, then it ends by itself', async ({ page }) => {
    await tapContinue(page, undefined, { reveal: 'keep' });
    const reveal = page.locator(REVEAL);
    await expect(reveal).toBeVisible();
    await expect(reveal).toHaveAttribute('role', 'dialog');
    await expect(reveal.locator('[data-reveal-name]')).toContainText('COLONY');
    // Only the committed phase's palette and name (Story 1.8): the reveal is Colony's.
    await expect(reveal).toHaveAttribute('data-phase-reveal', 'colony');
    await expect(page.locator('html')).toHaveAttribute('data-phase', 'colony');

    const box = await reveal.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1);

    // The installed fake clock also flows in real time, so a fixed runFor() before
    // reading the line raced the 3.5 s reveal under CI load. Wait for the typed
    // line instead, then run the clock past the reveal's end.
    await expect(reveal.locator('[data-reveal-line]')).not.toBeEmpty();

    await page.clock.runFor(3600);
    await expect(reveal).toHaveCount(0);
    expect((await state(page)).lifetime.revealsSeen).toContain('colony');
  });

  test('the reveal blocks input, and a first reveal cannot be skipped', async ({ page }) => {
    await tapContinue(page, undefined, { reveal: 'keep' });
    const reveal = page.locator(REVEAL);
    await expect(reveal).toBeVisible();
    await expect(reveal).toHaveAttribute('data-skippable', 'false');
    // A tap where the tab bar sits lands on the overlay, not the tab.
    const tab = page.locator('[data-tab="wrkr"]');
    const box = await tab.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(reveal).toBeVisible();
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-tab', 'nest');

    await waitOutReveal(page);
    await openTab(page, 'wrkr');
    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });
  });

  test('a decision event during the reveal waits until it ends', async ({ page }) => {
    await tapContinue(page, undefined, { reveal: 'keep' });
    await expect(page.locator(REVEAL)).toBeVisible();
    // An event opening now (Story 1.28: the sheet follows state.decision.open) waits for the reveal.
    await page.evaluate(() => {
      const m = (window as unknown as { __swarm: { manager: { getState(): Record<string, unknown>; setState(s: unknown): void } } }).__swarm.manager;
      const s = m.getState();
      m.setState({
        ...s,
        decision: { open: { id: 'overcrowding', remainingMs: 40_000, openedAtSessionMs: 0, roll: 0.5 }, nextSpawnSessionMs: null },
      });
    });
    await expect(page.locator('#decision-popup')).toHaveCount(0);
    const left = () =>
      page.evaluate(() => (window as unknown as { __swarm: { manager: { getState(): { decision: { open: { remainingMs: number } | null } } } } }).__swarm.manager.getState().decision.open?.remainingMs);
    expect(await left()).toBe(40_000);
    await waitOutReveal(page);
    await expect(page.locator('#decision-popup')).toBeVisible();
  });
});

test.describe('Phase reveal, once seen', () => {
  for (const key of ['Escape', 'Enter'] as const) {
    test(`${key} skips a reveal already seen`, async ({ page }) => {
      await seed(page, { lifetime: { revealsSeen: ['colony'] } });
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });
      await tapContinue(page, undefined, { reveal: 'keep' });
      const reveal = page.locator(REVEAL);
      await expect(reveal).toHaveAttribute('data-skippable', 'true');
      await page.keyboard.press(key);
      await expect(reveal).toHaveCount(0, { timeout: 1000 });
    });
  }

  test('a tap skips a reveal already seen', async ({ page }) => {
    await seed(page, { lifetime: { revealsSeen: ['colony'] } });
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });
    await tapContinue(page, undefined, { reveal: 'keep' });
    const reveal = page.locator(REVEAL);
    await expect(reveal).toBeVisible();
    await reveal.click();
    await expect(reveal).toHaveCount(0, { timeout: 1000 });
  });
});

test.describe('Phase reveal palette cross-fade (real time)', () => {
  test('the old palette cross-fades into the new one over about 3 s', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });
    await expect(page.locator('[data-action="continue"]')).toHaveCount(1, { timeout: 15000 });
    const from = await colorBg(page);
    await tapContinue(page, undefined, { reveal: 'keep' });
    await page.waitForTimeout(1000);
    const mid = await colorBg(page);
    await waitOutReveal(page);
    const to = await colorBg(page);
    expect(to).not.toBe(from);
    expect(mid).not.toBe(from);
    expect(mid).not.toBe(to);
  });

  test('under reduced motion the cross-fade is short', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await tapContinue(page, undefined, { reveal: 'keep' });
    await page.waitForTimeout(700);
    const settled = await colorBg(page);
    await waitOutReveal(page);
    expect(await colorBg(page)).toBe(settled);
  });
});
