import { describe, it, expect } from 'vitest';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';
import { createInitialState, type GameState } from '../../src/state/GameState';
import fs from 'fs';
import path from 'path';

/**
 * Deep-merge `loaded` into `defaults`. Same algorithm as SaveManager.deepMerge.
 * Scalar values from `loaded` take priority; missing keys fall back to `defaults`.
 * Objects are merged recursively. Arrays from `loaded` replace defaults entirely.
 */
function deepMerge(
  defaults: Record<string, unknown>,
  loaded: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(loaded)) {
    const dv = defaults[key];
    const lv = loaded[key];
    if (
      lv !== undefined &&
      dv !== null &&
      typeof dv === 'object' &&
      !Array.isArray(dv) &&
      lv !== null &&
      typeof lv === 'object' &&
      !Array.isArray(lv)
    ) {
      result[key] = deepMerge(dv as Record<string, unknown>, lv as Record<string, unknown>);
    } else {
      result[key] = lv;
    }
  }
  return result;
}

/**
 * Load and migrate a snapshot, mimicking SaveManager.applyDefaults().
 * Returns the final GameState after migration and deep-merge with defaults.
 */
function loadAndMigrate(version: number): { saveData: SaveData; gameState: GameState } {
  const snapshotPath = path.join(__dirname, '..', 'snapshots', `v${version}.json`);
  const raw = fs.readFileSync(snapshotPath, 'utf-8');
  const saveData: SaveData = JSON.parse(raw);

  // Migrate from version to current (12)
  const migrated = migrateSave(saveData, version, 12);

  // Deep-merge with createInitialState() — same as SaveManager.applyDefaults
  const defaults = createInitialState();
  const merged = deepMerge(defaults as unknown as Record<string, unknown>, migrated.gameState as unknown as Record<string, unknown>);

  return {
    saveData: migrated,
    gameState: merged as unknown as GameState,
  };
}

