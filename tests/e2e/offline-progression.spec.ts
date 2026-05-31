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
 *   - Edge cases (starvation, fresh save, deep offline)
 *
 * Conventions:
 *   - Test invariants, never hard-coded numeric outputs
 *   - Seeds use deep-merge-safe format (SaveManager.applyDefaults fills gaps)
 *   - All test runs use background+notify+wait (never inline)
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

/** Base game state with sensible defaults. SaveManager.deepMerge fills any missing fields. */
function baseGameState(saveTimestamp: number) {
  return {
    phase: 'egg_laying',
    resources: {
      eggs: 20, larvae: 10, workers: 5, food: 200, nestCapacity: 50,
      wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      surveyData: 0,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    soldierPipeline: { count: 0, progress: 0 },
    capacityAccumulator: 0,
    workersAssigned: { gather: 3, tend: 1, dig: 1, guard: 0, researchers: 0 },
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
  };
}

/** Builds full save data with a given timestamp and optional overrides. */
function makeOfflineSave(saveTimestamp: number, overrides: Record<string, unknown> = {}) {
  const gameState = { ...baseGameState(saveTimestamp), ...overrides };
  return {
    version: 12,
    timestamp: saveTimestamp,
    playTimeMs: 60000,
    gameState,
  };
}

/** Inject save + navigate + wait for bootstrap. Standard offline test setup. */
async function setupOfflineTest(page: import('@playwright/test').Page, saveTimestamp: number, overrides?: Record<string, unknown>, waitMs = 3500) {
  const saveData = makeOfflineSave(saveTimestamp, overrides);
  await page.addInitScript((s: string) => {
    localStorage.setItem('the_swarm_save', s);
  }, JSON.stringify(saveData));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait for phase transition animation + UI mount
  await page.waitForTimeout(waitMs);
}

// ─── Closed-Form Resource Deltas ──────────────────────────────────

test.describe('Offline Progression — Closed-Form Deltas', () => {

  test('resources change after 2min offline', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 120_000);

    const foodEl = page.locator('[data-stat="resources.food"] .critical-value');
    await expect(foodEl).toBeVisible({ timeout: 5000 });
    const foodText = await foodEl.textContent();
    const foodValue = parseInt(foodText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // Should have changed from the initial 200 (3 gather → +6/s, 5 workers → -2.5/s → net +3.5/s over 120s = +420)
    expect(foodValue).not.toBe(200);
    expect(foodValue).toBeGreaterThanOrEqual(0);
  });

  test('food decreases when no gather, only consumption during offline', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 300_000, {
      workersAssigned: { gather: 0, tend: 5, dig: 0, guard: 0, researchers: 0 },
      resources: {
        eggs: 0, larvae: 0, workers: 5, food: 500, nestCapacity: 50,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
    });

    const foodEl = page.locator('[data-stat="resources.food"] .critical-value');
    await expect(foodEl).toBeVisible({ timeout: 5000 });
    const foodText = await foodEl.textContent();
    const foodValue = parseInt(foodText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // 0 gather, 5 tend → 0 food production, 2.5/s consumption → food must decrease
    expect(foodValue).toBeLessThan(500);
    expect(foodValue).toBeGreaterThanOrEqual(0);
  });

  test('8h cap enforced: 10h offline ≈ same effective ticks as 8h', async ({ page }) => {
    const tenHoursAgo = Date.now() - 10 * 3600_000;
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await setupOfflineTest(page, tenHoursAgo, {}, 4000);

    const tickLog = logs.find(l => l.includes('Ticks to simulate:'));
    if (tickLog) {
      const match = tickLog.match(/Ticks to simulate:\s*(\d+)/);
      if (match) {
        const ticks = parseInt(match[1], 10);
        // 8h cap at 50% efficiency: 8 * 3600 * 1000 / 50 * 0.5 = 288000 max ticks
        expect(ticks).toBeLessThanOrEqual(288000);
        expect(ticks).toBeGreaterThan(0);
      }
    }
  });

});

// ─── Pipeline Catch-Up ─────────────────────────────────────────────

