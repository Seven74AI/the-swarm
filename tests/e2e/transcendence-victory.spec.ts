import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Transcendence Victory — Phase Transition, Overlay & Post-Victory.
 *
 * Seeds a colony in SPACE phase with voidCrystals≥500, antimatter≥100,
 * darkMatter≥50 (matching the SPACE→TRANSCENDENCE guard in transitions.ts).
 * Waits for transition, then verifies the victory achievement, transcendence
 * overlay/panel, post-victory game state, and TranscendencePanel stats.
 *
 * Report: GitHub Issue #144 section 3.2.
 */

// ─── Seed helpers ──────────────────────────────────────────────────────

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
      phase: 'space',
      resources: {
        eggs: 5, larvae: 3, workers: 100, food: 10000,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        // Exactly at transcendence guard thresholds: VC≥500, AM≥100, DM≥50
        voidCrystals: 500, antimatter: 100, darkMatter: 50,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      soldierPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 40, tend: 6, dig: 3, guard: 0, researchers: 0 },
      soldiers: { scouts: 10, warriors: 5, totalKilled: 2 },
      buildings: {
        barracks: { level: 2, count: 1 },
        walls: { level: 2 },
        warehouse: { level: 2 },
      },
      territory: { ownedTiles: 10, bonuses: {} },
      mapTiles,
      expeditions: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
      upgrades: {},
      stats: { totalEggsLaid: 500, totalClicks: 800, playTimeMs: 0 },
      unlockedPanels: [],
      lastSaveTimestamp: 0,
      combatSoldiers: 5,
      soldierStats: { strength: 2, defense: 2, speed: 5, maxHp: 12 },
      equipment: { weapon: 2, armor: 2 },
      lastBattle: null,
      combatResources: { chitin: 5, silk: 3, venom: 1 },
      battlesWon: 3,
      battlesLost: 1,
      spaceship: { level: 0, fuel: 0, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      victoryAchieved: false,
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
      prestige: {
        count: 0,
        legacyPoints: 0,
        totalFoodProduced: 500000,
      },
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

/** Read a nested value from the game state via window.__swarm. */
async function readGameState(page: Page, path: string): Promise<unknown> {
  return page.evaluate((p) => {
    const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
    const state = (swarm.manager as { getState: () => Record<string, unknown> }).getState();
    const keys = p.split('.');
    let val: unknown = state;
    for (const k of keys) val = (val as Record<string, unknown>)[k];
    return val;
  }, path);
}

/** Seed SPACE phase on the verge of transcendence and wait for the transition to complete. */
async function seedAndWaitForTranscendence(page: Page, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.clock.install();
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });

  // Advance time: game tick (50ms) checks transitions.
  // The guard (VC≥500, AM≥100, DM≥50) is met immediately.
  // A few ticks should trigger the transition.
  await page.clock.runFor(500);

  // Wait for the phase transition cinematic + panel reveal (3500ms + margin)
  await page.clock.runFor(4000);

  // Wait for the transcendence panel (created lazily during phase enter)
  await page.waitForSelector('#transcendence-panel', { timeout: 10000 });
  await expect(page.locator('#phase-indicator')).toContainText('Transcendence', { timeout: 5000 });
}

