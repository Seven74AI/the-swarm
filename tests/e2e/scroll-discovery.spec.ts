import { test, expect } from '@playwright/test';

/**
 * E2E: Phase-Based Panel Reveal + Phase Theme Shifting (UX-10).
 *
 * Part A: Phase-based reveal — verifies panels appear when their phase
 * is unlocked (not on scroll). Phase 2+ panels are lazy-loaded and
 * revealed via showPanel() during phase transitions.
 *
 * Part B: Phase theme shifting — verifies body class toggling per phase
 * and CSS variable transitions. Uses clock.install() where needed
 * for fast-forwarding phase transitions.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  const mapTiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      mapTiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }

  return {
    version: 7,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'egg_laying',
      resources: {
        eggs: 5, larvae: 0, workers: 0, food: 200,
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
      ...overrides,
    },
  };
}

test.describe('Phase-Based Panel Reveal + Phase Theme (UX-10)', () => {
  // ═══════════════════════════════════════════════════════════════
  // Part A: Phase-Based Panel Reveal
  // ═══════════════════════════════════════════════════════════════

  test.describe('Phase-Based Panel Reveal', () => {
    test.beforeEach(async ({ page }) => {
      const data = makeSaveData();
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });
    });

    test('Phase 1 panels (resource_panel) are visible on load', async ({ page }) => {
      const resourcePanel = page.locator('.resource-panel');
      await expect(resourcePanel).toBeVisible();
    });

    test('Phase 2 panels are NOT in the DOM at start (lazy-loaded)', async ({ page }) => {
      // worker_assignment should NOT exist in the DOM until colony phase
      const wa = page.locator('#worker-assignment');
      await expect(wa).toHaveCount(0);
    });

    test('soldier_panel is NOT in the DOM at start', async ({ page }) => {
      const sp = page.locator('#soldier-panel');
      await expect(sp).toHaveCount(0);
    });

    test('Phase 1 panels have .panel-revealed class on load', async ({ page }) => {
      // resource_panel is shown by onPhaseEnter during boot
      const resourcePanel = page.locator('.resource-panel');
      const hasRevealed = await resourcePanel.evaluate((el) =>
        el.classList.contains('panel-revealed'),
      );
      expect(hasRevealed).toBe(true);
    });

    test('Phase 2 panel appears after colony phase transition (no scroll needed)', async ({ page }) => {
      // Start with workers=10 to trigger immediate EGG→COLONY transition
      const data = makeSaveData({
        resources: { eggs: 5, larvae: 0, workers: 10, food: 200, nestCapacity: 50, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 },
      });
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      await page.clock.install();
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });

      // Fast-forward past the first tick + transition
      await page.clock.runFor(4000);
      await expect(page.locator('#phase-transition-overlay.active')).not.toBeVisible({ timeout: 5000 });

      // worker_assignment should now exist and be visible (phase-based reveal)
      const wa = page.locator('#worker-assignment');
      await expect(wa).toBeAttached();
    });

    test('panel-revealed class is applied to lazily loaded panels', async ({ page }) => {
      const data = makeSaveData({
        resources: { eggs: 5, larvae: 0, workers: 10, food: 200, nestCapacity: 50, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 },
      });
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      // Use real timers — phase transition runs via setTimeout naturally
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });

      // Wait for real game tick + phase transition (setTimeout 300ms + 2000ms)
      await page.waitForTimeout(3500);

      // worker_assignment should now exist with panel-revealed class
      const wa = page.locator('#worker-assignment');
      await expect(wa).toBeAttached({ timeout: 5000 });
      await expect(wa).toHaveClass(/panel-revealed/);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Part B: Phase Theme Shifting
  // ═══════════════════════════════════════════════════════════════

  test.describe('Phase Theme Shifting', () => {
    test('egg_laying phase sets body class phase-egg on load', async ({ page }) => {
      // No clock.install needed — just verify initial state
      const data = makeSaveData();
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });
      await page.waitForTimeout(100);

      const hasEggClass = await page.evaluate(() =>
        document.body.classList.contains('phase-egg'),
      );
      expect(hasEggClass).toBe(true);
    });

    test('phase transition to colony sets body class phase-colony', async ({ page }) => {
      // Use workers=10 to trigger immediate EGG→COLONY transition on first tick
      const data = makeSaveData({ resources: { eggs: 5, larvae: 0, workers: 10, food: 200, nestCapacity: 50, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 } });
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      await page.clock.install();
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });

      // Fast-forward past the first tick + transition setTimeout(300ms) + transition animation(2s)
      await page.clock.runFor(4000);

      // Wait for transition to complete (overlay disappears)
      await expect(page.locator('#phase-transition-overlay.active')).not.toBeVisible({ timeout: 5000 });

      const hasColonyClass = await page.evaluate(() =>
        document.body.classList.contains('phase-colony'),
      );
      expect(hasColonyClass).toBe(true);

      const hasEggClass = await page.evaluate(() =>
        document.body.classList.contains('phase-egg'),
      );
      expect(hasEggClass).toBe(false);
    });

    test('phase body class changes on phase transition', async ({ page }) => {
      const data = makeSaveData({ resources: { eggs: 5, larvae: 0, workers: 10, food: 200, nestCapacity: 50, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 } });
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      await page.clock.install();
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });

      // Start in egg_laying
      let phaseClass = await page.evaluate(() => {
        const classes = Array.from(document.body.classList);
        return classes.find((c) => c.startsWith('phase-')) ?? null;
      });
      expect(phaseClass).toBe('phase-egg');

      // Trigger colony transition
      await page.clock.runFor(4000);

      // Wait for transition overlay to clear
      await expect(page.locator('#phase-transition-overlay.active')).not.toBeVisible({ timeout: 5000 });

      phaseClass = await page.evaluate(() => {
        const classes = Array.from(document.body.classList);
        return classes.find((c) => c.startsWith('phase-')) ?? null;
      });
      expect(phaseClass).toBe('phase-colony');
    });

    test('phase theme changes background color on transition', async ({ page }) => {
      const data = makeSaveData({ resources: { eggs: 5, larvae: 0, workers: 10, food: 200, nestCapacity: 50, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 } });
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      // No clock.install — CSS transitions need real time, not fake timers
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });

      // Read initial background color (egg_laying = warm amber)
      const colorBefore = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });
      expect(colorBefore).toBeTruthy();

      // Wait for game loop tick + phase transition + CSS theme transition to complete
      await page.waitForTimeout(5000);

      // Wait for transition overlay to clear
      await expect(page.locator('#phase-transition-overlay.active')).not.toBeVisible({ timeout: 5000 });

      // Verify body class changed to colony (triggers theme shift)
      const phaseClass = await page.evaluate(() => {
        const classes = Array.from(document.body.classList);
        return classes.find((c) => c.startsWith('phase-')) ?? null;
      });
      expect(phaseClass).toBe('phase-colony');

      // Read background color after transition (colony = deeper brown)
      const colorAfter = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });
      expect(colorAfter).toBeTruthy();
      expect(colorAfter).not.toBe(colorBefore);
    });
  });
});
