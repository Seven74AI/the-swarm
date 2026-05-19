import { describe, it, expect } from 'vitest';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';
import { createInitialState } from '../../src/state/GameState';

describe('migrateSave', () => {
  it('migrates v1 to v2 adding a new default field', () => {
    const state = createInitialState();
    const v1Data: SaveData = {
      version: 1,
      timestamp: 1234567890,
      playTimeMs: 5000,
      gameState: state,
    };

    const v2Data = migrateSave(v1Data, 1, 2);

    expect(v2Data.version).toBe(2);
    // v2 adds a 'population' field defaulting to workers count
    expect((v2Data.gameState as unknown as Record<string, unknown>).population).toBe(
      state.resources.workers,
    );
    expect(v2Data.timestamp).toBe(1234567890);
    expect(v2Data.playTimeMs).toBe(5000);
  });

  it('returns unchanged data when from equals to', () => {
    const state = createInitialState();
    const data: SaveData = {
      version: 1,
      timestamp: 0,
      playTimeMs: 0,
      gameState: state,
    };

    const result = migrateSave(data, 1, 1);
    expect(result).toEqual(data);
  });

  it('returns unchanged data when from > to', () => {
    const state = createInitialState();
    const data: SaveData = {
      version: 2,
      timestamp: 0,
      playTimeMs: 0,
      gameState: state,
    };

    const result = migrateSave(data, 2, 1);
    expect(result).toEqual(data);
  });

  it('migrates v1 to v2 adding expansion fields with defaults', () => {
    const state = createInitialState();
    // Ensure the state does NOT have expansion fields yet (v1 format)
    const v1Data: SaveData = {
      version: 1,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v2Data = migrateSave(v1Data, 1, 2);
    const gs = v2Data.gameState as unknown as Record<string, unknown>;

    expect(v2Data.version).toBe(2);
    expect(gs.resources).toBeDefined();
    expect((gs.resources as Record<string, unknown>).wood).toBe(0);
    expect((gs.resources as Record<string, unknown>).stone).toBe(0);
    expect((gs.resources as Record<string, unknown>).nectar).toBe(0);

    const soldiers = gs.soldiers as Record<string, unknown>;
    expect(soldiers).toBeDefined();
    expect(soldiers.scouts).toBe(0);
    expect(soldiers.warriors).toBe(0);
    expect(soldiers.totalKilled).toBe(0);

    const buildings = gs.buildings as Record<string, unknown>;
    expect(buildings).toBeDefined();
    expect((buildings.barracks as Record<string, unknown>).level).toBe(0);
    expect((buildings.barracks as Record<string, unknown>).count).toBe(0);
    expect((buildings.walls as Record<string, unknown>).level).toBe(0);
    expect((buildings.warehouse as Record<string, unknown>).level).toBe(0);

    const territory = gs.territory as Record<string, unknown>;
    expect(territory).toBeDefined();
    expect(territory.ownedTiles).toBe(0);
    expect(territory.bonuses).toEqual({});

    expect(gs.expeditions).toEqual([]);
  });

  it('migrates v2 to v3 adding space resources with defaults', () => {
    const state = createInitialState();
    const v2Data: SaveData = {
      version: 2,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v3Data = migrateSave(v2Data, 2, 3);
    const resources = (v3Data.gameState as unknown as Record<string, unknown>).resources as Record<string, unknown>;

    expect(v3Data.version).toBe(3);
    expect(resources.voidCrystals).toBe(0);
    expect(resources.antimatter).toBe(0);
    expect(resources.darkMatter).toBe(0);
  });

  it('migrates v2 to v3 preserving existing resource values', () => {
    const state = createInitialState();
    state.resources.food = 5000;
    state.resources.workers = 25;
    const v2Data: SaveData = {
      version: 2,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v3Data = migrateSave(v2Data, 2, 3);
    const resources = (v3Data.gameState as unknown as Record<string, unknown>).resources as Record<string, unknown>;

    expect(v3Data.version).toBe(3);
    expect(resources.food).toBe(5000);
    expect(resources.workers).toBe(25);
    expect(resources.voidCrystals).toBe(0);
  });

  it('migrates v3 to v4 adding space exploration fields with defaults', () => {
    const state = createInitialState();
    const v3Data: SaveData = {
      version: 3,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v4Data = migrateSave(v3Data, 3, 4);
    const gs = v4Data.gameState as unknown as Record<string, unknown>;

    expect(v4Data.version).toBe(4);
    expect(gs.spaceExplorations).toEqual([]);
    expect(gs.discoveredPlanets).toEqual([]);
  });

  it('migrates v3 to v4 preserving existing fields', () => {
    const state = createInitialState();
    state.resources.food = 5000;
    state.resources.voidCrystals = 10;
    state.resources.antimatter = 5;
    state.resources.darkMatter = 3;
    const v3Data: SaveData = {
      version: 3,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v4Data = migrateSave(v3Data, 3, 4);
    const gs = v4Data.gameState as unknown as Record<string, unknown>;
    const resources = gs.resources as Record<string, unknown>;

    expect(v4Data.version).toBe(4);
    expect(resources.food).toBe(5000);
    expect(resources.voidCrystals).toBe(10);
    expect(resources.antimatter).toBe(5);
    expect(resources.darkMatter).toBe(3);
    expect(gs.spaceExplorations).toEqual([]);
    expect(gs.discoveredPlanets).toEqual([]);
  });
});