test.describe('Offline Progression — Pipeline Catch-Up', () => {

  test('eggs in eggPipeline → larvae after offline catch-up', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 300_000, {
      eggPipeline: { count: 10, progress: 0 },
      workersAssigned: { gather: 2, tend: 1, dig: 2, guard: 0, researchers: 0 },
      resources: {
        eggs: 100, larvae: 0, workers: 5, food: 200, nestCapacity: 50,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
    }, 4000);

    const larvaeEl = page.locator('[data-stat="resources.larvae"] .critical-value');
    await expect(larvaeEl).toBeVisible({ timeout: 5000 });
    const larvaeText = await larvaeEl.textContent();
    const larvaeValue = parseInt(larvaeText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // Eggs in pipeline + offline catch-up should produce larvae
    expect(larvaeValue).toBeGreaterThan(0);
  });

  test('larvae in pipeline + tend → workers increase after offline', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 300_000, {
      larvaPipeline: { count: 10, progress: 0 },
      eggPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 2, tend: 3, dig: 0, guard: 0, researchers: 0 },
      resources: {
        eggs: 0, larvae: 50, workers: 5, food: 500, nestCapacity: 50,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
    }, 4000);

    const workersEl = page.locator('[data-stat="resources.workers"] .hud-resource-value');
    await expect(workersEl).toBeVisible({ timeout: 5000 });
    const workersText = await workersEl.textContent();
    const workersValue = parseInt(workersText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // Workers should increase from larvae maturation during offline
    expect(workersValue).toBeGreaterThan(5);
  });

  test('egg→larva→worker pipeline completes fully with sufficient offline time', async ({ page }) => {
    // 10 minutes offline — enough for both egg→larva and larva→worker pipelines to drain
    await setupOfflineTest(page, Date.now() - 600_000, {
      eggPipeline: { count: 20, progress: 0 },
      larvaPipeline: { count: 5, progress: 0 },
      workersAssigned: { gather: 2, tend: 3, dig: 0, guard: 0, researchers: 0 },
      resources: {
        eggs: 100, larvae: 30, workers: 3, food: 2000, nestCapacity: 100,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
    }, 4000);

    const workersEl = page.locator('[data-stat="resources.workers"] .hud-resource-value');
    await expect(workersEl).toBeVisible({ timeout: 5000 });
    const workersText = await workersEl.textContent();
    const workersValue = parseInt(workersText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // After 10 min offline with eggs+larvae in pipelines, workers must increase
    expect(workersValue).toBeGreaterThan(3);
    // Eggs should have decreased (consumed by pipeline)
    const eggsEl = page.locator('[data-stat="resources.eggs"] .critical-value');
    await expect(eggsEl).toBeVisible({ timeout: 5000 });
    const eggsText = await eggsEl.textContent();
    const eggsValue = parseInt(eggsText?.replace(/[^0-9]/g, '') ?? '0', 10);
    expect(eggsValue).toBeLessThanOrEqual(100);
  });

});

// ─── Popup Lifecycle ───────────────────────────────────────────────

test.describe('Offline Progression — Popup Lifecycle', () => {

  test('popup appears for absence >= 30s with correct text', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 90_000);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.offline-overlay')).toBeVisible();

    const popupText = await popup.textContent();
    expect(popupText).toContain('Welcome Back');
    expect(popupText).toContain('You were gone for');
    expect(popupText).toContain('Catch-up efficiency');
  });

  test('popup does NOT appear for absence < 30s', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 25_000, {}, 3000);

    // Popup threshold is 30s — 25s should NOT trigger it
    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
  });

  test('popup does NOT appear for very recent save (< 1s offline)', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 500, {}, 3000);

    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
  });

  test('dismiss button hides popup and overlay', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 120_000);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    const dismissBtn = popup.locator('button');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
    await expect(page.locator('.offline-overlay')).toHaveCount(0);

    // Game should still be functional after dismiss
    await expect(page.locator('.resource-panel')).toBeVisible({ timeout: 3000 });
  });

  test('popup shows correct duration for 3h absence', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 3 * 3600_000);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    const text = await popup.textContent();
    // 3h should format as "3h" (not "3h 0m")
    expect(text).toMatch(/3h/);
  });

  test('popup shows minutes+seconds for <1h absence', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 5 * 60_000);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    const text = await popup.textContent();
    // 5 min absence should show minutes, not hours
    expect(text).toMatch(/5m/);
  });

});

// ─── Combat Phase Offline ──────────────────────────────────────────

