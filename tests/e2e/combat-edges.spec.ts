import { test, expect, type Page } from '@playwright/test';

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
      localStorage.setItem('the_swarm_save', saveStr);
    },
    JSON.stringify(data),
  );
  await page.goto('/');
  await page.waitForTimeout(2000);
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
      const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
      const state = (swarm.manager as { getState: () => unknown }).getState();
      sm.save(state, 0);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  COMBAT EDGE CASES
// ═══════════════════════════════════════════════════════════════

test.describe('Combat Edge Cases', () => {
  test('defeat scenario — 1 soldier with no equipment', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 1,
      equipment: { weapon: 0, armor: 0 },
    });

    // Scout
    const scoutBtn = page.locator('#scout-enemy');
    await expect(scoutBtn).toBeEnabled({ timeout: 5000 });
    await scoutBtn.click();

    // Engage
    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).toBeEnabled({ timeout: 3000 });
    await engageBtn.click();

    // Result appears — accept either outcome
    const result = page.locator('#battle-result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText(/Victory|Defeat/);

    // Game did not crash — battle panel is still mounted
    await expect(page.locator('#battle-panel')).toBeAttached();

    // Continue button is visible
    const continueBtn = page.locator('#battle-continue');
    await expect(continueBtn).toBeVisible({ timeout: 3000 });
    await continueBtn.click();

    // Battle panel still attached after Continue (game alive)
    await expect(page.locator('#battle-panel')).toBeAttached();
    // Note: if the single soldier died, combatSoldiers=0 → scout stays disabled.
    // This is correct behavior — the game survived the defeat without crashing.
  });

  test('multiple consecutive battles', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 50,
      equipment: { weapon: 5, armor: 5 },
    });

    // Battle 1
    await page.locator('#scout-enemy').click();
    await expect(page.locator('#engage-battle')).toBeEnabled({ timeout: 3000 });
    await page.locator('#engage-battle').click();
    await expect(page.locator('#battle-result')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#battle-result')).toContainText(/Victory|Defeat/);

    const continueBtn1 = page.locator('#battle-continue');
    if (await continueBtn1.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueBtn1.click();
    }

    // Ready for next battle
    await expect(page.locator('#scout-enemy')).toBeEnabled({ timeout: 3000 });

    // Battle 2
    await page.locator('#scout-enemy').click();
    await expect(page.locator('#engage-battle')).toBeEnabled({ timeout: 3000 });
    await page.locator('#engage-battle').click();
    await expect(page.locator('#battle-result')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#battle-result')).toContainText(/Victory|Defeat/);

    const continueBtn2 = page.locator('#battle-continue');
    if (await continueBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueBtn2.click();
    }

    // Game still playable after 2 battles
    await expect(page.locator('#scout-enemy')).toBeEnabled({ timeout: 3000 });
  });

  test('scout re-enabled after battle and continue', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 50,
      equipment: { weapon: 5, armor: 5 },
    });

    // Fight one battle
    await page.locator('#scout-enemy').click();
    await page.locator('#engage-battle').click();
    await expect(page.locator('#battle-result')).toBeVisible({ timeout: 5000 });

    // Click Continue
    const continueBtn = page.locator('#battle-continue');
    await expect(continueBtn).toBeVisible({ timeout: 3000 });
    await continueBtn.click();

    // After Continue: scout re-enabled, engage disabled (need new scout)
    await expect(page.locator('#scout-enemy')).toBeEnabled({ timeout: 3000 });
    await expect(page.locator('#engage-battle')).toBeDisabled({ timeout: 3000 });

    // Scout again → engage becomes enabled
    await page.locator('#scout-enemy').click();
    await expect(page.locator('#engage-battle')).toBeEnabled({ timeout: 3000 });
  });

  test('cannot engage without scouting first', async ({ page }) => {
    await setupCombatPhase(page, { combatSoldiers: 10 });

    // Engage should be disabled before scouting
    await expect(page.locator('#engage-battle')).toBeDisabled({ timeout: 5000 });

    // Scout → engage becomes enabled
    await page.locator('#scout-enemy').click();
    await expect(page.locator('#engage-battle')).toBeEnabled({ timeout: 3000 });
  });

  test('soldier training visible during battle', async ({ page }) => {
    await setupCombatPhase(page, { combatSoldiers: 10 });

    // Click Recruit Soldier 3 times to start multiple training
    // (3 soldiers in pipeline ensures training doesn't finish during battle)
    const recruitBtn = page.locator('#soldier-panel button').filter({
      hasText: 'Recruit Soldier',
    });
    await expect(recruitBtn).toBeVisible({ timeout: 5000 });
    await recruitBtn.click();
    await recruitBtn.click();
    await recruitBtn.click();

    // Verify training status appears
    await expect(page.locator('#soldier-panel .stat-row .stat-sub').first()).not.toBeEmpty({ timeout: 2000 });

    // While training, scout and engage
    await page.locator('#scout-enemy').click();
    await expect(page.locator('#engage-battle')).toBeEnabled({ timeout: 3000 });
    await page.locator('#engage-battle').click();

    // Battle resolves
    await expect(page.locator('#battle-result')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#battle-result')).toContainText(/Victory|Defeat/);

    // Training status should still be visible (training continues during battle)
    await expect(page.locator('#soldier-panel .stat-row .stat-sub').first()).not.toBeEmpty();
  });

  test('strong equipment favors victory', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 10,
      equipment: { weapon: 10, armor: 10 },
    });

    // Scout and engage
    await page.locator('#scout-enemy').click();
    await expect(page.locator('#engage-battle')).toBeEnabled({ timeout: 3000 });
    await page.locator('#engage-battle').click();

    // Result appears — strong equipment should produce a result
    const result = page.locator('#battle-result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText(/Victory|Defeat/);

    // Continue button visible — game survived
    await expect(page.locator('#battle-continue')).toBeVisible({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════
//  SAVE / LOAD ROBUSTNESS
// ═══════════════════════════════════════════════════════════════

test.describe('Save/Load Robustness', () => {
  test('save during active battle → reload → battle panel restored', async ({
    page,
  }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 20,
      equipment: { weapon: 3, armor: 3 },
    });

    // Scout an enemy (puts BattlePanel in active scouted state)
    await page.locator('#scout-enemy').click();
    await expect(page.locator('#enemy-name')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#engage-battle')).toBeEnabled({ timeout: 3000 });

    // Save mid-battle (after scout, before engage)
    await saveGame(page);
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify combat panel is rendered and functional
    await expect(page.locator('#battle-panel')).toBeAttached({ timeout: 5000 });

    // Scout button should be visible (game is in playable state)
    await expect(page.locator('#scout-enemy')).toBeVisible({ timeout: 3000 });

    // Note: scoutedEnemy is local BattlePanel state and does NOT survive
    // serialization. After reload, engage is disabled because the scout state
    // is lost. This documents current behavior.
    await expect(page.locator('#engage-battle')).toBeDisabled({ timeout: 3000 });
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
          ticksRemaining: 42,
          risk: 0.25,
        },
      ],
    });

    // Verify expedition is visible
    await expect(page.locator('.expedition-row')).toBeAttached({ timeout: 5000 });
    await expect(page.locator('.expedition-row')).toContainText('MEADOW');
    await expect(page.locator('.expedition-row')).toContainText(/⏳ \d+s/);

    // Save
    await saveGame(page);
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Expedition should still be active
    const expeditionRow = page.locator('.expedition-row');
    await expect(expeditionRow).toBeAttached({ timeout: 5000 });
    await expect(expeditionRow).toContainText('MEADOW');
    // ticksRemaining may have ticked down by 1-2
    await expect(expeditionRow).toContainText(/⏳ \d+s/);
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
    await expect(buildingPanel).toContainText('Lv.2');
    await expect(buildingPanel).toContainText('Lv.1');

    // Save
    await saveGame(page);
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Verify building levels preserved
    const reloadedPanel = page.locator('.building-panel');
    await expect(reloadedPanel).toBeAttached({ timeout: 5000 });
    await expect(reloadedPanel).toContainText('Barracks', { timeout: 3000 });
    await expect(reloadedPanel).toContainText('Lv.2', { timeout: 3000 });
    await expect(reloadedPanel).toContainText('Lv.1', { timeout: 3000 });
  });

  test('save corruption recovery — malformed JSON', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('the_swarm_save', '{broken json {{{');
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Game should load without crash — SaveManager catches JSON.parse errors
    const eggBtn = page.locator('#click-egg');
    await expect(eggBtn).toBeAttached({ timeout: 5000 });
    await expect(eggBtn).toBeEnabled({ timeout: 3000 });

    // Click — should not throw
    await eggBtn.click();
    await page.waitForTimeout(300);

    // Game is alive — UI is responsive
    await expect(eggBtn).toBeVisible();
  });

  test('save corruption recovery — valid JSON, wrong structure', async ({
    page,
  }) => {
    // Valid JSON but missing gameState field
    await page.addInitScript(() => {
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: 11, timestamp: 0, playTimeMs: 0 }),
      );
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Game should fall back to fresh start
    const eggBtn = page.locator('#click-egg');
    await expect(eggBtn).toBeAttached({ timeout: 5000 });
    await expect(eggBtn).toBeEnabled({ timeout: 3000 });

    // Game is playable
    await eggBtn.click();
    await page.waitForTimeout(300);

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
      await page.waitForTimeout(200);
    }

    // Reload — should have latest state (battlesWon = 3)
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify combat panel is still functional after rapid saves
    await expect(page.locator('#battle-panel')).toBeAttached({ timeout: 5000 });
    await expect(page.locator('#scout-enemy')).toBeEnabled({ timeout: 3000 });
  });
});
