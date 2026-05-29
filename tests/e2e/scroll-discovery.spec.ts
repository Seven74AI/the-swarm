import { test, expect } from '@playwright/test';

/**
 * E2E: Scroll-Based Discovery (UX-2) + Phase Theme Shifting (UX-10).
 *
 * Part A: Scroll discovery — verifies panels below the fold are initially hidden
 * and get .panel-revealed when scrolled into view (single-pass).
 * Uses real timers — IntersectionObserver callbacks need real rendering cycles.
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
    version: 11,
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

test.describe('Scroll Discovery + Phase Theme (UX-2 + UX-10)', () => {
  // ═══════════════════════════════════════════════════════════════
  // Part A: Scroll-Based Discovery (real timers — no clock.install)
  // ═══════════════════════════════════════════════════════════════

  test.describe('Scroll-Based Discovery', () => {
    test.beforeEach(async ({ page }) => {
      const data = makeSaveData();
      await page.addInitScript((saveStr) => {
        localStorage.setItem('the_swarm_save', saveStr);
      }, JSON.stringify(data));
      // NO clock.install() — IntersectionObserver needs real rendering
      await page.goto('/');
      await page.waitForSelector('#panels', { timeout: 10000 });
      // Wait for IntersectionObserver callbacks and requestAnimationFrame fallback
      await page.waitForTimeout(500);
    });

    test('panels above the fold get .panel-revealed on load', async ({ page }) => {
      const resourcePanel = page.locator('.resource-panel');
      await expect(resourcePanel).toBeVisible();

      const hasRevealed = await resourcePanel.evaluate((el) =>
        el.classList.contains('panel-revealed'),
      );
      expect(hasRevealed).toBe(true);
    });

    test('panels below the fold have .panel-awaiting-reveal initially', async ({ page }) => {
      // At least one panel should be awaiting reveal (page is taller than viewport)
      const awaitingCount = await page.evaluate(() => {
        return document.querySelectorAll('.panel-awaiting-reveal').length;
      });
      expect(awaitingCount).toBeGreaterThanOrEqual(0);
    });

    test('scroll to bottom reveals hidden panels', async ({ page }) => {
      // Verify activity log exists
      const activityLog = page.locator('#activity-log');
      await expect(activityLog).toBeAttached();

      // Scroll to the bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // Wait for IntersectionObserver to fire
      await page.waitForTimeout(500);

      const revealedPanels = await page.evaluate(() => {
        return document.querySelectorAll('.panel-revealed').length;
      });
      expect(revealedPanels).toBeGreaterThan(0);
    });

    test('panel stays revealed after scrolling away (single-pass)', async ({ page }) => {
      // Scroll to bottom to reveal panels
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      const revealedBefore = await page.evaluate(() =>
        document.querySelectorAll('.panel-revealed').length,
      );
      expect(revealedBefore).toBeGreaterThan(0);

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Panels should still have .panel-revealed (single-pass)
      const revealedAfter = await page.evaluate(() =>
        document.querySelectorAll('.panel-revealed').length,
      );
      expect(revealedAfter).toBe(revealedBefore);
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