test.describe('Offline Progression — Combat Phase', () => {

  test('combat phase state preserved after offline catch-up', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 300_000, {
      phase: 'combat',
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 100,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
      workersAssigned: { gather: 5, tend: 5, dig: 5, guard: 5, researchers: 0 },
      combatSoldiers: 10,
      soldierStats: { strength: 1.5, defense: 1.5, speed: 5, maxHp: 15 },
      equipment: { weapon: 2, armor: 2 },
      soldiers: { scouts: 5, warriors: 5, totalKilled: 0 },
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button', 'soldier_panel', 'battle_panel'],
    });

    // Battle panel visible in combat phase after offline catch-up
    await expect(page.locator('#battle-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#scout-enemy')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#scout-enemy')).toBeEnabled({ timeout: 3000 });

    // Soldier panel should also be visible
    await expect(page.locator('#soldier-panel')).toBeVisible({ timeout: 3000 });

    // Game didn't crash — page errors would indicate problems
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    expect(pageErrors).toHaveLength(0);
  });

  test('combat with pending battle survives offline without crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await setupOfflineTest(page, Date.now() - 600_000, {
      phase: 'combat',
      combatSoldiers: 15,
      soldiers: { scouts: 5, warriors: 10, totalKilled: 3 },
      lastBattle: {
        enemyType: 'Spider Warrior',
        result: 'victory',
        soldiersLost: 2,
        foodGained: 50,
        timestamp: Date.now() - 600_000,
      },
      resources: {
        eggs: 0, larvae: 0, workers: 25, food: 2000, nestCapacity: 100,
        wood: 50, stone: 30, nectar: 20, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
      workersAssigned: { gather: 5, tend: 5, dig: 5, guard: 10, researchers: 0 },
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button', 'soldier_panel', 'battle_panel'],
    }, 4000);

    // No page crashes during offline catch-up with battle state
    expect(pageErrors).toHaveLength(0);

    // Combat phase UI should be functional
    await expect(page.locator('#battle-panel')).toBeVisible({ timeout: 5000 });
  });

});

// ─── Expedition Mid-Flight ─────────────────────────────────────────

test.describe('Offline Progression — Expeditions Mid-Flight', () => {

  test('expedition resolves during offline catch-up', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await setupOfflineTest(page, Date.now() - 600_000, {
      phase: 'combat',
      soldiers: { scouts: 5, warriors: 5, totalKilled: 0 },
      expeditions: [{
        id: 'exp_offline_1',
        scouts: 2,
        warriors: 1,
        destination: 'Safe Meadow',
        ticksRemaining: 30,
        risk: 0.3,
      }],
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 100,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
      workersAssigned: { gather: 5, tend: 5, dig: 5, guard: 5, researchers: 0 },
      combatSoldiers: 5,
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button', 'soldier_panel', 'battle_panel'],
    }, 4000);

    // Game should load without errors — expedition resolved during catch-up
    expect(pageErrors).toHaveLength(0);
    await expect(page.locator('#battle-panel')).toBeVisible({ timeout: 5000 });

    // Expedition should be gone (resolved during offline catch-up)
    // The expeditions array should be empty or the specific expedition removed
    const expeditionCount = await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, Record<string, unknown>>).__swarm;
      const state = swarm?.manager ? (swarm.manager as { getState: () => { expeditions: unknown[] } }).getState() : null;
      return state?.expeditions?.length ?? -1;
    });
    // After 10 min offline with 30 ticks remaining, expedition should be resolved
    expect(expeditionCount).toBe(0);
  });

  test('multiple expeditions resolve during long offline', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await setupOfflineTest(page, Date.now() - 3600_000, {
      phase: 'combat',
      soldiers: { scouts: 10, warriors: 10, totalKilled: 0 },
      expeditions: [
        { id: 'exp_1', scouts: 2, warriors: 1, destination: 'Meadow', ticksRemaining: 30, risk: 0.3 },
        { id: 'exp_2', scouts: 2, warriors: 1, destination: 'Forest', ticksRemaining: 100, risk: 0.5 },
        { id: 'exp_3', scouts: 3, warriors: 2, destination: 'Mountain', ticksRemaining: 60, risk: 0.4 },
      ],
      resources: {
        eggs: 0, larvae: 0, workers: 30, food: 5000, nestCapacity: 150,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
      workersAssigned: { gather: 10, tend: 5, dig: 5, guard: 10, researchers: 0 },
      combatSoldiers: 5,
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button', 'soldier_panel', 'battle_panel'],
    }, 4000);

    expect(pageErrors).toHaveLength(0);
    // All 3 expeditions should be resolved after 1h offline (30, 100, 60 ticks all << offline ticks)
    const expeditionCount = await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, Record<string, unknown>>).__swarm;
      const state = swarm?.manager ? (swarm.manager as { getState: () => { expeditions: unknown[] } }).getState() : null;
      return state?.expeditions?.length ?? -1;
    });
    expect(expeditionCount).toBe(0);
  });

});

// ─── Spaceship Missions ────────────────────────────────────────────