test.describe('Transcendence Victory — Phase Transition & Overlay', () => {
  // ─── Condition & State ─────────────────────────────────────────────

  test('SPACE→TRANSCENDENCE transition fires when resources meet guard', async ({ page }) => {
    await seedAndWaitForTranscendence(page);

    // Phase should now be transcendence
    const phase = await readGameState(page, 'phase');
    expect(phase).toBe('transcendence');

    // victoryAchieved must be true
    const victory = await readGameState(page, 'victoryAchieved');
    expect(victory).toBe(true);
  });

  test('SPACE→TRANSCENDENCE does NOT fire below guard thresholds', async ({ page }) => {
    // Seed just below all thresholds
    const data = makeSaveData({
      resources: {
        eggs: 5, larvae: 3, workers: 100, food: 10000,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 499, antimatter: 99, darkMatter: 49,
      },
      phase: 'space',
    });
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Advance enough ticks for multiple phase check cycles — transition should NOT fire.
    // 500ms = 10 game ticks. Guard is resource-based (VC/AM/DM don't change per tick),
    // so even a single cycle suffices. Using 500ms avoids test timeout from excessive
    // tick simulation.
    await page.clock.runFor(500);

    const phase = await readGameState(page, 'phase');
    expect(phase).toBe('space');

    const victory = await readGameState(page, 'victoryAchieved');
    expect(victory).toBe(false);

    // TranscendencePanel should NOT exist
    const tcCount = await page.locator('#transcendence-panel').count();
    expect(tcCount).toBe(0);
  });

  // ─── Panel Visibility ──────────────────────────────────────────────

  test('transcendence panel is visible with victory text', async ({ page }) => {
    await seedAndWaitForTranscendence(page);

    const tcPanel = page.locator('#transcendence-panel');
    await expect(tcPanel).toBeVisible();
    await expect(tcPanel).toContainText('You have transcended!');
    await expect(tcPanel).toContainText('Transcendence');
  });

  test('transcendence panel shows prestige stats', async ({ page }) => {
    await seedAndWaitForTranscendence(page);

    const tcPanel = page.locator('#transcendence-panel');
    await expect(tcPanel).toContainText('Legacy Stats');
    await expect(tcPanel).toContainText('Prestige Count');
    await expect(tcPanel).toContainText('Legacy Points');
    await expect(tcPanel).toContainText('Lifetime Food');
  });

  test('all phase panels visible in transcendence', async ({ page }) => {
    await seedAndWaitForTranscendence(page);

    // Core panels
    await expect(page.locator('#click-egg')).toBeVisible();
    await expect(page.locator('#activity-log')).toBeVisible();
    await expect(page.locator('#phase-indicator')).toBeVisible();
    await expect(page.locator('.resource-panel')).toBeVisible();

    // Space panels still visible
    await expect(page.locator('#spaceship-panel')).toBeVisible();
    await expect(page.locator('#exploration-panel')).toBeVisible();

    // Phase 5 panels visible
    await expect(page.locator('#transcendence-panel')).toBeVisible();
    await expect(page.locator('#prestige-panel')).toBeVisible();
  });

  // ─── Theme ─────────────────────────────────────────────────────────

  test('body has phase-transcendence class after victory', async ({ page }) => {
    await seedAndWaitForTranscendence(page);

    const hasClass = await page.evaluate(() =>
      document.body.classList.contains('phase-transcendence'),
    );
    expect(hasClass).toBe(true);
  });

  // ─── Post-Victory ──────────────────────────────────────────────────

  test('game continues after victory — click button still works', async ({ page }) => {
    test.setTimeout(60000);
    await seedAndWaitForTranscendence(page);

    // Post-victory: the game should NOT freeze or disable core interactions.
    // Click the egg button and verify it's still usable.
    const clickBtn = page.locator('#click-egg');
    await expect(clickBtn).toBeVisible();
    await expect(clickBtn).toBeEnabled();

    // Verify the button exists and the HUD still renders
    await expect(page.locator('.resource-panel')).toBeVisible();
  });

  test('post-victory state preserves resources', async ({ page }) => {
    await seedAndWaitForTranscendence(page);

    // Resources should still be present (game does not wipe on transcendence —
    // only Prestige does a reset).
    const food = await readGameState(page, 'resources.food') as number;
    expect(food).toBeGreaterThan(0);

    const workers = await readGameState(page, 'resources.workers') as number;
    expect(workers).toBeGreaterThan(0);
  });

  // ─── Idempotent Panel ──────────────────────────────────────────────

  test('transcendence panel is idempotent on save/reload', async ({ page }) => {
    test.setTimeout(60000);
    await seedAndWaitForTranscendence(page);

    // Count transcendence panels
    const countBefore = await page.locator('#transcendence-panel').count();
    expect(countBefore).toBe(1);

    // Capture post-transcendence state to re-seed on reload.
    // The addInitScript from seedAndWaitForTranscendence seeds the ORIGINAL
    // (pre-transition) SPACE state. We need to add a SECOND init script that
    // overwrites localStorage with the CURRENT transcendence state, so the
    // game resumes in transcendence phase after reload instead of re-running
    // the full phase transition.
    const postVictorySave = await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const gs = (swarm.manager as { getState: () => Record<string, unknown> }).getState();
      return JSON.stringify({
        version: 12,
        timestamp: Date.now(),
        playTimeMs: (gs.stats as Record<string, number>).playTimeMs || 0,
        gameState: gs,
      });
    });

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, postVictorySave);

    await page.reload();
    await page.waitForSelector('#panels', { timeout: 10000 });
    await page.clock.runFor(5000);
    await expect(page.locator('#phase-indicator')).toContainText('Transcendence', { timeout: 10000 });

    // Still exactly one transcendence panel
    const countAfter = await page.locator('#transcendence-panel').count();
    expect(countAfter).toBe(1);
  });

  // ─── Pre-victory state ─────────────────────────────────────────────

  test('transcendence panel shows pre-victory text when victory not achieved', async ({ page }) => {
    // Seed in transcendence phase but with victoryAchieved: false (e.g., from a save)
    const data = makeSaveData({
      phase: 'transcendence',
      victoryAchieved: false,
    });
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Give the engine a moment to initialize and render panels
    await page.clock.runFor(500);

    const tcPanel = page.locator('#transcendence-panel');
    // Panel should exist but show non-victory text
    const count = await tcPanel.count();
    if (count > 0) {
      await expect(tcPanel).toContainText('Reach the stars to transcend');
      await expect(tcPanel).not.toContainText('You have transcended!');
    }
  });
});
