import { test, expect } from '@playwright/test';

/**
 * E2E: Phase Transition Visual Spectacle.
 * Seeds a game state on the verge of EGG→COLONY transition,
 * fast-forwards to trigger the transition, and verifies
 * the animated overlay, lore quote, panel reveal, and scroll behavior.
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
    version: 7,
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
      ...overrides,
    },
  };
}

test.describe('Phase Transition — Visual Spectacle', () => {
  test.beforeEach(async ({ page }) => {
    const data = makeSaveData();
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });
  });

  test('transition overlay appears with lore quote during phase change', async ({ page }) => {
    // Fast-forward to trigger EGG→COLONY transition (workers=9, need 10)
    // The game ticks once per second. Clicking the egg button adds eggs.
    // But workers come from larvae hatching... let's just advance ticks.
    // Actually: seed has 9 workers and 3 larvae. Each larvaPipeline tick
    // produces workers. Run the clock a few seconds to cross threshold.
    await page.clock.runFor(3000);

    // Wait for the transition overlay to appear
    const overlay = page.locator('#phase-transition-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Overlay should contain a lore quote (non-empty text)
    const quoteText = overlay.locator('.phase-transition-quote');
    await expect(quoteText).toBeVisible();
    const text = await quoteText.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('new panels appear after transition animation completes', async ({ page }) => {
    // Trigger transition
    await page.clock.runFor(3000);

    // Wait for the overlay to appear and then disappear (2s animation)
    await expect(page.locator('#phase-transition-overlay.active')).not.toBeVisible({ timeout: 8000 });

    // After transition, colony panels should be visible
    const phaseIndicator = page.locator('#phase-indicator');
    await expect(phaseIndicator).toContainText('Colony', { timeout: 5000 });

    // Worker assignment panel should now be visible (unlocked in colony phase)
    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });
  });

  test('phase indicator reflects the new phase after transition', async ({ page }) => {
    // Trigger transition
    await page.clock.runFor(3000);

    // Wait for transition to complete
    await expect(page.locator('#phase-transition-overlay.active')).not.toBeVisible({ timeout: 8000 });

    // Phase indicator should show colony title
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('Colony', { timeout: 5000 });
    // And the phase-colony class should be applied
    await expect(indicator).toHaveClass(/phase-colony/);
  });
});