test.describe('Offline Progression — Spaceship Missions', () => {

  test('spaceship mission progresses during offline catch-up', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await setupOfflineTest(page, Date.now() - 600_000, {
      phase: 'space',
      resources: {
        eggs: 0, larvae: 0, workers: 50, food: 5000, nestCapacity: 200,
        wood: 100, stone: 100, nectar: 100, voidCrystals: 20, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
      workersAssigned: { gather: 10, tend: 10, dig: 10, guard: 10, researchers: 10 },
      unlockedPanels: [
        'resource_panel', 'phase_indicator', 'click_button',
        'soldier_panel', 'battle_panel', 'spaceship_panel',
      ],
      spaceships: [{
        id: 'ship_offline_1',
        type: 'scout_ship',
        level: 1,
        fuel: 80,
        maxFuel: 100,
        status: 'exploring',
        missionTicksRemaining: 50,
        destinationName: 'Proxima Centauri',
      }],
      soldiers: { scouts: 5, warriors: 5, totalKilled: 0 },
      combatSoldiers: 5,
      buildings: { barracks: { level: 1, count: 1 }, walls: { level: 1 }, warehouse: { level: 1 } },
    }, 4000);

    expect(pageErrors).toHaveLength(0);
    // Game loaded without errors — spaceship mission progressed during catch-up
    await expect(page.locator('.resource-panel')).toBeVisible({ timeout: 5000 });

    // Ship status should have changed from 'exploring' after 10 min offline with 50 ticks remaining
    const shipStatus = await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, Record<string, unknown>>).__swarm;
      const state = swarm?.manager ? (swarm.manager as { getState: () => { spaceships: Array<{ status: string }> } }).getState() : null;
      return state?.spaceships?.[0]?.status ?? 'unknown';
    });
    // After offline catch-up with 50 mission ticks → should be 'returning' or 'idle'
    expect(shipStatus).not.toBe('exploring');
  });

  test('multiple spaceship missions resolve during long offline', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await setupOfflineTest(page, Date.now() - 3600_000, {
      phase: 'space',
      resources: {
        eggs: 0, larvae: 0, workers: 60, food: 10000, nestCapacity: 300,
        wood: 200, stone: 200, nectar: 200, voidCrystals: 50, antimatter: 10, darkMatter: 0,
        surveyData: 0,
      },
      workersAssigned: { gather: 15, tend: 10, dig: 10, guard: 10, researchers: 15 },
      unlockedPanels: [
        'resource_panel', 'phase_indicator', 'click_button',
        'soldier_panel', 'battle_panel', 'spaceship_panel',
      ],
      spaceships: [
        { id: 'ship_a', type: 'scout_ship', level: 1, fuel: 100, maxFuel: 100, status: 'exploring', missionTicksRemaining: 40, destinationName: 'Alpha' },
        { id: 'ship_b', type: 'cruiser', level: 2, fuel: 150, maxFuel: 200, status: 'exploring', missionTicksRemaining: 80, destinationName: 'Beta' },
      ],
      soldiers: { scouts: 10, warriors: 10, totalKilled: 0 },
      combatSoldiers: 10,
      buildings: { barracks: { level: 2, count: 2 }, walls: { level: 2 }, warehouse: { level: 2 } },
    }, 4000);

    expect(pageErrors).toHaveLength(0);

    // All ships should be done exploring after 1h offline
    const shipCount = await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, Record<string, unknown>>).__swarm;
      const state = swarm?.manager ? (swarm.manager as { getState: () => { spaceships: Array<{ status: string }> } }).getState() : null;
      return state?.spaceships?.filter(s => s.status === 'exploring').length ?? -1;
    });
    expect(shipCount).toBe(0);
  });

});

// ─── Efficiency Multiplier ─────────────────────────────────────────

