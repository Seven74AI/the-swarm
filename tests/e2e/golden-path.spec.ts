import { visibleText } from './helpers/text';
import { test, expect } from '@playwright/test';
import { openTab } from './helpers/tabs';
import { readResource } from './helpers/resources';
import { tapContinue } from './helpers/phase';
import { goalTarget } from './helpers/guards';

/**
 * Golden Path E2E: Full progression seed → all panels unlock → save/load.
 *
 * Seeds a rich COMBAT-phase state on the verge of EXPANSION (it satisfies
 * COMBAT → EXPANSION in src/phases/transitions.ts), taps CONTINUE (Story 1.19),
 * verifies every panel becomes visible after the phase transition, tests core interactions
 * (egg click, scout, build), and validates save/load fidelity.
 */

const SEED = {
  version: 11,
  timestamp: Date.now(),
  playTimeMs: 0,
  gameState: {
    phase: 'combat',
    resources: {
      eggs: 5,
      larvae: 3,
      workers: goalTarget('combat', 'workers'),
      food: 5000,
      nestCapacity: 100,
      wood: 400,
      stone: 400,
      nectar: 200,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 24, tend: 8, dig: 4, guard: 0, researchers: 0 },
    soldiers: { scouts: 10, warriors: 5, totalKilled: 2 },
    buildings: {
      barracks: { level: 2, count: 1 },
      walls: { level: 2 },
      warehouse: { level: 2 },
    },
    territory: { ownedTiles: 5, bonuses: {} },
    mapTiles: undefined as unknown as never, // NOT SET — let initial state provide 64 tiles
    expeditions: [
      {
        id: 'exp_golden_1',
        scouts: 2,
        warriors: 1,
        destination: 'FOREST',
        // Long enough to still be out after CONTINUE's phase reveal (Story 1.20, up to 3.5 s).
        ticksRemaining: 2000,
        risk: 0.35,
      },
    ],
    upgrades: {},
    stats: { totalEggsLaid: 200, totalClicks: 350, playTimeMs: 0 },
    unlockedPanels: [],
    lastSaveTimestamp: 0,
    combatSoldiers: 5,
    soldierStats: { strength: 2, defense: 2, speed: 5, maxHp: 12 },
    equipment: { weapon: 2, armor: 2 },
    lastBattle: null,
    combatResources: { chitin: 5, silk: 3, venom: 1 },
    battlesWon: 5,
    battlesLost: 1,
    soldierPipeline: { count: 0, progress: 0 },
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
  },
};

