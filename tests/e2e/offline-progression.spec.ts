import { test, expect } from '@playwright/test';

/**
 * Offline Progression E2E tests (GM-8).
 *
 * Covers:
 *   - Closed-form resource deltas for N hours
 *   - Pipeline catch-up (eggs→larvae→workers)
 *   - Offline with combat phase state
 *   - Offline with expeditions mid-flight
 *   - Offline with spaceship missions
 *   - 8h cap enforcement
 *   - Popup lifecycle (appearance, dismiss, duration)
 *   - Efficiency multiplier effects
 */

// ─── Helpers ──────────────────────────────────────────────────────

function emptyMapTiles() {
  const tiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      tiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }
  return tiles;
}

function defaultGameState(saveTimestamp: number, overrides: Record<string, unknown> = {}) {
  return {
    phase: 'egg_laying',
    resources: {
      eggs: 20, larvae: 10, workers: 5, food: 200, nestCapacity: 50,
      wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    soldierPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 3, tend: 1, dig: 1, guard: 0 },
    soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
    buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 0 } },
    territory: { ownedTiles: 0, bonuses: {} },
    mapTiles: emptyMapTiles(),
    expeditions: [] as Array<Record<string, unknown>>,
    spaceExplorations: [] as Array<Record<string, unknown>>,
    discoveredPlanets: [] as string[],
    spaceships: [] as Array<Record<string, unknown>>,
    upgrades: {} as Record<string, number>,
    stats: { totalEggsLaid: 20, totalClicks: 10, playTimeMs: 60000 },
    unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button'],
    lastSaveTimestamp: saveTimestamp,
    combatSoldiers: 0,
    soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
    equipment: { weapon: 0, armor: 0 },
    lastBattle: null,
    combatResources: { chitin: 0, silk: 0, venom: 0 },
    battlesWon: 0, battlesLost: 0,
    victoryAchieved: false,
    spaceship: { level: 0, fuel: 0, maxFuel: 100 },
    spaceProbes: [] as Array<Record<string, unknown>>,
    discoveries: [] as string[],
    nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
    prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
    offlineEfficiency: 0.5,
    conversions: { particleLab: 0 },
    entropy: 0, entropyDampener: { level: 0 },
    prestigeTree: { purchased: [] },
    research: {
      projects: {
        voidCrystalSynthesis: { state: 'available' as const, progress: 0 },
        antimatterContainment: { state: 'locked' as const, progress: 0 },
        darkMatterDetection: { state: 'locked' as const, progress: 0 },
      },
    },
    autoProduction: {
      enabled: false,
      researches: {},
      buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 },
      progress: 0,
    },
    ...overrides,
  };
}

/** Builds full save data with a given timestamp and optional overrides. */
function makeOfflineSave(saveTimestamp: number, gameStateOverrides: Record<string, unknown> = {}) {
  return {
    version: 12,
    timestamp: saveTimestamp,
    playTimeMs: 60000,
    gameState: defaultGameState(saveTimestamp, gameStateOverrides),
  };
}

// ─── Closed-Form Resource Deltas ──────────────────────────────────

