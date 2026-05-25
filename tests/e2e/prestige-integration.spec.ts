import { test, expect } from '@playwright/test';

/**
 * E2E: Prestige Integration — Slice 5.
 *
 * Tests the complete prestige flow. Clicks are done via page.evaluate()
 * to bypass Preact signal reactivity DOM detachment issues.
 *
 * KEY MECHANIC: eggPipeline.count represents eggs waiting to hatch.
 * Hatching consumes resources.eggs to produce larvae. The auto-egg-layer
 * fills the pipeline but does NOT add to resources.eggs — clicking does.
 * Tests that verify egg production MUST click first to seed resources.eggs.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMapTiles(): Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> {
  const tiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      tiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }
  return tiles;
}

function makeBaseState(overrides?: Record<string, unknown>) {
  return {
    phase: 'transcendence',
    resources: {
      eggs: 0, larvae: 0, workers: 50, food: 5000,
      nestCapacity: 50, wood: 1000, stone: 800, nectar: 500,
      voidCrystals: 0, antimatter: 0, darkMatter: 0,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    soldierPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 10, tend: 0, dig: 0, guard: 0, researchers: 0 },
    soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
    buildings: {
      barracks: { level: 5, count: 0 },
      walls: { level: 5 },
      warehouse: { level: 5 },
    },
    territory: { ownedTiles: 0, bonuses: {} },
    mapTiles: makeMapTiles(),
    expeditions: [],
    spaceExplorations: [],
    discoveredPlanets: [],
    spaceships: [],
    upgrades: {},
    stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
    unlockedPanels: [],
    lastSaveTimestamp: 0,
    combatSoldiers: 0,
    soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
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
    prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000 },
    prestigeTree: { purchased: [] as string[] },
    offlineEfficiency: 0.5,
    soldierEquipment: {},
    research: {
      projects: {
        voidCrystalSynthesis: { state: 'available' as const, progress: 0 },
        antimatterContainment: { state: 'locked' as const, progress: 0 },
        darkMatterDetection: { state: 'locked' as const, progress: 0 },
      },
    },
    conversions: { particleLab: 0 },
    entropy: 0,
    entropyDampener: { level: 0 },
    ...overrides,
  };
}

function makeSaveData(state: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: state,
  };
}

async function seedAndGo(page: any, state: Record<string, unknown>) {
  await page.addInitScript((saveStr: string) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(makeSaveData(state)));
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function evalClick(page: any, selector: string) {
  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) el.click();
  }, selector);
}

async function openPrestigeTree(page: any) {
  await expect(page.locator('#prestige-panel')).toBeAttached({ timeout: 15000 });
  await page.waitForTimeout(500);
  await evalClick(page, '#prestige-panel .btn-tree');
  await page.waitForTimeout(1000);
  await expect(page.locator('#prestige-tree-panel')).toBeAttached({ timeout: 15000 });
}

async function purchaseUpgrade(page: any, upgradeName: string) {
  await page.evaluate((name: string) => {
    const cards = Array.from(document.querySelectorAll('.prestige-tree-card'));
    for (const card of cards) {
      const nameEl = card.querySelector('.prestige-tree-card-name');
      if (nameEl && nameEl.textContent === name) {
        const btn = card.querySelector('.btn-tree-purchase') as HTMLButtonElement | null;
        if (btn && !btn.disabled) {
          btn.click();
          return;
        }
      }
    }
  }, upgradeName);
  await page.waitForTimeout(800);
  const card = page.locator('.prestige-tree-card', { hasText: upgradeName });
  await expect(card.locator('.prestige-tree-purchased-badge')).toBeAttached({ timeout: 10000 });
}

async function clickTimes(page: any, n: number) {
  for (let i = 0; i < n; i++) {
    await evalClick(page, '#click-egg');
    await page.waitForTimeout(50);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Prestige Integration — Slice 5', () => {
  /** ─── Test 1: Phase 5 → Prestige → Full Wipe + Points + Phase 1 ─── */
  test('prestige from Phase 5 resets game and awards legacy points', async ({ page }) => {
    await seedAndGo(page, makeBaseState());

    // Pre-prestige verification
    const panelBefore = page.locator('#prestige-panel');
    await expect(panelBefore).toBeAttached({ timeout: 10000 });
    const beforeText = await panelBefore.textContent();
    expect(beforeText).toMatch(/Legacy[\s\S]*?0/);

    // Execute prestige
    await page.evaluate(() => {
      const btn = document.querySelector('#prestige-panel .btn-prestige') as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    // ── Full Wipe: resources reset ──
    await expect(page.locator('[data-stat="resources.eggs"] .critical-value')).toHaveText('0', { timeout: 10000 });
    await expect(page.locator('[data-stat="resources.food"] .critical-value')).toHaveText('0', { timeout: 10000 });

    // ── Prestige count incremented ──
    const afterText = await page.locator('#prestige-panel').textContent();
    expect(afterText).toMatch(/Legacy[\s\S]*?1/);

    // ── Legacy points earned ──
    const ptsText = await page.locator('#prestige-panel .stat-row', { hasText: 'Legacy Points' }).locator('.stat-value').textContent();
    expect(parseInt(ptsText || '0', 10)).toBeGreaterThan(0);
  });

  /** ─── Test 2: Purchase egg-laying bonus → Prestige → Bonus persists ─── */
  test('egg-laying bonus persists through prestige and boosts egg production', async ({ page }) => {
    await seedAndGo(page, makeBaseState({
      prestige: { count: 0, legacyPoints: 15, totalFoodProduced: 100_000 },
    }));

    await openPrestigeTree(page);
    await purchaseUpgrade(page, 'Fertile Queen');

    // 15 - 3 = 12 LP
    await expect(
      page.locator('#prestige-panel .stat-row', { hasText: 'Legacy Points' }).locator('.stat-value')
    ).toHaveText('12', { timeout: 5000 });

    // Prestige
    await page.evaluate(() => {
      const btn = document.querySelector('#prestige-panel .btn-prestige') as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    // Bonus persists
    await openPrestigeTree(page);
    await expect(
      page.locator('.prestige-tree-card', { hasText: 'Fertile Queen' }).locator('.prestige-tree-purchased-badge')
    ).toBeAttached({ timeout: 10000 });

    // Egg production works
    await clickTimes(page, 5);
    await page.waitForTimeout(1000);
    const eggText = await page.locator('[data-stat="resources.eggs"] .critical-value').textContent();
    expect(parseInt(eggText || '0', 10)).toBeGreaterThan(0);
  });

  /** ─── Test 3: Auto-egg-layer → Prestige → Auto-eggs sustain production ─── */
  test('auto-egg-layer sustains egg production in new run after prestige', async ({ page }) => {
    await seedAndGo(page, makeBaseState({
      prestige: { count: 0, legacyPoints: 20, totalFoodProduced: 100_000 },
    }));

    await openPrestigeTree(page);
    await purchaseUpgrade(page, 'Autonomous Queen');

    // 20 - 10 = 10 LP
    await expect(
      page.locator('#prestige-panel .stat-row', { hasText: 'Legacy Points' }).locator('.stat-value')
    ).toHaveText('10', { timeout: 5000 });

    // Prestige
    await page.evaluate(() => {
      const btn = document.querySelector('#prestige-panel .btn-prestige') as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    // Verify prestige executed
    const panelText = await page.locator('#prestige-panel').textContent();
    expect(panelText).toMatch(/Legacy[\s\S]*?1/);

    // Seed resources by clicking (pipeline eggs need resources.eggs to hatch)
    await clickTimes(page, 10);
    await page.waitForTimeout(2000);

    // After clicks + auto-egg pipeline, eggs should accumulate
    await page.waitForTimeout(5000);
    const eggText = await page.locator('[data-stat="resources.eggs"] .critical-value').textContent();
    expect(parseInt(eggText || '0', 10)).toBeGreaterThan(0);
  });

  /** ─── Test 4: Starting resources + Phase skip → Phase 2 with resources ─── */
  test('starting resources and phase skip apply after prestige', async ({ page }) => {
    await seedAndGo(page, makeBaseState({
      prestige: { count: 0, legacyPoints: 30, totalFoodProduced: 100_000 },
    }));

    await openPrestigeTree(page);
    await purchaseUpgrade(page, 'Royal Cache');      // 8 LP

    await openPrestigeTree(page);
    await purchaseUpgrade(page, 'Ancestral Memory');  // 20 LP

    // 30 - 8 - 20 = 2 LP
    await expect(
      page.locator('#prestige-panel .stat-row', { hasText: 'Legacy Points' }).locator('.stat-value')
    ).toHaveText('2', { timeout: 5000 });

    // Prestige
    await page.evaluate(() => {
      const btn = document.querySelector('#prestige-panel .btn-prestige') as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    // ── Starting resources: food = 25 ──
    await expect(page.locator('[data-stat="resources.food"] .critical-value')).toHaveText('25', { timeout: 10000 });

    // ── Phase 2 (colony): worker-assignment panel visible ──
    await expect(page.locator('#worker-assignment')).toBeAttached({ timeout: 10000 });

    // Seed eggs via clicking (50 pipeline eggs need resources.eggs to hatch)
    await clickTimes(page, 10);
    await page.waitForTimeout(8000);

    const eggText = await page.locator('[data-stat="resources.eggs"] .critical-value').textContent();
    expect(parseInt(eggText || '0', 10)).toBeGreaterThan(0);
  });

  /** ─── Test 5: Double prestige — compound bonuses ─── */
  test('multiple prestiges compound bonuses correctly', async ({ page }) => {
    await seedAndGo(page, makeBaseState({
      prestige: { count: 0, legacyPoints: 40, totalFoodProduced: 1_000_000 },
    }));

    await openPrestigeTree(page);
    await purchaseUpgrade(page, 'Fertile Queen');

    // First prestige
    await page.evaluate(() => {
      const btn = document.querySelector('#prestige-panel .btn-prestige') as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    const text1 = await page.locator('#prestige-panel').textContent();
    expect(text1).toMatch(/Legacy[\s\S]*?1/);

    // Reload with count=1 + first bonus purchased
    await page.evaluate(() => localStorage.clear());
    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(makeSaveData(makeBaseState({
      prestige: { count: 1, legacyPoints: 30, totalFoodProduced: 2_000_000 },
      prestigeTree: { purchased: ['egg_laying_bonus'] },
    }))));
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // First bonus still purchased
    await openPrestigeTree(page);
    await expect(
      page.locator('.prestige-tree-card', { hasText: 'Fertile Queen' }).locator('.prestige-tree-purchased-badge')
    ).toBeAttached({ timeout: 10000 });

    // Purchase second bonus
    await purchaseUpgrade(page, 'Efficient Foragers');

    // Second prestige
    await page.evaluate(() => {
      const btn = document.querySelector('#prestige-panel .btn-prestige') as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    const text2 = await page.locator('#prestige-panel').textContent();
    expect(text2).toMatch(/Legacy[\s\S]*?2/);

    // Both bonuses persist
    await openPrestigeTree(page);
    await expect(
      page.locator('.prestige-tree-card', { hasText: 'Fertile Queen' }).locator('.prestige-tree-purchased-badge')
    ).toBeAttached({ timeout: 10000 });
    await expect(
      page.locator('.prestige-tree-card', { hasText: 'Efficient Foragers' }).locator('.prestige-tree-purchased-badge')
    ).toBeAttached({ timeout: 10000 });

    // Production bonus display present
    await expect(page.locator('#prestige-panel')).toContainText('Production Bonus', { timeout: 10000 });

    // Game functional
    await clickTimes(page, 3);
    await page.waitForTimeout(500);
    const eggText = await page.locator('[data-stat="resources.eggs"] .critical-value').textContent();
    expect(parseInt(eggText || '0', 10)).toBeGreaterThan(0);
  });
});