test.describe('Golden Path — Full Progression', () => {
  test.beforeEach(async ({ page }) => {
    // Inject seed BEFORE page load (avoids beforeunload overwrite)
    // A fresh timestamp per test: the module-level one ages over the file's run,
    // and past 30 s the offline summary sheet opens and covers NEST.
    await page.addInitScript((seedStr) => {
      localStorage.setItem('the_swarm_save', seedStr);
    }, JSON.stringify({ ...SEED, timestamp: Date.now() }));

    await page.goto('/');

    // Verify seed loaded into localStorage
    const saved = await page.evaluate(() => localStorage.getItem('the_swarm_save'));
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.gameState.resources.food).toBe(5000);
    expect(parsed.gameState.buildings.barracks.level).toBe(2);

    // Wait for panels container to render
    await page.waitForSelector('#panels', { timeout: 10000 });

    // The seed meets COMBAT → EXPANSION's goal; the phase changes on CONTINUE (Story 1.19).
    await tapContinue(page);
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('The Expansion', { timeout: 15000 });
  });

  // ─── Panel Visibility ───────────────────────────────────────────

  test('egg button is always visible and clickable', async ({ page }) => {
    const eggBtn = page.locator('#click-egg');
    await expect(eggBtn).toBeVisible();
    await expect(eggBtn).toBeEnabled();
  });

  test('phase indicator shows "The Expansion"', async ({ page }) => {
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('The Expansion');
  });

  test('resource panel shows seeded values', async ({ page }) => {
    // Story 1.16: food sits in the strip; its exact integer is in the resource sheet.
    await expect(page.locator('[data-stat="resources.food"] .critical-value')).toBeVisible();
    // Food grows every tick, so compare the shown number with the live state
    // instead of pinning the seed's leading digits.
    await expect(async () => {
      const shown = await readResource(page, 'food');
      const actual = await page.evaluate(() => {
        const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
        return (swarm.manager as { getState: () => { resources: { food: number } } }).getState().resources.food;
      });
      expect(shown).toBeGreaterThan(0);
      // The sheet refreshes 4 times a second and floors (Story 1.9), so it may lag
      // the state a little but never shows more than the colony has.
      expect(shown).toBeLessThanOrEqual(Math.floor(actual));
      expect(shown).toBeGreaterThanOrEqual(Math.floor(actual * 0.9));
    }).toPass({ timeout: 10_000 });

    // Workers are in the Expansion strip; eggs are in the resource sheet.
    await expect(page.locator('[data-stat="resources.workers"]')).toBeVisible();
    expect(await readResource(page, 'eggs')).toBeGreaterThanOrEqual(0);

    // Wood/stone/nectar aren't directly rendered — verify via game state
    const state = await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      return (swarm.manager as { getState: () => Record<string, unknown> }).getState();
    });
    expect((state as Record<string, unknown>).resources).toBeTruthy();
    const resources = (state as Record<string, unknown>).resources as Record<string, number>;
    expect(resources.wood).toBeGreaterThanOrEqual(300);
    expect(resources.stone).toBeGreaterThanOrEqual(300);
    expect(resources.nectar).toBeGreaterThanOrEqual(100);
  });

  test('worker assignment panel shows gather/tend rows', async ({ page }) => {
    await openTab(page, 'wrkr');
    const workerPanel = page.locator('#worker-assignment');
    await expect(workerPanel).toBeVisible();
    const text = await workerPanel.textContent();
    expect(text).toContain('GATHER');
    expect(text).toContain('TEND');
  });

  test('soldier panel shows recruit button and soldier stats', async ({ page }) => {
    await openTab(page, 'front', 'war');
    const soldierPanel = page.locator('#soldier-panel');
    await expect(soldierPanel).toBeVisible();

    // TRAIN replaces "Recruit Soldier" (Story 1.25).
    await expect(soldierPanel.locator('[data-action="train-soldier"]')).toBeVisible();

    // Soldier count should be visible (5 combat soldiers)
    await expect(soldierPanel.locator('[data-soldiers]')).toContainText('SOLDIERS');
  });

  test('battle panel shows the enemy card and FIGHT', async ({ page }) => {
    await openTab(page, 'front', 'war');
    const battlePanel = page.locator('#battle-panel');
    await expect(battlePanel).toBeVisible();
    await expect(battlePanel.locator('#enemy-name')).not.toBeEmpty();

    // > FIGHT (Story 1.25) keeps #engage-battle, in FRONT's primary zone.
    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).toBeVisible();
  });

  test('map panel is visible in expansion phase', async ({ page }) => {
    await openTab(page, 'front', 'map');
    const mapPanel = page.locator('.map-panel');
    await expect(mapPanel).toBeVisible();
  });

  test('building panel shows every building row', async ({ page }) => {
    await openTab(page, 'build');
    const buildingPanel = page.locator('#building-panel');
    await expect(buildingPanel).toBeVisible();

    // Original three building rows
    const barracksRow = buildingPanel.locator('[data-building="barracks"]');
    await expect(barracksRow).toBeVisible();
    const wallsRow = buildingPanel.locator('[data-building="walls"]');
    await expect(wallsRow).toBeVisible();
    const warehouseRow = buildingPanel.locator('[data-building="warehouse"]');
    await expect(warehouseRow).toBeVisible();

    // Three new combat-resource buildings
    const silkRow = buildingPanel.locator('[data-building="silk_weaving"]');
    await expect(silkRow).toBeVisible();
    const chitinRow = buildingPanel.locator('[data-building="chitin_armory"]');
    await expect(chitinRow).toBeVisible();
    const venomRow = buildingPanel.locator('[data-building="venom_lab"]');
    await expect(venomRow).toBeVisible();

    // The Colony's nectar buildings (Story 4.7)
    for (const id of ['fungus_garden', 'tunnels']) await expect(buildingPanel.locator(`[data-building="${id}"]`)).toBeVisible();

    // The Midden, where the fallen leave chitin (Story 4.8)
    await expect(buildingPanel.locator('[data-building="midden"]')).toBeVisible();

    // Each card has its own BUY button (Story 1.24)
    const buildBtns = buildingPanel.locator('[data-action="buy-building"]');
    await expect(buildBtns).toHaveCount(await buildingPanel.locator('[data-building]').count());
  });

  test('expedition panel shows launch form', async ({ page }) => {
    await openTab(page, 'front', 'map');
    const expeditionPanel = page.locator('#expedition-panel');
    await expect(expeditionPanel).toBeVisible();

    // Send button should be present (one per destination)
    const sendBtn = expeditionPanel.locator('button').filter({ hasText: 'Send' }).first();
    await expect(sendBtn).toBeVisible();

    // Should show active expedition row
    const expRows = expeditionPanel.locator('.expedition-row');
    await expect(expRows).toHaveCount(1);
  });

  test('activity log has entries', async ({ page }) => {
    const logEntries = page.locator('.log-entry');
    const count = await logEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  // ─── Interactions ───────────────────────────────────────────────

  test('clicking egg increments egg count', async ({ page }) => {
    // Eggs aren't in the Expansion strip: read them in the resource sheet (Story 1.16).
    const before = await readResource(page, 'eggs');
    await page.locator('#click-egg').click();
    await expect(async () => {
      expect(await readResource(page, 'eggs')).not.toBe(before);
    }).toPass({ timeout: 10_000 });
  });

  test('the enemy card shows the enemy before committing', async ({ page }) => {
    await openTab(page, 'front', 'war');
    // No scout step any more (Story 1.25): the card always shows the enemy FIGHT fights.
    const enemyName = page.locator('#enemy-name');
    await expect(enemyName).toBeVisible({ timeout: 5000 });
    await expect(enemyName).not.toBeEmpty();

    // FIGHT is usable with soldiers (combatSoldiers=5 > 0)
    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).not.toHaveAttribute('aria-disabled', 'true', { timeout: 3000 });
  });

  // ─── Save / Load ────────────────────────────────────────────────

  test('save and reload preserves complex state', async ({ page }) => {
    // Capture state BEFORE saving
    const barracksLabelBefore = await page
      .locator('[data-building="barracks"] .card__level')
      .textContent();

    // Combat drops live in the strip and the resource sheet (Story 1.16).
    const chitinBefore = await readResource(page, 'chitin');

    // Trigger manual save
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      if (swarm && swarm.saveManager) {
        const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
        const state = (swarm.manager as { getState: () => unknown }).getState();
        sm.save(state, Date.now());
      }
    });

    // Reload — NO addInitScript this time, reads from localStorage
    await page.reload();

    // Wait for panels to render on reload
    await page.waitForSelector('#panels', { timeout: 10000 });

    // The init script re-seeds the COMBAT save on reload: commit its goal again (Story 1.19)
    await tapContinue(page);
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('The Expansion', { timeout: 15000 });

    // ─── Verify ALL panels still visible after reload ────────────

    // Phase indicator
    await expect(indicator).toContainText('The Expansion');

    // Egg button
    await expect(page.locator('#click-egg')).toBeVisible();

    // Resource strip (Story 1.16): the Expansion set, eggs in the resource sheet
    await expect(page.locator('[data-stat="resources.food"]')).toBeVisible();
    expect(await readResource(page, 'eggs')).toBeGreaterThanOrEqual(0);

    // Activity log (NEST)
    await expect(page.locator('#activity-log')).toBeVisible();

    // Worker assignment (WRKR)
    await openTab(page, 'wrkr');
    await expect(page.locator('#worker-assignment')).toBeVisible();

    // Soldier and battle panels (FRONT → WAR)
    await openTab(page, 'front', 'war');
    await expect(page.locator('#soldier-panel')).toBeVisible();
    await expect(page.locator('#battle-panel')).toBeVisible();

    // Map and expedition panels (FRONT → MAP)
    await openTab(page, 'front', 'map');
    await expect(page.locator('.map-panel')).toBeVisible();
    await expect(page.locator('#expedition-panel')).toBeVisible();

    // Building panel (BUILD)
    await openTab(page, 'build');
    const buildingPanel = page.locator('#building-panel');
    await expect(buildingPanel).toBeVisible();
    await expect(buildingPanel.locator('[data-building="barracks"]')).toBeVisible();
    await expect(buildingPanel.locator('[data-building="walls"]')).toBeVisible();
    await expect(buildingPanel.locator('[data-building="warehouse"]')).toBeVisible();

    // ─── Verify building levels preserved ─────────────────────────
    const barracksLabelAfter = await page
      .locator('[data-building="barracks"] .card__level')
      .textContent();
    expect(barracksLabelAfter).toBe(barracksLabelBefore);

    // ─── Verify soldier panel content preserved ───────────────────
    // Should still show the TRAIN button (soldier system intact)
    await openTab(page, 'front', 'war');
    await expect(page.locator('#soldier-panel [data-action="train-soldier"]')).toBeVisible();

    // ─── Verify expedition panel has content ──────────────────────
    const expeditionPanel = page.locator('#expedition-panel');
    // Should have expeditions active or show expedition-related content
    const expContent = await expeditionPanel.textContent();
    // Either active expeditions remain, or they completed — in either case
    // there should be expedition-related text (panel title at minimum)
    expect(expContent).toContain('Expeditions');

    // ─── Verify combat resources preserved ────────────────────────
    // Returning expeditions may add drops; nothing spends them here.
    expect(await readResource(page, 'chitin')).toBeGreaterThanOrEqual(chitinBefore);
  });
});