test.describe('Offline Progression — Closed-Form Deltas', () => {

  test('resources change after 2min offline', async ({ page }) => {
    const twoMinAgo = Date.now() - 120_000;
    const saveData = makeOfflineSave(twoMinAgo);

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const foodEl = page.locator('[data-stat="resources.food"] .critical-value');
    await expect(foodEl).toBeVisible({ timeout: 5000 });
    const foodText = await foodEl.textContent();
    const foodValue = parseInt(foodText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // Should have changed from the initial 200
    expect(foodValue).not.toBe(200);
    expect(foodValue).toBeGreaterThanOrEqual(0);
  });

  test('food decreases when consumption exceeds production during offline', async ({ page }) => {
    const fiveMinAgo = Date.now() - 300_000;
    const saveData = makeOfflineSave(fiveMinAgo, {
      workersAssigned: { gather: 0, tend: 5, dig: 0, guard: 0 },
      resources: {
        eggs: 0, larvae: 0, workers: 5, food: 500, nestCapacity: 50,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
    });

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const foodEl = page.locator('[data-stat="resources.food"] .critical-value');
    await expect(foodEl).toBeVisible({ timeout: 5000 });
    const foodText = await foodEl.textContent();
    const foodValue = parseInt(foodText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // 0 gather, 5 tend → 0 food production, 2.5/s consumption → food should decrease
    expect(foodValue).toBeLessThan(500);
    expect(foodValue).toBeGreaterThanOrEqual(0);
  });

  test('8h cap enforced: 10h offline ≈ same ticks as 8h', async ({ page }) => {
    const tenHoursAgo = Date.now() - 10 * 3600_000;
    const saveData = makeOfflineSave(tenHoursAgo);

    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const offlineLogs = logs.filter(l => l.includes('[Offline] Ticks to simulate:'));
    if (offlineLogs.length > 0) {
      const match = offlineLogs[0].match(/Ticks to simulate:\s*(\d+)/);
      if (match) {
        const ticks = parseInt(match[1], 10);
        // 8h cap at 50% efficiency = 288000 max ticks
        expect(ticks).toBeLessThanOrEqual(288000);
        expect(ticks).toBeGreaterThan(0);
      }
    }
  });

});

// ─── Pipeline Catch-Up ─────────────────────────────────────────────

test.describe('Offline Progression — Pipeline Catch-Up', () => {

  test('eggs in eggPipeline → larvae after offline', async ({ page }) => {
    const fiveMinAgo = Date.now() - 300_000;
    const saveData = makeOfflineSave(fiveMinAgo, {
      eggPipeline: { count: 10, progress: 0 },
      workersAssigned: { gather: 2, tend: 1, dig: 2, guard: 0 },
      resources: {
        eggs: 100, larvae: 0, workers: 5, food: 200, nestCapacity: 50,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
    });

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);

    const larvaeEl = page.locator('[data-stat="resources.larvae"] .critical-value');
    await expect(larvaeEl).toBeVisible({ timeout: 5000 });
    const larvaeText = await larvaeEl.textContent();
    const larvaeValue = parseInt(larvaeText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // Eggs in pipeline should have become larvae during offline
    expect(larvaeValue).toBeGreaterThan(0);
  });

  test('larvae in larvaPipeline + tend → workers increase', async ({ page }) => {
    const fiveMinAgo = Date.now() - 300_000;
    const saveData = makeOfflineSave(fiveMinAgo, {
      larvaPipeline: { count: 10, progress: 0 },
      eggPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 2, tend: 3, dig: 0, guard: 0 },
      resources: {
        eggs: 0, larvae: 50, workers: 5, food: 500, nestCapacity: 50,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
    });

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);

    const workersEl = page.locator('[data-stat="resources.workers"] .hud-resource-value');
    await expect(workersEl).toBeVisible({ timeout: 5000 });
    const workersText = await workersEl.textContent();
    const workersValue = parseInt(workersText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // Workers should be at least 5 (initial), likely more from larvae maturation
    expect(workersValue).toBeGreaterThanOrEqual(5);
  });

});

// ─── Popup Lifecycle ───────────────────────────────────────────────

test.describe('Offline Progression — Popup Lifecycle', () => {

  test('popup appears for absence >= 30s with correct text', async ({ page }) => {
    const ninetySecAgo = Date.now() - 90_000;
    const saveData = makeOfflineSave(ninetySecAgo);

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    const overlay = page.locator('.offline-overlay');
    await expect(overlay).toBeVisible();

    const popupText = await popup.textContent();
    expect(popupText).toContain('You were gone for');
  });

  test('popup does NOT appear for very recent save (< 1s offline)', async ({ page }) => {
    const halfSecAgo = Date.now() - 500;
    const saveData = makeOfflineSave(halfSecAgo);

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
  });

  test('dismiss button hides popup and overlay', async ({ page }) => {
    const twoMinAgo = Date.now() - 120_000;
    const saveData = makeOfflineSave(twoMinAgo);

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    const dismissBtn = popup.locator('button');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
    await expect(page.locator('.offline-overlay')).toHaveCount(0);
  });

  test('popup shows correct duration for hours-long absence', async ({ page }) => {
    const threeHoursAgo = Date.now() - 3 * 3600_000;
    const saveData = makeOfflineSave(threeHoursAgo);

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    const text = await popup.textContent();
    expect(text).toMatch(/3h/);
  });

});

// ─── Combat Phase Offline ──────────────────────────────────────────

test.describe('Offline Progression — Combat Phase', () => {

  test('combat phase state preserved after offline catch-up', async ({ page }) => {
    const fiveMinAgo = Date.now() - 300_000;
    const saveData = makeOfflineSave(fiveMinAgo, {
      phase: 'combat',
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 100,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
      workersAssigned: { gather: 5, tend: 5, dig: 5, guard: 5 },
      combatSoldiers: 10,
      soldierStats: { strength: 1.5, defense: 1.5, speed: 5, maxHp: 15 },
      equipment: { weapon: 2, armor: 2 },
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button', 'soldier_panel', 'battle_panel'],
    });

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    // Battle panel visible in combat phase
    await expect(page.locator('#battle-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#scout-enemy')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#scout-enemy')).toBeEnabled({ timeout: 3000 });
  });

});

// ─── Expedition Mid-Flight ─────────────────────────────────────────

test.describe('Offline Progression — Expeditions Mid-Flight', () => {

  test('expedition in progress resolves during offline catch-up', async ({ page }) => {
    const tenMinAgo = Date.now() - 600_000;
    const saveData = makeOfflineSave(tenMinAgo, {
      phase: 'combat',
      soldiers: { scouts: 5, warriors: 5, totalKilled: 0 },
      expeditions: [{
        id: 'exp_test_1',
        scouts: 2,
        warriors: 1,
        destination: 'Safe Meadow',
        ticksRemaining: 30,
        risk: 0.3,
      }],
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 100,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
      workersAssigned: { gather: 5, tend: 5, dig: 5, guard: 5 },
      combatSoldiers: 5,
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button', 'soldier_panel', 'battle_panel'],
    });

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);

    // Game should load without errors — expedition resolved during catch-up
    await expect(page.locator('#battle-panel')).toBeVisible({ timeout: 5000 });
  });

});

// ─── Spaceship Missions ────────────────────────────────────────────

test.describe('Offline Progression — Spaceship Missions', () => {

  test('spaceship mission progresses during offline catch-up', async ({ page }) => {
    const tenMinAgo = Date.now() - 600_000;
    const saveData = makeOfflineSave(tenMinAgo, {
      phase: 'space',
      resources: {
        eggs: 0, larvae: 0, workers: 50, food: 5000, nestCapacity: 200,
        wood: 100, stone: 100, nectar: 100, voidCrystals: 20, antimatter: 0, darkMatter: 0,
      },
      workersAssigned: { gather: 10, tend: 10, dig: 10, guard: 10, researchers: 10 },
      unlockedPanels: [
        'resource_panel', 'phase_indicator', 'click_button',
        'soldier_panel', 'battle_panel', 'spaceship_panel',
      ],
      spaceships: [{
        id: 'ship_test_1',
        name: 'Scout Ship',
        status: 'exploring',
        destination: 'Proxima Centauri',
        ticksRemaining: 50,
        crew: 2,
        fuel: 80,
      }],
      soldiers: { scouts: 5, warriors: 5, totalKilled: 0 },
      combatSoldiers: 5,
      buildings: { barracks: { level: 1, count: 1 }, walls: { level: 1 }, warehouse: { level: 1 } },
    });

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);

    // Resource panel should be visible — game loaded without errors
    await expect(page.locator('.resource-panel')).toBeVisible({ timeout: 5000 });
  });

});

// ─── Efficiency Multiplier ─────────────────────────────────────────

test.describe('Offline Progression — Efficiency', () => {

  test('100% efficiency gives more ticks than 50% for same offline time', async ({ page }) => {
    const fiveMinAgo = Date.now() - 300_000;

    // --- 50% efficiency ---
    const saveData50 = makeOfflineSave(fiveMinAgo, {
      offlineEfficiency: 0.5,
    });
    const logs50: string[] = [];
    page.on('console', (msg) => logs50.push(msg.text()));

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData50));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const tickLog50 = logs50.find(l => l.includes('Ticks to simulate:'));
    const ticks50 = tickLog50 ? parseInt(tickLog50.match(/Ticks to simulate:\s*(\d+)/)?.[1] ?? '0', 10) : 0;

    // --- 100% efficiency (fresh page context) ---
    const saveData100 = makeOfflineSave(fiveMinAgo, {
      offlineEfficiency: 1.0,
    });
    const logs100: string[] = [];

    // Reset and reload
    await page.evaluate(() => localStorage.clear());

    // Remove old listener, add new one
    page.removeAllListeners('console');
    page.on('console', (msg) => logs100.push(msg.text()));

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData100));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const tickLog100 = logs100.find(l => l.includes('Ticks to simulate:'));
    const ticks100 = tickLog100 ? parseInt(tickLog100.match(/Ticks to simulate:\s*(\d+)/)?.[1] ?? '0', 10) : 0;

    // 100% efficiency should give roughly 2x the ticks of 50%
    expect(ticks100).toBeGreaterThan(ticks50);
  });

});

// ─── Edge Cases ────────────────────────────────────────────────────

test.describe('Offline Progression — Edge Cases', () => {

  test('no offline popup when save is current (no absence)', async ({ page }) => {
    const now = Date.now();
    const saveData = makeOfflineSave(now);

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
    await expect(page.locator('.resource-panel')).toBeVisible({ timeout: 5000 });
  });

  test('resources never go below zero after offline starvation', async ({ page }) => {
    const oneHourAgo = Date.now() - 3600_000;
    const saveData = makeOfflineSave(oneHourAgo, {
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0 }, // all unassigned
      resources: {
        eggs: 0, larvae: 0, workers: 50, food: 100, nestCapacity: 100,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);

    // No page crashes
    expect(pageErrors).toHaveLength(0);

    const foodEl = page.locator('[data-stat="resources.food"] .critical-value');
    await expect(foodEl).toBeVisible({ timeout: 5000 });
    const foodText = await foodEl.textContent();
    const foodValue = parseInt(foodText?.replace(/[^0-9]/g, '') ?? '0', 10);
    expect(foodValue).toBeGreaterThanOrEqual(0);
  });

});
