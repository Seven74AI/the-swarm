import { visibleText } from './helpers/text';
import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

// ─── Helpers ───────────────────────────────────────────────────

/** Creates a 64-element empty map tile array (8×8 grid). */
function emptyMapTiles(): Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> {
  const tiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      tiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }
  return tiles;
}

function makeCombatSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'combat',
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 1000,
        nestCapacity: 100, wood: 0, stone: 0, nectar: 0,
      },
      workersAssigned: { gather: 4, tend: 4, dig: 4, guard: 4, researchers: 0 },
      upgrades: {},
      stats: { totalEggsLaid: 50, totalClicks: 100, playTimeMs: 0 },
      unlockedPanels: ['resource_panel', 'soldier_panel', 'battle_panel'],
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      lastSaveTimestamp: Date.now(),
      combatSoldiers: 0,
      soldierStats: { strength: 1, defense: 1, speed: 5, maxHp: 10 },
      soldierPipeline: { count: 0, progress: 0 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0,
      battlesLost: 0,
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
      buildings: {
        barracks: { level: 0, count: 0 },
        walls: { level: 0 },
        warehouse: { level: 0 },
      },
      territory: { ownedTiles: 0, bonuses: {} },
      mapTiles: emptyMapTiles(),
      expeditions: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
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

async function setupCombatPhase(page: Page, overrides?: Record<string, unknown>) {
  const data = makeCombatSaveData(overrides);
  await page.addInitScript(
    (saveStr: string) => {
      // Init scripts run again on reload: seed once per tab, so a reload loads what the game saved.
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_save', saveStr);
    },
    JSON.stringify(data),
  );
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  // Soldiers and battles live in FRONT → WAR (Story 1.15).
  await openTab(page, 'front', 'war');
}

function makeExpansionSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'expansion',
      resources: {
        eggs: 0, larvae: 0, workers: 25, food: 1000,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 100,
      },
      workersAssigned: { gather: 12, tend: 4, dig: 3, guard: 0, researchers: 0 },
      soldiers: { scouts: 5, warriors: 3, totalKilled: 0 },
      buildings: {
        barracks: { level: 0, count: 0 },
        walls: { level: 0 },
        warehouse: { level: 0 },
      },
      territory: { ownedTiles: 0, bonuses: {} },
      mapTiles: emptyMapTiles(),
      expeditions: [],
      upgrades: {},
      stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
      unlockedPanels: [],
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      lastSaveTimestamp: Date.now(),
      combatSoldiers: 0,
      soldierStats: { strength: 1, defense: 1, speed: 5, maxHp: 10 },
      soldierPipeline: { count: 0, progress: 0 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0,
      battlesLost: 0,
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
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

async function setupExpansionPhase(page: Page, overrides?: Record<string, unknown>) {
  const data = makeExpansionSaveData(overrides);
  await page.addInitScript(
    (saveStr: string) => {
      // Init scripts run again on reload: seed once per tab, so a reload loads what the game saved.
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_save', saveStr);
    },
    JSON.stringify(data),
  );
  await page.goto('/');
  // Wait for panels — map generation happens on first tick, then mount
  await page.waitForSelector('#panels', { timeout: 10000 });
}

async function saveGame(page: Page) {
  await page.evaluate(() => {
    const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
    if (swarm && swarm.saveManager) {
      const sm = swarm.saveManager as { save: (s: unknown, t: number, force: boolean) => boolean };
      const state = (swarm.manager as { getState: () => unknown }).getState();
      // Forced, like autosave: an explicit save must not be skipped by the action-save rate limit.
      sm.save(state, 0, true);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  COMBAT EDGE CASES
// ═══════════════════════════════════════════════════════════════

/** FRONT's primary action in WAR (Story 1.25); it keeps the legacy #engage-battle id. */
const fightBtn = (page: Page) => page.locator('#engage-battle[data-action="fight"]');
/** The battle summary sheet (Story 1.25) keeps the legacy #battle-result id. */
const summary = (page: Page) => page.locator('#battle-result[data-battle-summary]');

/** FIGHT, wait for the summary (any outcome: tests assert the outcome set, never one, Story 3.1), close it. */
async function fightOnce(page: Page): Promise<void> {
  await fightBtn(page).click();
  await expect(summary(page)).toBeVisible({ timeout: 5000 });
  await expect(summary(page)).toContainText(/VICTORY|DEFEAT|DRAW/);
  await summary(page).locator('[data-sheet-close]').click();
  await expect(summary(page)).toBeHidden();
}

test.describe('Combat Edge Cases', () => {
  test('defeat scenario — 1 soldier with no equipment', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 1,
      equipment: { weapon: 0, armor: 0 },
    });

    await fightOnce(page);

    // Game did not crash — the enemy card is still mounted, with a fresh enemy
    await expect(page.locator('#battle-panel')).toBeAttached();
    await expect(page.locator('#enemy-name')).not.toBeEmpty();
    // If the single soldier died, FIGHT says why it is disabled.
    const soldiers = await page.evaluate(() => {
      const w = window as unknown as { __swarm: { manager: { getState(): { combatSoldiers: number } } } };
      return w.__swarm.manager.getState().combatSoldiers;
    });
    if (soldiers === 0) await expect(page.locator('[data-primary-for="front"]')).toContainText('train soldiers first');
  });

  test('multiple consecutive battles', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 200,
      equipment: { weapon: 5, armor: 5 },
    });

    await fightOnce(page);
    await fightOnce(page);

    // Game still playable after 2 battles
    await expect(page.locator('#combat-log-panel [data-battle-line]')).toHaveCount(2);
  });

  test('FIGHT is refused while a battle replays', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 50,
      equipment: { weapon: 5, armor: 5 },
    });

    await fightBtn(page).click();
    await expect(page.locator('#battle-panel [data-round]')).toBeVisible();
    await expect(fightBtn(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(summary(page)).toBeVisible({ timeout: 5000 });
  });

  test('FIGHT is disabled without soldiers', async ({ page }) => {
    await setupCombatPhase(page, { combatSoldiers: 0 });
    await expect(fightBtn(page)).toHaveAttribute('aria-disabled', 'true', { timeout: 5000 });
    await expect(page.locator('[data-primary-for="front"]')).toContainText('train soldiers first');
  });

  test('soldier training visible during battle', async ({ page }) => {
    await setupCombatPhase(page, { combatSoldiers: 10 });

    // Train 3 (3 soldiers in the pipeline: training doesn't finish during the battle)
    const trainBtn = page.locator('#soldier-panel [data-action="train-soldier"]');
    await expect(trainBtn).toBeVisible({ timeout: 5000 });
    await trainBtn.click();
    await trainBtn.click();
    await trainBtn.click();

    // Training status appears
    await expect(page.locator('#soldier-panel [data-training]')).not.toHaveText(/TRAINING 0$/, { timeout: 2000 });

    await fightBtn(page).click();
    await expect(summary(page)).toBeVisible({ timeout: 5000 });
    await expect(summary(page)).toContainText(/VICTORY|DEFEAT|DRAW/);
  });

  test('a battle with strong equipment resolves and the summary can be closed', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 10,
      equipment: { weapon: 10, armor: 10 },
    });

    await fightBtn(page).click();
    await expect(summary(page)).toBeVisible({ timeout: 5000 });
    await expect(summary(page)).toContainText(/VICTORY|DEFEAT|DRAW/);
    // The close button is there — game survived
    await expect(summary(page).locator('[data-sheet-close]')).toBeVisible({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════
//  SAVE / LOAD ROBUSTNESS
// ═══════════════════════════════════════════════════════════════

test.describe('Save/Load Robustness', () => {
  test('save before a battle → reload → WAR restored', async ({
    page,
  }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 20,
      equipment: { weapon: 3, armor: 3 },
    });

    await expect(page.locator('#enemy-name')).toBeVisible({ timeout: 3000 });
    await saveGame(page);

    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();
    await openTab(page, 'front', 'war');

    // The enemy on the card is session state: a reload draws one again, and FIGHT is ready.
    await expect(page.locator('#battle-panel')).toBeAttached({ timeout: 5000 });
    await expect(page.locator('#enemy-name')).not.toBeEmpty();
    await expect(fightBtn(page)).not.toHaveAttribute('aria-disabled', 'true', { timeout: 3000 });
  });

  test('save with active expedition → reload → expedition preserved', async ({
    page,
  }) => {
    await setupExpansionPhase(page, {
      soldiers: { scouts: 5, warriors: 3, totalKilled: 0 },
      buildings: {
        barracks: { level: 1, count: 1 },
        walls: { level: 0 },
        warehouse: { level: 0 },
      },
      expeditions: [
        {
          id: 'exp_test_1',
          scouts: 2,
          warriors: 1,
          destination: 'MEADOW',
          // Long enough to still be out after the reload (offline catch-up included).
          ticksRemaining: 6_000,
          risk: 0.25,
        },
      ],
    });

    // Verify expedition is visible
    await expect(page.locator('.expedition-row')).toBeAttached({ timeout: 5000 });
    await expect(page.locator('.expedition-row')).toContainText('MEADOW');
    await expect(page.locator('.expedition-row')).toContainText(/\d+s left/);

    // Save
    await saveGame(page);

    // Reload
    await page.reload();
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Expedition should still be active
    const expeditionRow = page.locator('.expedition-row');
    await expect(expeditionRow).toBeAttached({ timeout: 5000 });
    await expect(expeditionRow).toContainText('MEADOW');
    await expect(expeditionRow).toContainText(/\d+s left/);
  });

  test('save with buildings → reload → levels intact', async ({ page }) => {
    await setupExpansionPhase(page, {
      buildings: {
        barracks: { level: 2, count: 1 },
        walls: { level: 1 },
        warehouse: { level: 0 },
      },
    });

    // Verify building levels in UI
    const buildingPanel = page.locator('.building-panel');
    await expect(buildingPanel).toBeAttached({ timeout: 5000 });
    await expect.poll(() => visibleText(buildingPanel)).toContain('LV.2 →');
    await expect.poll(() => visibleText(buildingPanel)).toContain('LV.1 →');

    // Save
    await saveGame(page);

    // Reload
    await page.reload();
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Verify building levels preserved
    const reloadedPanel = page.locator('.building-panel');
    await expect(reloadedPanel).toBeAttached({ timeout: 5000 });
    await expect(reloadedPanel).toContainText('BARRACKS', { timeout: 3000 });
    await expect.poll(() => visibleText(reloadedPanel), { timeout: 3000 }).toContain('LV.2 →');
    await expect.poll(() => visibleText(reloadedPanel), { timeout: 3000 }).toContain('LV.1 →');
  });

  // Story 2.2: a save that can't be read is never silently reset. The game boots behind
  // THIS SAVE COULDN'T BE READ. without crashing, and is playable once the player holds START OVER.
  async function startOverFromUnreadable(page: Page): Promise<void> {
    const sheet = page.locator('[data-unreadable-save]');
    await expect(sheet).toBeVisible({ timeout: 5000 });
    const holdMs = await page.evaluate(
      () =>
        (window as unknown as { __swarm: { platform: { settings: { settings: { value: { confirmHoldMs: number } } } } } }).__swarm
          .platform.settings.settings.value.confirmHoldMs,
    );
    await sheet.locator('[data-action="start-over"]').dispatchEvent('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
    await expect(sheet).toHaveCount(0, { timeout: holdMs + 5000 });
  }

  test('save corruption recovery — malformed JSON', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_save', '{broken json {{{');
    });

    await page.goto('/');
    await startOverFromUnreadable(page);

    const eggBtn = page.locator('#click-egg');
    await expect(eggBtn).toBeAttached({ timeout: 5000 });
    await expect(eggBtn).toBeEnabled({ timeout: 3000 });

    // Click — should not throw
    await eggBtn.click();

    // Game is alive — UI is responsive
    await expect(eggBtn).toBeVisible();
  });

  test('save corruption recovery — valid JSON, wrong structure', async ({
    page,
  }) => {
    // Valid JSON but missing gameState field
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: 11, timestamp: 0, playTimeMs: 0 }),
      );
    });

    await page.goto('/');
    await startOverFromUnreadable(page);

    // START OVER gives a fresh, playable game
    const eggBtn = page.locator('#click-egg');
    await expect(eggBtn).toBeAttached({ timeout: 5000 });
    await expect(eggBtn).toBeEnabled({ timeout: 3000 });

    await eggBtn.click();

    // Phase indicator shows initial phase (fresh start)
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toBeAttached();
  });

  test('multiple saves in rapid succession', async ({ page }) => {
    // Use combat phase instead of expansion (serialization is what matters)
    await setupCombatPhase(page, {
      combatSoldiers: 50,
      equipment: { weapon: 3, armor: 3 },
      battlesWon: 0,
    });

    // Save 3 times with different battlesWon values
    for (const won of [1, 2, 3]) {
      await page.evaluate(
        (battlesWon) => {
          const swarm = (window as unknown as Record<string, unknown>)
            .__swarm as Record<string, unknown>;
          if (!swarm || !swarm.manager) return;
          const mgr = swarm.manager as {
            getState: () => Record<string, unknown>;
            setState: (s: Record<string, unknown>) => void;
          };
          const state = mgr.getState();
          mgr.setState({ ...state, battlesWon } as Record<string, unknown>);
        },
        won,
      );

      await saveGame(page);
    }

    // Reload — should have latest state (battlesWon = 3)
    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();

    const won = await page.evaluate(
      () => ((window as unknown as { __swarm: { manager: { getState: () => { battlesWon: number } } } }).__swarm.manager.getState().battlesWon),
    );
    expect(won).toBe(3);

    // Verify combat panel is still functional after rapid saves
    await openTab(page, 'front', 'war');
    await expect(page.locator('#battle-panel')).toBeAttached({ timeout: 5000 });
    await expect(fightBtn(page)).not.toHaveAttribute('aria-disabled', 'true', { timeout: 3000 });
  });
});