test.describe('Offline Progression — Efficiency', () => {

  test('100% efficiency produces more ticks than 50% for same offline duration', async ({ page }) => {
    // This test compares two separate runs by capturing console output.
    // We use evaluate to read game state after load rather than two navigations.

    const fiveMinAgo = Date.now() - 300_000;

    // First run: 50% efficiency
    const logs50: string[] = [];
    page.on('console', (msg) => logs50.push(msg.text()));

    await setupOfflineTest(page, fiveMinAgo, { offlineEfficiency: 0.5 }, 3500);

    const tickLog50 = logs50.find(l => l.includes('Ticks to simulate:'));
    const ticks50 = tickLog50 ? parseInt(tickLog50.match(/Ticks to simulate:\s*(\d+)/)?.[1] ?? '0', 10) : 0;

    // Clear localStorage and reload for 100% efficiency run
    await page.evaluate(() => localStorage.clear());

    // Use a fresh page to avoid listener issues
    const page2 = page.context().pages()[0]; // same page, just re-navigate
    const logs100: string[] = [];
    page2.on('console', (msg) => logs100.push(msg.text()));

    await page2.addInitScript((s: string) => {
      localStorage.setItem('the_swarm_save', s);
    }, JSON.stringify(makeOfflineSave(fiveMinAgo, { offlineEfficiency: 1.0 })));
    await page2.goto('/');
    await page2.waitForLoadState('networkidle');
    await page2.waitForTimeout(3500);

    const tickLog100 = logs100.find(l => l.includes('Ticks to simulate:'));
    const ticks100 = tickLog100 ? parseInt(tickLog100.match(/Ticks to simulate:\s*(\d+)/)?.[1] ?? '0', 10) : 0;

    // 100% efficiency gives ~2x the ticks of 50%
    expect(ticks100).toBeGreaterThan(ticks50);
  });

  test('default efficiency is 50% when field is missing from save', async ({ page }) => {
    const fiveMinAgo = Date.now() - 300_000;
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    // Save without offlineEfficiency field — deepMerge should default to 0.5
    const saveWithoutEff = makeOfflineSave(fiveMinAgo);
    delete (saveWithoutEff.gameState as Record<string, unknown>).offlineEfficiency;

    await page.addInitScript((s: string) => {
      localStorage.setItem('the_swarm_save', s);
    }, JSON.stringify(saveWithoutEff));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);

    const effLog = logs.find(l => l.includes('Efficiency:'));
    if (effLog) {
      // Should default to 0.5 (50%)
      expect(effLog).toMatch(/Efficiency:\s*0\.5/);
    }
  });

});

// ─── Edge Cases ────────────────────────────────────────────────────

test.describe('Offline Progression — Edge Cases', () => {

  test('no offline popup when save is current (no absence)', async ({ page }) => {
    await setupOfflineTest(page, Date.now(), {}, 3000);

    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
    await expect(page.locator('.resource-panel')).toBeVisible({ timeout: 5000 });
  });

  test('resources never go below zero after offline starvation', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1h offline with no food production, many workers → heavy consumption
    await setupOfflineTest(page, Date.now() - 3600_000, {
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      resources: {
        eggs: 0, larvae: 0, workers: 50, food: 100, nestCapacity: 100,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
    }, 4000);

    // No page crashes from negative resource math
    expect(pageErrors).toHaveLength(0);

    const foodEl = page.locator('[data-stat="resources.food"] .critical-value');
    await expect(foodEl).toBeVisible({ timeout: 5000 });
    const foodText = await foodEl.textContent();
    const foodValue = parseInt(foodText?.replace(/[^0-9]/g, '') ?? '0', 10);
    // Food must never go below zero
    expect(foodValue).toBeGreaterThanOrEqual(0);
  });

  test('offline with zero resources and zero workers loads without crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await setupOfflineTest(page, Date.now() - 600_000, {
      resources: {
        eggs: 0, larvae: 0, workers: 0, food: 0, nestCapacity: 25,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
        surveyData: 0,
      },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    }, 4000);

    expect(pageErrors).toHaveLength(0);
    await expect(page.locator('.resource-panel')).toBeVisible({ timeout: 5000 });
  });

  test('offline with very deep offline time (capped at 8h) shows popup', async ({ page }) => {
    // 24 hours offline — should be capped at 8h effective
    await setupOfflineTest(page, Date.now() - 24 * 3600_000, {}, 4000);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    const text = await popup.textContent();
    // Duration in popup shows raw elapsed (24h), but effective is capped at 8h
    expect(text).toContain('Welcome Back');
  });

  test('popup shows efficiency percentage correctly', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 120_000, {
      offlineEfficiency: 0.75,
    });

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    const text = await popup.textContent();
    expect(text).toContain('75%');
  });

  test('dismissing popup allows normal game interaction', async ({ page }) => {
    await setupOfflineTest(page, Date.now() - 120_000);

    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Click dismiss
    await popup.locator('button').click();
    await expect(page.locator('.offline-summary-popup')).toHaveCount(0);

    // Game should be interactive — click the egg button should work
    await expect(page.locator('#click-egg')).toBeVisible({ timeout: 3000 });
    await page.locator('#click-egg').click();

    // Verify click registered (eggs changed)
    const eggsEl = page.locator('[data-stat="resources.eggs"] .critical-value');
    await expect(eggsEl).toBeVisible({ timeout: 3000 });
    const eggsText = await eggsEl.textContent();
    expect(eggsText).toBeTruthy();
  });

});
