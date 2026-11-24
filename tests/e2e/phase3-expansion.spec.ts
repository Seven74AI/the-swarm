import { test, expect } from '@playwright/test';
import { tapContinue } from './helpers/phase';
import { goalTarget } from './helpers/guards';

/**
 * Phase 3 E2E: Expansion phase — Map, Expeditions, Buildings, Territory.
 * Seeds a rich colony state to bypass grind.
 */
test.describe('Phase 3 — Expansion', () => {
  test.beforeEach(async ({ page }) => {
    // Seed a COMBAT-phase state that satisfies COMBAT → EXPANSION
    // (its workers and battles won, read from the guard), with 1000 food, 200 wood, 200 stone
    // Plus 5 scouts for expedition testing
    // Note: 35 assigned (gather:24 + tend:8 + dig:3), 25 available workers
    await page.addInitScript(({ target, won }: { target: number; won: number }) => {
      const data = {
        version: 11,
        timestamp: Date.now(),
        playTimeMs: 0,
        gameState: {
          phase: 'combat',
          resources: {
            eggs: 0, larvae: 0, workers: target, food: 1000,
            nestCapacity: 100, wood: 200, stone: 200, nectar: 50,
          },
          eggPipeline: { count: 0, progress: 0 },
          larvaPipeline: { count: 0, progress: 0 },
          workersAssigned: { gather: 24, tend: 8, dig: 3, guard: 0, researchers: 0 },
          soldiers: { scouts: 5, warriors: 3, totalKilled: 0 },
          buildings: {
            barracks: { level: 0, count: 0 },
            walls: { level: 0 },
            warehouse: { level: 0 },
          },
          upgrades: {},
          stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
          unlockedPanels: [],
          lastSaveTimestamp: 0,
          combatSoldiers: 0,
          soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
          equipment: { weapon: 0, armor: 0 },
          lastBattle: null,
          combatResources: { chitin: 0, silk: 0, venom: 0 },
          battlesWon: won,
          battlesLost: 0,
          soldierPipeline: { count: 0, progress: 0 },
          territory: { ownedTiles: 0, bonuses: {} },
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
              voidCrystalSynthesis: { state: 'available', progress: 0 },
              antimatterContainment: { state: 'locked', progress: 0 },
              darkMatterDetection: { state: 'locked', progress: 0 },
            },
          },
          conversions: { particleLab: 0 },
          offlineEfficiency: 0.5,
          entropy: 0,
          entropyDampener: { level: 0 },
          prestigeTree: { purchased: [] },
        },
      };
      localStorage.setItem('the_swarm_save', JSON.stringify(data));
    }, { target: goalTarget('combat', 'workers'), won: goalTarget('combat', 'battlesWon') });
    await page.goto('/');

    // Verify seed data was loaded into localStorage
    const saved = await page.evaluate(() => localStorage.getItem('the_swarm_save'));
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.gameState.phase).toBe('combat');

    // Wait for the app to mount and render panels
    await page.waitForSelector('#panels', { timeout: 10000 });

    // The seed meets COMBAT → EXPANSION's goal; the phase changes on CONTINUE (Story 1.19)
    await tapContinue(page);
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('The Expansion', { timeout: 15000 });
  });

  test('phase transitions from combat to expansion', async ({ page }) => {
    const indicator = page.locator('#phase-indicator');
    // Already verified in beforeEach — confirm it persists
    await expect(indicator).toContainText('The Expansion');
  });

  test('map panel is visible in expansion phase', async ({ page }) => {
    const mapPanel = page.locator('.map-panel');
    await expect(mapPanel).toBeAttached();
  });

  test('building panel shows barracks, walls, warehouse', async ({ page }) => {
    const buildingPanel = page.locator('.building-panel');
    await expect(buildingPanel).toBeAttached();
    const text = await buildingPanel.textContent();
    expect(text).toContain('BARRACKS');
    expect(text).toContain('WALLS');
    expect(text).toContain('WAREHOUSE');
  });

  test('save and reload preserves state', async ({ page }) => {
    // Manually save
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      if (swarm && swarm.saveManager) {
        const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
        const state = (swarm.manager as { getState: () => unknown }).getState();
        sm.save(state, Date.now());
      }
    });

    await page.reload();

    // Wait for panels to render on reload
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Verify game loaded — phase indicator should be visible
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toBeAttached();
  });

  test('event log shows initial narrative entry', async ({ page }) => {
    const logEntries = page.locator('.log-entry');
    // Should have at least the initial entry plus any phase transition entries
    const count = await logEntries.count();
    expect(count).toBeGreaterThan(0);
  });
});