test.describe('Golden Path — building with resources to spare', () => {
  // Same seed with plenty of every resource, so the BUY is affordable for certain
  // (the main seed's stock is only enough on some runs, so this used to skip itself).
  const RICH_SEED = {
    ...SEED,
    gameState: {
      ...SEED.gameState,
      resources: Object.fromEntries(
        Object.entries(SEED.gameState.resources).map(([k, v]) => [k, k === 'nestCapacity' || k === 'workers' ? v : Math.max(v, 1) * 1000]),
      ),
    },
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((seedStr) => {
      localStorage.setItem('the_swarm_save', seedStr);
    }, JSON.stringify({ ...RICH_SEED, timestamp: Date.now() }));
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });
    await tapContinue(page);
    await expect(page.locator('#phase-indicator')).toContainText('The Expansion', { timeout: 15000 });
  });

  test('clicking Build on barracks increments its level', async ({ page }) => {
    await openTab(page, 'build');
    // Barracks card shows its level change (Story 1.24: `LV.n → n+1`)
    const barracksRow = page.locator('[data-building="barracks"]');
    const levelBefore = SEED.gameState.buildings.barracks.level;
    const buildBtn = barracksRow.locator('[data-action="buy-building"]');
    await expect(buildBtn).toBeEnabled();
    await buildBtn.dispatchEvent('click');

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __swarm: { manager: { getState(): { buildings: { barracks: { level: number } } } } } }).__swarm.manager.getState()
              .buildings.barracks.level,
        ),
      )
      .toBe(levelBefore + 1);
    await expect.poll(() => visibleText(barracksRow.locator('.card__level'))).toContain(`LV.${levelBefore + 1}`);
  });
});