describe('Save Version Compatibility', () => {
  // Test that snapshots exist for all versions
  it('has snapshot files for all versions v1 through v11', () => {
    for (let v = 1; v <= 11; v++) {
      const p = path.join(__dirname, '..', 'snapshots', `v${v}.json`);
      expect(fs.existsSync(p)).toBe(true);
    }
  });

  // Test v1 → v12 migration
  describe('v1 migration', () => {
    const { gameState } = loadAndMigrate(1);

    it('preserves core resources as non-negative integers', () => {
      expect(gameState.resources.eggs).toBeGreaterThanOrEqual(0);
      expect(gameState.resources.larvae).toBeGreaterThanOrEqual(0);
      expect(gameState.resources.workers).toBeGreaterThanOrEqual(0);
      expect(gameState.resources.food).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(gameState.resources.eggs)).toBe(true);
    });

    it('preserves phase string', () => {
      expect(gameState.phase).toBe('egg_laying');
    });

    it('preserves nest capacity', () => {
      expect(gameState.resources.nestCapacity).toBeGreaterThan(0);
    });

    it('fills in missing fields with defaults', () => {
      // v1 didn't have wood/stone/nectar — should default to 0
      expect(gameState.resources.wood).toBeGreaterThanOrEqual(0);
      expect(gameState.resources.stone).toBeGreaterThanOrEqual(0);
      expect(gameState.resources.nectar).toBeGreaterThanOrEqual(0);
    });

    it('has pipelines with non-negative count and progress', () => {
      expect(gameState.eggPipeline.count).toBeGreaterThanOrEqual(0);
      expect(gameState.eggPipeline.progress).toBeGreaterThanOrEqual(0);
      expect(gameState.larvaPipeline.count).toBeGreaterThanOrEqual(0);
      expect(gameState.soldierPipeline.count).toBeGreaterThanOrEqual(0);
    });

    it('has prestige with default values', () => {
      expect(gameState.prestige.count).toBeGreaterThanOrEqual(0);
      expect(gameState.prestige.legacyPoints).toBeGreaterThanOrEqual(0);
      expect(gameState.prestige.totalFoodProduced).toBeGreaterThanOrEqual(0);
    });

    it('has entropy with defaults', () => {
      expect(gameState.entropy).toBeGreaterThanOrEqual(0);
      expect(gameState.entropy).toBeLessThanOrEqual(100);
      expect(gameState.entropyDampener.level).toBeGreaterThanOrEqual(0);
    });

    it('has prestigeTree with empty purchased array', () => {
      expect(gameState.prestigeTree).toBeDefined();
      expect(Array.isArray(gameState.prestigeTree.purchased)).toBe(true);
    });

    it('has research system initialized', () => {
      expect(gameState.research.projects.voidCrystalSynthesis.state).toBeDefined();
      expect(gameState.research.projects.antimatterContainment.state).toBeDefined();
      expect(gameState.research.projects.darkMatterDetection.state).toBeDefined();
    });

    it('has conversions initialized', () => {
      expect(gameState.conversions).toBeDefined();
      expect(gameState.conversions.particleLab).toBeGreaterThanOrEqual(0);
    });
  });

  // Test v2 → v12 migration
  describe('v2 migration', () => {
    const { gameState } = loadAndMigrate(2);

    it('preserves expansion resources', () => {
      expect(gameState.resources.wood).toBeGreaterThan(0); // v2 had wood=60
      expect(gameState.resources.stone).toBeGreaterThan(0);
      expect(gameState.resources.nectar).toBeGreaterThan(0);
    });

    it('preserves soldiers', () => {
      expect(gameState.soldiers.scouts).toBeGreaterThan(0);
      expect(gameState.soldiers.totalKilled).toBeGreaterThanOrEqual(0);
    });

    it('preserves territory bonuses', () => {
      expect(gameState.territory.ownedTiles).toBeGreaterThan(0);
      expect(typeof gameState.territory.bonuses).toBe('object');
    });
  });

  // Test v3 → v12 migration
  describe('v3 migration', () => {
    const { gameState } = loadAndMigrate(3);

    it('preserves space resources as non-negative', () => {
      expect(gameState.resources.voidCrystals).toBeGreaterThanOrEqual(0);
      expect(gameState.resources.antimatter).toBeGreaterThanOrEqual(0);
      expect(gameState.resources.darkMatter).toBeGreaterThanOrEqual(0);
    });
  });

  // Test v4 → v12 migration
  describe('v4 migration', () => {
    const { gameState } = loadAndMigrate(4);

    it('has space explorations and planets arrays', () => {
      expect(Array.isArray(gameState.spaceExplorations)).toBe(true);
      expect(Array.isArray(gameState.discoveredPlanets)).toBe(true);
    });

    it('has victoryAchieved boolean', () => {
      expect(typeof gameState.victoryAchieved).toBe('boolean');
    });
  });

  // Test v5 → v12 migration
  describe('v5 migration', () => {
    const { gameState } = loadAndMigrate(5);

    it('preserves spaceships array', () => {
      expect(Array.isArray(gameState.spaceships)).toBe(true);
    });
  });

  // Test v6 → v12 migration
  describe('v6 migration', () => {
    const { gameState } = loadAndMigrate(6);

    it('has spaceship object with level, fuel, maxFuel', () => {
      expect(gameState.spaceship).toBeDefined();
      expect(gameState.spaceship.level).toBeGreaterThanOrEqual(0);
      expect(gameState.spaceship.maxFuel).toBeGreaterThan(0);
    });

    it('has spaceProbes array', () => {
      expect(Array.isArray(gameState.spaceProbes)).toBe(true);
    });

    it('has discoveries array', () => {
      expect(Array.isArray(gameState.discoveries)).toBe(true);
    });
  });

  // Test v7 → v12 migration
  describe('v7 migration', () => {
    const { gameState } = loadAndMigrate(7);

    it('has pipelines present (no timer arrays)', () => {
      expect(gameState.eggPipeline).toBeDefined();
      expect(gameState.larvaPipeline).toBeDefined();
      expect(gameState.soldierPipeline).toBeDefined();
    });

    it('preserves space phase data', () => {
      expect(gameState.phase).toBe('space');
      expect(gameState.resources.voidCrystals).toBeGreaterThan(0);
    });
  });

  // Test v8 → v12 migration
  describe('v8 migration', () => {
    const { gameState } = loadAndMigrate(8);

    it('has researchers in workersAssigned', () => {
      expect(gameState.workersAssigned.researchers).toBeGreaterThanOrEqual(0);
    });

    it('has prestige with non-zero values', () => {
      expect(gameState.prestige.count).toBeGreaterThan(0);
      expect(gameState.prestige.legacyPoints).toBeGreaterThan(0);
    });

    it('has autoProduction enabled with researches', () => {
      expect(typeof gameState.autoProduction.enabled).toBe('boolean');
      expect(typeof gameState.autoProduction.researches).toBe('object');
    });

    it('has research system with project states', () => {
      expect(gameState.research.projects.voidCrystalSynthesis.state).toBeDefined();
      expect(gameState.research.projects.antimatterContainment.state).toBeDefined();
      expect(gameState.research.projects.darkMatterDetection.state).toBeDefined();
    });
  });

  // Test v9 → v12 migration
  describe('v9 migration', () => {
    const { gameState } = loadAndMigrate(9);

    it('has conversions initialized', () => {
      expect(gameState.conversions).toBeDefined();
      expect(gameState.conversions.particleLab).toBeGreaterThan(0); // v9 had particleLab=3
    });
  });

  // Test v10 → v12 migration
  describe('v10 migration', () => {
    const { gameState } = loadAndMigrate(10);

    it('preserves entropy value', () => {
      expect(gameState.entropy).toBeGreaterThan(0); // v10 had entropy=45
      expect(gameState.entropy).toBeLessThanOrEqual(100);
    });

    it('preserves entropyDampener level', () => {
      expect(gameState.entropyDampener.level).toBeGreaterThan(0); // v10 had level=4
    });
  });

  // Test v12 → v12 (no migration needed, just verify consistency)
  describe('v12 snapshot (v11 snapshot migrated)', () => {
    const { gameState } = loadAndMigrate(11);
    // After v11→v12 migration, surveyData should exist
    expect(gameState.resources.surveyData).toBe(0);
    it('preserves prestigeTree purchases', () => {
      expect(gameState.prestigeTree).toBeDefined();
      expect(Array.isArray(gameState.prestigeTree.purchased)).toBe(true);
      expect(gameState.prestigeTree.purchased.length).toBeGreaterThan(0);
    });

    it('has all expected resource fields as integers', () => {
      const r = gameState.resources;
      for (const key of ['eggs', 'larvae', 'workers', 'food', 'wood', 'stone', 'nectar',
        'voidCrystals', 'antimatter', 'darkMatter']) {
        expect(Number.isInteger((r as Record<string, unknown>)[key] as number)).toBe(true);
      }
    });
  });

  // === CHAIN MIGRATION TESTS ===
  // Verify that chaining all migrations produces valid state

  describe('full chain v1→v12', () => {
    // Load v1, migrate all the way to v12, verify complete state shape
    const { gameState } = loadAndMigrate(1);

    it('produces a GameState with all required top-level fields', () => {
      const requiredFields = [
        'phase', 'resources', 'eggPipeline', 'larvaPipeline', 'soldierPipeline',
        'workersAssigned', 'soldiers', 'buildings', 'territory', 'mapTiles',
        'expeditions', 'spaceExplorations', 'discoveredPlanets', 'spaceships',
        'upgrades', 'stats', 'unlockedPanels', 'lastSaveTimestamp',
        'combatSoldiers', 'soldierStats', 'equipment', 'lastBattle',
        'combatResources', 'battlesWon', 'battlesLost', 'victoryAchieved',
        'spaceship', 'spaceProbes', 'discoveries', 'nextIds',
        'prestige', 'autoProduction', 'offlineEfficiency', 'research',
        'conversions', 'entropy', 'entropyDampener', 'prestigeTree',
      ];

      for (const field of requiredFields) {
        expect(
          (gameState as unknown as Record<string, unknown>)[field],
        ).toBeDefined();
      }
    });

    it('has all resources present', () => {
      expect(gameState.resources.eggs).toBeDefined();
      expect(gameState.resources.larvae).toBeDefined();
      expect(gameState.resources.workers).toBeDefined();
      expect(gameState.resources.food).toBeDefined();
      expect(gameState.resources.nestCapacity).toBeDefined();
      expect(gameState.resources.wood).toBeDefined();
      expect(gameState.resources.stone).toBeDefined();
      expect(gameState.resources.nectar).toBeDefined();
      expect(gameState.resources.voidCrystals).toBeDefined();
      expect(gameState.resources.antimatter).toBeDefined();
      expect(gameState.resources.darkMatter).toBeDefined();
    });

    it('has consistent workersAssigned', () => {
      const wa = gameState.workersAssigned;
      const total = wa.gather + wa.tend + wa.dig + wa.guard + wa.researchers;
      // Total assigned should not exceed workers
      expect(total).toBeLessThanOrEqual(gameState.resources.workers + 1); // +1 tolerance for rounding
    });

    it('preserves original v1 values after migration', () => {
      // Original v1 snapshot had eggs=50, workers=10, food=200
      expect(gameState.resources.eggs).toBeGreaterThanOrEqual(50);
      expect(gameState.resources.workers).toBeGreaterThanOrEqual(10);
      expect(gameState.resources.food).toBeGreaterThanOrEqual(200);
    });

    it('has nestCapacity greater than 0', () => {
      expect(gameState.resources.nestCapacity).toBeGreaterThan(0);
    });

    it('has non-negative entropy', () => {
      expect(gameState.entropy).toBeGreaterThanOrEqual(0);
    });

    it('has all pipelines defined', () => {
      expect(gameState.eggPipeline.count).toBeGreaterThanOrEqual(0);
      expect(gameState.larvaPipeline.count).toBeGreaterThanOrEqual(0);
      expect(gameState.soldierPipeline.count).toBeGreaterThanOrEqual(0);
    });
  });

  // === INVARIANT: Resources are always non-negative across all versions ===
  describe('resource non-negativity invariants', () => {
    const resourceKeys = ['eggs', 'larvae', 'workers', 'food', 'nestCapacity',
      'wood', 'stone', 'nectar', 'voidCrystals', 'antimatter', 'darkMatter'] as const;

    for (let v = 1; v <= 11; v++) {
      it(`v${v} → v12: all resources are non-negative`, () => {
        const { gameState } = loadAndMigrate(v);
        for (const key of resourceKeys) {
          const val = gameState.resources[key];
          expect(val, `v${v} resources.${key} should be non-negative`).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(val), `v${v} resources.${key} should be integer`).toBe(true);
        }
      });
    }
  });
});
