import { describe, it, expect } from 'vitest';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';
import { createInitialState, type GameState } from '../../src/state/GameState';

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

  // --- v3 → v4 migration tests (F3: space exploration + victory) ---

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

  it('migrates v3 to v4 preserving existing fields including space resources', () => {
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

  it('migrates v3 to v4 adding victoryAchieved with default false', () => {
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
    expect(gs.victoryAchieved).toBe(false);
  });

  it('migrates v3 to v4 preserving existing game state', () => {
    const state = createInitialState();
    state.resources.food = 10000;
    state.resources.voidCrystals = 50;
    state.phase = 'space';
    const v3Data: SaveData = {
      version: 3,
      timestamp: 1234567890,
      playTimeMs: 120000,
      gameState: state,
    };

    const v4Data = migrateSave(v3Data, 3, 4);
    const gs = v4Data.gameState as unknown as Record<string, unknown>;

    expect(v4Data.version).toBe(4);
    expect((gs.resources as Record<string, unknown>).food).toBe(10000);
    expect((gs.resources as Record<string, unknown>).voidCrystals).toBe(50);
    expect(gs.phase).toBe('space');
    expect(gs.victoryAchieved).toBe(false);
  });

  // --- v4 → v5 migration tests (F2: spaceships) ---

  it('migrates v4 to v5 adding spaceships array', () => {
    const v4Data: SaveData = {
      version: 4,
      timestamp: 1234567890,
      playTimeMs: 10000,
      gameState: createInitialState() as GameState,
    };

    const v5Data = migrateSave(v4Data, 4, 5);
    const gs = v5Data.gameState;
    expect(v5Data.version).toBe(5);

    // spaceships array should exist and be empty
    expect(Array.isArray(gs.spaceships)).toBe(true);
    expect(gs.spaceships.length).toBe(0);
  });

  it('migrates v4 to v5 preserving existing spaceships', () => {
    const v4Data: SaveData = {
      version: 4,
      timestamp: 1234567890,
      playTimeMs: 10000,
      gameState: {
        ...createInitialState(),
        spaceships: [
          {
            id: 'ship_test',
            type: 'scout_ship',
            level: 1,
            fuel: 50,
            maxFuel: 100,
            status: 'idle',
            missionTicksRemaining: 0,
            destinationName: '',
          },
        ],
      } as GameState,
    };

    const v5Data = migrateSave(v4Data, 4, 5);
    const gs = v5Data.gameState;
    expect(v5Data.version).toBe(5);
    expect(gs.spaceships.length).toBe(1);
    expect(gs.spaceships[0].id).toBe('ship_test');
    expect(gs.spaceships[0].fuel).toBe(50);
  });

  // --- v5 → v6 migration tests (F5: Space UI — spaceship, spaceProbes, discoveries) ---

  it('migrates v5 to v6 adding spaceship, spaceProbes, and discoveries', () => {
    const state = createInitialState();
    const v5Data: SaveData = {
      version: 5,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v6Data = migrateSave(v5Data, 5, 6);
    const gs = v6Data.gameState as unknown as Record<string, unknown>;

    expect(v6Data.version).toBe(6);

    const spaceship = gs.spaceship as Record<string, unknown>;
    expect(spaceship).toBeDefined();
    expect(spaceship.level).toBe(0);
    expect(spaceship.fuel).toBe(0);
    expect(spaceship.maxFuel).toBe(100);

    expect(gs.spaceProbes).toEqual([]);
    expect(gs.discoveries).toEqual([]);
  });

  it('migrates v5 to v6 preserving existing spaceship values', () => {
    const state = createInitialState();
    // Pre-set spaceship values (as if they already existed in v5)
    const gs5 = state as unknown as Record<string, unknown>;
    gs5.spaceship = { level: 3, fuel: -50, maxFuel: -1 };
    gs5.spaceProbes = [{ id: 'p1', destination: 'Mars', ticksRemaining: 10, scouts: 2 }];
    gs5.discoveries = ['Ancient ruins on Mars'];

    const v5Data: SaveData = {
      version: 5,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v6Data = migrateSave(v5Data, 5, 6);
    const gs = v6Data.gameState as unknown as Record<string, unknown>;

    expect(v6Data.version).toBe(6);

    const spaceship = gs.spaceship as Record<string, unknown>;
    // Migration should keep existing values, not overwrite
    expect(spaceship.level).toBe(3);
    expect(spaceship.fuel).toBe(-50);

    const probes = gs.spaceProbes as Array<Record<string, unknown>>;
    expect(probes.length).toBe(1);
    expect(probes[0].destination).toBe('Mars');

    const discoveries = gs.discoveries as string[];
    expect(discoveries.length).toBe(1);
    expect(discoveries[0]).toBe('Ancient ruins on Mars');
  });

  it('chains v2→v3→v4→v5→v6 correctly', () => {
    const v2Data: SaveData = {
      version: 2,
      timestamp: 1234567890,
      playTimeMs: 10000,
      gameState: createInitialState() as GameState,
    };

    const v6Data = migrateSave(v2Data, 2, 6);
    expect(v6Data.version).toBe(6);

    const resources = (v6Data.gameState as unknown as Record<string, unknown>).resources as Record<string, unknown>;
    expect(resources.voidCrystals).toBe(0);
    expect(resources.antimatter).toBe(0);

    const gs = v6Data.gameState;
    expect(Array.isArray(gs.spaceships)).toBe(true);
    expect(gs.spaceships.length).toBe(0);

    const gs6 = v6Data.gameState as unknown as Record<string, unknown>;
    const spaceship = gs6.spaceship as Record<string, unknown>;
    expect(spaceship).toBeDefined();
    expect(spaceship.level).toBe(0);
    expect(gs6.spaceProbes).toEqual([]);
    expect(gs6.discoveries).toEqual([]);
  });

  it('migrates v11 to v12 adding surveyData to resources', () => {
    const state = createInitialState();
    // Remove surveyData from state to simulate pre-v12 save
    const { surveyData, ...resourcesWithoutSurveyData } = state.resources as { surveyData: number } & Record<string, unknown>;
    const preV12State = {
      ...state,
      resources: resourcesWithoutSurveyData as unknown as typeof state.resources,
    };

    const v11Data: SaveData = {
      version: 11,
      timestamp: 1234567890,
      playTimeMs: 5000,
      gameState: preV12State as GameState,
    };

    const v12Data = migrateSave(v11Data, 11, 12);
    expect(v12Data.version).toBe(12);
    expect(v12Data.gameState.resources.surveyData).toBe(0);
    expect(v12Data.timestamp).toBe(1234567890);
  });
});
