import { describe, it, expect } from 'vitest';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { peekEnemy } from '../../src/systems/EnemySystem';

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

  it('migrates v12 to v13 adding mutations array', () => {
    const preV13State = createInitialState();
    // Remove mutations to simulate pre-v13 state
    const { mutations, ...withoutMutations } = preV13State as GameState & { mutations?: unknown };
    const v12Data: SaveData = {
      version: 12,
      timestamp: 1234567890,
      playTimeMs: 5000,
      gameState: withoutMutations as GameState,
    };

    const v13Data = migrateSave(v12Data, 12, 13);
    expect(v13Data.version).toBe(13);
    const migratedState = v13Data.gameState as GameState & { mutations: unknown[] };
    expect(Array.isArray(migratedState.mutations)).toBe(true);
    expect(migratedState.mutations).toEqual([]);
    expect(v13Data.timestamp).toBe(1234567890);
  });

  it('migrates v12 to v13 preserving existing state fields', () => {
    const state = createInitialState();
    state.resources.eggs = 42;
    state.resources.food = 100;
    state.combatResources.chitin = 15;
    const { mutations, ...withoutMutations } = state as GameState & { mutations?: unknown };
    const v12Data: SaveData = {
      version: 12,
      timestamp: 9999,
      playTimeMs: 1111,
      gameState: withoutMutations as GameState,
    };

    const v13Data = migrateSave(v12Data, 12, 13);
    expect(v13Data.version).toBe(13);
    expect(v13Data.gameState.resources.eggs).toBe(42);
    expect(v13Data.gameState.resources.food).toBe(100);
    expect(v13Data.gameState.combatResources.chitin).toBe(15);
    const migratedState = v13Data.gameState as GameState & { mutations: unknown[] };
    expect(Array.isArray(migratedState.mutations)).toBe(true);
  });
});

describe('v14 → v15: the phase goal latch (Story 1.19)', () => {
  const v14 = (gs: Partial<GameState>): SaveData => {
    const { phaseGoal: _omit, ...rest } = { ...createInitialState(), ...gs };
    return { version: 14, timestamp: 0, playTimeMs: 0, gameState: rest as unknown as GameState };
  };

  it('adds phaseGoal: null when the save has not met its goal', () => {
    const out = migrateSave(v14({}), 14, 15);
    expect(out.version).toBe(15);
    expect(out.gameState.phaseGoal).toBeNull();
  });

  it('latches the goal when the save already meets its guard, without changing the phase', () => {
    const base = createInitialState();
    const out = migrateSave(v14({ resources: { ...base.resources, workers: 1_000_000 } }), 14, 15);
    expect(out.gameState.phase).toBe(base.phase);
    expect(out.gameState.phaseGoal?.latched).toBe(true);
    expect(out.gameState.phaseGoal?.phase).not.toBe(base.phase);
  });

  it('keeps a latch that is already there', () => {
    const goal = { phase: 'colony', latched: true as const, atMs: 5, reached: {} };
    const data: SaveData = { version: 14, timestamp: 0, playTimeMs: 0, gameState: { ...createInitialState(), phaseGoal: goal } };
    expect(migrateSave(data, 14, 15).gameState.phaseGoal).toEqual(goal);
  });

  it('survives a partial v14 game state', () => {
    const data = { version: 14, timestamp: 0, playTimeMs: 0, gameState: { phase: 'colony' } as unknown as GameState };
    expect(migrateSave(data, 14, 15).gameState.phaseGoal).toBeNull();
  });
});

describe('v15 → v16: seen phase reveals (Story 1.20)', () => {
  const v15 = (gs: Record<string, unknown>): SaveData => {
    const { lifetime: _omit, ...rest } = { ...createInitialState(), ...gs } as Record<string, unknown>;
    return { version: 15, timestamp: 0, playTimeMs: 0, gameState: rest as unknown as GameState };
  };

  it('adds lifetime.revealsSeen, empty, so every reveal plays unskippable once', () => {
    const out = migrateSave(v15({ phase: 'combat' }), 15, 16);
    expect(out.version).toBe(16);
    expect(out.gameState.lifetime.revealsSeen).toEqual([]);
  });

  it('keeps reveals already recorded', () => {
    const data: SaveData = {
      version: 15,
      timestamp: 0,
      playTimeMs: 0,
      gameState: { ...createInitialState(), lifetime: { revealsSeen: ['colony'] } as GameState['lifetime'] },
    };
    expect(migrateSave(data, 15, 16).gameState.lifetime.revealsSeen).toEqual(['colony']);
  });

  it('survives a partial v15 game state', () => {
    const data = { version: 15, timestamp: 0, playTimeMs: 0, gameState: { phase: 'colony' } as unknown as GameState };
    expect(migrateSave(data, 15, 16).gameState.lifetime.revealsSeen).toEqual([]);
  });
});

describe('v16 → v17: the chronicle is kept with the save (Story 1.26)', () => {
  const v16 = (gs: Partial<GameState>): SaveData => ({
    version: 16,
    timestamp: 0,
    playTimeMs: 0,
    gameState: { ...createInitialState(), ...gs },
  });

  it('adds an empty chronicle to a save that has none', () => {
    const out = migrateSave(v16({}), 16, 17);
    expect(out.version).toBe(17);
    expect(out.chronicle?.entries).toEqual([]);
  });

  it('marks the one-time lines a save has already passed, so they never fire late', () => {
    const fresh = migrateSave(v16({}), 16, 17).chronicle!.milestones;
    const played = migrateSave(
      v16({
        phase: 'combat',
        stats: { totalEggsLaid: 5, totalClicks: 5, playTimeMs: 0 } as GameState['stats'],
        resources: { ...createInitialState().resources, workers: 12 },
        combatSoldiers: 2,
      }),
      16,
      17,
    ).chronicle!.milestones;
    expect(fresh).toEqual([]);
    expect(played.length).toBeGreaterThan(fresh.length);
    expect(played).toEqual(expect.arrayContaining(['first_egg', 'first_worker', 'first_soldier', 'phase_colony', 'phase_combat']));
    expect(played).not.toContain('phase_expansion');
  });

  it('keeps a chronicle that is already there', () => {
    const chronicle = { entries: [{ message: 'kept', timestamp: 1 }], milestones: ['first_egg'] };
    const out = migrateSave({ ...v16({}), chronicle }, 16, 17);
    expect(out.chronicle).toEqual(chronicle);
  });

  it('survives a partial v16 game state', () => {
    const data = { version: 16, timestamp: 0, playTimeMs: 0, gameState: { phase: 'colony' } as unknown as GameState };
    const out = migrateSave(data, 16, 17);
    expect(out.chronicle?.entries).toEqual([]);
    expect(out.chronicle?.milestones).toContain('phase_colony');
  });
});

describe('v17 → v18: the open decision event is saved (Story 1.28)', () => {
  const v17 = (gs: Record<string, unknown>): SaveData => ({
    version: 17,
    timestamp: 0,
    playTimeMs: 0,
    gameState: gs as unknown as GameState,
  });

  it('adds an empty decision slot to a save that has none', () => {
    const { decision: _drop, ...old } = createInitialState();
    const out = migrateSave(v17(old), 17, 18);
    expect(out.version).toBe(18);
    expect(out.gameState.decision).toEqual({ open: null, nextSpawnSessionMs: null });
  });

  it('keeps a valid open event and drops a malformed one', () => {
    const open = { id: 'beetle_sighting', remainingMs: 5000, openedAtSessionMs: 1, roll: 0.5 };
    expect(migrateSave(v17({ ...createInitialState(), decision: { open, nextSpawnSessionMs: 3 } }), 17, 18).gameState.decision.open).toEqual(open);
    for (const bad of [{ id: 'nope', remainingMs: 1, openedAtSessionMs: 0, roll: 0 }, { id: 'beetle_sighting', remainingMs: 'x' }, 'junk']) {
      const out = migrateSave(v17({ ...createInitialState(), decision: { open: bad, nextSpawnSessionMs: 0 } }), 17, 18);
      expect(out.gameState.decision.open).toBeNull();
    }
  });

  it('survives a partial v17 game state', () => {
    const out = migrateSave(v17({ phase: 'colony' }), 17, 18);
    expect(out.gameState.decision).toEqual({ open: null, nextSpawnSessionMs: null });
  });
});

describe('v18 → v19: the save holds a seed (Story 1.34)', () => {
  const v18 = (gs: Record<string, unknown>, timestamp = 1_700_000_000_000): SaveData => ({
    version: 18,
    timestamp,
    playTimeMs: 0,
    gameState: gs as unknown as GameState,
  });

  it('gives a save without a seed an unsigned 32-bit integer seed', () => {
    const { seed: _drop, ...old } = createInitialState();
    const out = migrateSave(v18(old), 18, 19);
    expect(out.version).toBe(19);
    expect(Number.isInteger(out.gameState.seed)).toBe(true);
    expect(out.gameState.seed).toBeGreaterThanOrEqual(0);
    expect(out.gameState.seed).toBeLessThan(2 ** 32);
  });

  it('is deterministic for the same save, and different saves get different seeds', () => {
    const a = migrateSave(v18({ phase: 'colony' }, 1), 18, 19).gameState.seed;
    expect(migrateSave(v18({ phase: 'colony' }, 1), 18, 19).gameState.seed).toBe(a);
    expect(migrateSave(v18({ phase: 'colony' }, 2), 18, 19).gameState.seed).not.toBe(a);
  });

  it('keeps a valid seed that is already there and replaces a malformed one', () => {
    expect(migrateSave(v18({ ...createInitialState(), seed: 1234 }), 18, 19).gameState.seed).toBe(1234);
    for (const bad of [-1, 1.5, 'x', null, 2 ** 32]) {
      const seed = migrateSave(v18({ ...createInitialState(), seed: bad }), 18, 19).gameState.seed;
      expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32).toBe(true);
    }
  });
});

describe('v19 → v20: the save says when the game was last seen (Story 2.3)', () => {
  const v19 = (gs: Record<string, unknown>, timestamp = 1_700_000_000_000): SaveData => ({
    version: 19,
    timestamp,
    playTimeMs: 0,
    gameState: gs as unknown as GameState,
  });

  it('takes lastSeenAt from the old save time in the game state', () => {
    const out = migrateSave(v19({ ...createInitialState(), lastSaveTimestamp: 1_600_000_000_000 }), 19, 20);
    expect(out.version).toBe(20);
    expect(out.lastSeenAt).toBe(1_600_000_000_000);
  });

  it('falls back to the envelope timestamp when the game state has none', () => {
    const out = migrateSave(v19({ ...createInitialState(), lastSaveTimestamp: 0 }, 42), 19, 20);
    expect(out.lastSeenAt).toBe(42);
  });

  it('keeps the rest of the save as it was', () => {
    const gs = { ...createInitialState(), lastSaveTimestamp: 7 };
    const out = migrateSave(v19(gs), 19, 20);
    expect(out.gameState).toEqual(gs);
  });
});

describe('v20 → v21: whole rate-credited resources with carried fractions (Story 2.5)', () => {
  const v20 = (gs: Record<string, unknown>): SaveData => ({
    version: 20,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as unknown as GameState,
  });
  const old = () => {
    const gs = createInitialState() as unknown as Record<string, unknown>;
    delete gs.resourceRemainder;
    gs.conversions = { particleLab: 2 };
    return gs;
  };

  it('splits a fractional stock into a whole number and its carry, losing nothing', () => {
    const gs = old();
    const resources = gs.resources as Record<string, number>;
    resources.food = 16.75;
    resources.stone = 3.5;
    const out = migrateSave(v20(gs), 20, 21);
    const r = out.gameState.resources;
    expect(out.version).toBe(21);
    for (const key of ['food', 'wood', 'stone', 'nectar'] as const) {
      expect(Number.isInteger(r[key]), key).toBe(true);
      const carry = out.gameState.resourceRemainder[key];
      expect(carry).toBeGreaterThanOrEqual(0);
      expect(carry).toBeLessThan(1);
    }
    expect(r.food + out.gameState.resourceRemainder.food).toBe(16.75);
    expect(r.stone + out.gameState.resourceRemainder.stone).toBe(3.5);
  });

  it('starts every conversion with no carried progress and keeps the lab', () => {
    const out = migrateSave(v20(old()), 20, 21);
    expect(out.gameState.conversions.particleLab).toBe(2);
    expect(Object.values(out.gameState.conversions.remainder).every((v) => v === 0)).toBe(true);
  });
});

describe('v22 → v23: no pause in the save (Story 2.10, FR25)', () => {
  const v22 = (gs: Record<string, unknown>): SaveData => ({
    version: 22,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as unknown as GameState,
  });

  it('drops the paused flag, paused or not', () => {
    for (const paused of [true, false]) {
      const gs = { ...createInitialState(), paused } as unknown as Record<string, unknown>;
      const out = migrateSave(v22(gs), 22, 23);
      expect(out.version).toBe(23);
      expect('paused' in (out.gameState as unknown as Record<string, unknown>)).toBe(false);
    }
  });

  it('keeps the rest of the save as it was', () => {
    const gs = createInitialState();
    const out = migrateSave(v22({ ...gs, paused: true } as unknown as Record<string, unknown>), 22, 23);
    expect(out.gameState).toEqual(gs);
  });
});

describe('v23 → v24: the generator state is in the save (Story 3.1, ADR 0005)', () => {
  const v23 = (gs: Record<string, unknown>): SaveData => ({
    version: 23,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as unknown as GameState,
  });
  const isU32 = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 2 ** 32;

  it('seeds the generator from the save’s own seed, the same every time', () => {
    const { rng: _drop, ...old } = { ...createInitialState(), seed: 777 };
    const a = migrateSave(v23(old), 23, 24);
    expect(a.version).toBe(24);
    expect(isU32(a.gameState.rng)).toBe(true);
    expect(migrateSave(v23(old), 23, 24).gameState.rng).toBe(a.gameState.rng);
    const { rng: _d2, ...other } = { ...createInitialState(), seed: 778 };
    expect(migrateSave(v23(other), 23, 24).gameState.rng).not.toBe(a.gameState.rng);
  });

  it('keeps a valid generator state and replaces a malformed one', () => {
    expect(migrateSave(v23({ ...createInitialState(), rng: 4321 }), 23, 24).gameState.rng).toBe(4321);
    for (const bad of [-1, 1.5, 'x', null, 2 ** 32]) {
      expect(isU32(migrateSave(v23({ ...createInitialState(), rng: bad }), 23, 24).gameState.rng)).toBe(true);
    }
  });

  it('keeps the rest of the save as it was', () => {
    const gs = createInitialState();
    const { rng: _drop, ...old } = gs;
    const out = migrateSave(v23(old), 23, 24);
    const { rng: _out, ...rest } = out.gameState;
    expect(rest).toEqual(old);
  });
});

describe('v24 → v25: every count is a whole number (Story 3.3, FR34)', () => {
  const v24 = (gs: GameState): SaveData => ({
    version: 24,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs,
  });
  /** A save written while a soft-capped warehouse let fractions of ants mature. */
  const fractional = (): GameState => {
    const gs = createInitialState();
    gs.resources = {
      ...gs.resources,
      eggs: 4, larvae: 47.25, workers: 138.875, food: 16.5, voidCrystals: 2.5, antimatter: 0.4, darkMatter: -3,
    };
    gs.resourceRemainder = { ...gs.resourceRemainder, food: 0.75 };
    gs.eggPipeline = { count: 4, progress: 0.5 };
    gs.larvaPipeline = { count: 47.25, progress: 0.25 };
    gs.combatResources = { chitin: 3.5, silk: 0, venom: 1 };
    gs.combatSoldiers = 2.5;
    gs.entropy = 140;
    return gs;
  };

  it('makes every resource a whole number ≥ 0 and keeps the pipelines in step', () => {
    const out = migrateSave(v24(fractional()), 24, 25);
    expect(out.version).toBe(25);
    const gs = out.gameState;
    for (const [key, value] of Object.entries(gs.resources)) {
      expect(Number.isInteger(value) && value >= 0, `resources.${key} = ${value}`).toBe(true);
    }
    expect(gs.resources.eggs).toBe(gs.eggPipeline.count);
    expect(gs.resources.larvae).toBe(gs.larvaPipeline.count);
    for (const value of [...Object.values(gs.combatResources), gs.combatSoldiers]) expect(Number.isInteger(value)).toBe(true);
  });

  it('never adds what the save did not hold, and carries a credited fraction', () => {
    const before = fractional();
    const gs = migrateSave(v24(structuredClone(before)), 24, 25).gameState;
    const carried = before.resourceRemainder as unknown as Record<string, number>;
    for (const key of Object.keys(before.resources) as (keyof GameState['resources'])[]) {
      const held = Math.max(0, before.resources[key]) + (carried[key] ?? 0);
      expect(gs.resources[key], key).toBeLessThanOrEqual(held);
    }
    // A rate-credited stock keeps its fraction in the carry: nothing is lost.
    expect(gs.resources.food + gs.resourceRemainder.food).toBe(before.resources.food + before.resourceRemainder.food);
    expect(gs.resourceRemainder.food).toBeGreaterThanOrEqual(0);
    expect(gs.resourceRemainder.food).toBeLessThan(1);
  });

  it('keeps entropy a 0–100 meter', () => {
    const gs = migrateSave(v24(fractional()), 24, 25).gameState;
    expect(gs.entropy).toBeGreaterThanOrEqual(0);
    expect(gs.entropy).toBeLessThanOrEqual(100);
  });

  it('keeps a save that was already whole as it was', () => {
    const gs = createInitialState();
    expect(migrateSave(v24(structuredClone(gs)), 24, 25).gameState).toEqual(gs);
  });
});

describe('v25 → v26: the Forage role (Story 3.4, FR3)', () => {
  const v25 = (gs: unknown): SaveData => ({
    version: 25,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as GameState,
  });
  /** A v25 state: the assigned roles had no Forage. */
  const withoutForage = () => {
    const gs = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    const { forage: _drop, ...rest } = gs.workersAssigned as Record<string, number>;
    gs.workersAssigned = { ...rest, gather: 7, dig: 3 };
    return gs;
  };

  it('adds nobody on Forage and keeps every other role', () => {
    const before = withoutForage();
    const out = migrateSave(v25(structuredClone(before)), 25, 26);
    expect(out.version).toBe(26);
    expect(out.gameState.workersAssigned.forage).toBe(0);
    expect(out.gameState.workersAssigned).toMatchObject(before.workersAssigned as object);
  });

  it('keeps a Forage count the save already holds', () => {
    const gs = structuredClone(createInitialState());
    gs.workersAssigned = { ...gs.workersAssigned, forage: 4 };
    expect(migrateSave(v25(structuredClone(gs)), 25, 26).gameState).toEqual(gs);
  });
});

describe('v26 → v27: the next enemy is in the save (Story 4.1, FR12)', () => {
  const v26 = (gs: unknown): SaveData => ({
    version: 26,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as GameState,
  });
  /** A v26 state: no `nextEnemy`; the card peeked the generator instead. */
  const withoutEnemy = (over: Record<string, unknown> = {}) => {
    const { nextEnemy: _drop, ...rest } = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    return { ...rest, ...over };
  };

  it('stores the enemy the card showed: the one the generator would draw next', () => {
    for (const [rng, battlesWon] of [[1, 0], [99, 3], [123_456, 12]]) {
      const out = migrateSave(v26(withoutEnemy({ rng, battlesWon })), 26, 27);
      expect(out.version).toBe(27);
      expect(out.gameState.nextEnemy).toBe(peekEnemy(rng, battlesWon).type);
    }
  });

  it('leaves the generator where it was (nothing is drawn)', () => {
    const out = migrateSave(v26(withoutEnemy({ rng: 77 })), 26, 27);
    expect(out.gameState.rng).toBe(77);
  });

  it('keeps a known next enemy, and replaces an unknown one', () => {
    const kept = migrateSave(v26(withoutEnemy({ nextEnemy: 'wasp' })), 26, 27);
    expect(kept.gameState.nextEnemy).toBe('wasp');
    const fixed = migrateSave(v26(withoutEnemy({ nextEnemy: 'dragon', rng: 5, battlesWon: 1 })), 26, 27);
    expect(fixed.gameState.nextEnemy).toBe(peekEnemy(5, 1).type);
  });

  it('a partial save without a generator state is left for the defaults', () => {
    const out = migrateSave(v26({ phase: 'combat' }), 26, 27);
    expect(out.version).toBe(27);
    expect(out.gameState).toEqual({ phase: 'combat' });
  });
});

describe('v27 → v28: the Colony buildings (Story 4.7, FR19)', () => {
  const v27 = (gs: unknown): SaveData => ({
    version: 27,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as GameState,
  });
  /** A v27 state: the buildings had no Fungus Garden or Tunnels. */
  const withoutColonyBuildings = () => {
    const gs = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    const { fungus_garden: _f, tunnels: _t, ...rest } = gs.buildings as Record<string, unknown>;
    gs.buildings = { ...rest, warehouse: { level: 3 }, walls: { level: 1 } };
    return gs;
  };

  it('adds both at level 0 and keeps every other building', () => {
    const before = withoutColonyBuildings();
    const out = migrateSave(v27(structuredClone(before)), 27, 28);
    expect(out.version).toBe(28);
    expect(out.gameState.buildings.fungus_garden).toEqual({ level: 0 });
    expect(out.gameState.buildings.tunnels).toEqual({ level: 0 });
    expect(out.gameState.buildings).toMatchObject(before.buildings as object);
  });

  it('keeps levels the save already holds', () => {
    const gs = structuredClone(createInitialState());
    gs.buildings = { ...gs.buildings, fungus_garden: { level: 2 }, tunnels: { level: 1 } };
    expect(migrateSave(v27(structuredClone(gs)), 27, 28).gameState).toEqual(gs);
  });

  it('a partial save without buildings is left for the defaults', () => {
    const out = migrateSave(v27({ phase: 'colony' }), 27, 28);
    expect(out.version).toBe(28);
    expect(out.gameState).toEqual({ phase: 'colony' });
  });
});

describe('v28 → v29: the Midden (Story 4.8, FR19)', () => {
  const v28 = (gs: unknown): SaveData => ({
    version: 28,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as GameState,
  });
  /** A v28 state: its buildings have no Midden. */
  const withoutMidden = () => {
    const s = structuredClone(createInitialState()) as unknown as { buildings: Record<string, unknown> };
    const { midden: _drop, ...buildings } = s.buildings;
    return { ...s, buildings: { ...buildings, walls: { level: 4 } } };
  };

  it('adds an unbuilt Midden and keeps every other building', () => {
    const before = withoutMidden();
    const out = migrateSave(v28(structuredClone(before)), 28, 29);
    expect(out.version).toBe(29);
    expect(out.gameState.buildings.midden).toEqual({ level: 0 });
    expect(out.gameState.buildings).toMatchObject(before.buildings as object);
  });

  it('keeps a Midden already there', () => {
    const s = withoutMidden();
    const out = migrateSave(v28({ ...s, buildings: { ...s.buildings, midden: { level: 2 } } }), 28, 29);
    expect(out.gameState.buildings.midden.level).toBe(2);
  });

  it('a partial save without buildings is left for the defaults', () => {
    const out = migrateSave(v28({ phase: 'combat' }), 28, 29);
    expect(out.version).toBe(29);
    expect(out.gameState).toEqual({ phase: 'combat' });
  });
});

describe('v29 → v30: automation targets are in the save (Story 4.10, FR16)', () => {
  const v29 = (gs: unknown): SaveData => ({
    version: 29,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: gs as GameState,
  });
  /** A v29 state: no `automation`. */
  const withoutAutomation = (over: Record<string, unknown> = {}) => {
    const { automation: _drop, ...rest } = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    return { ...rest, ...over };
  };

  it('adds every row, off, at its default target', () => {
    const out = migrateSave(v29(withoutAutomation()), 29, 30);
    expect(out.version).toBe(30);
    const a = out.gameState.automation;
    for (const verb of ['lay', 'train', 'scout', 'warrior'] as const) {
      expect(a.targets[verb].on, verb).toBe(false);
      expect(a.targets[verb]).toEqual(createInitialState().automation.targets[verb]);
      expect(Number.isInteger(a.performed[verb]) && a.performed[verb] >= 0, verb).toBe(true);
    }
  });

  it('the taps the save already counted count as laying done by hand', () => {
    const s = createInitialState();
    const out = migrateSave(v29(withoutAutomation({ stats: { ...s.stats, totalClicks: 37 } })), 29, 30);
    expect(out.gameState.automation.performed.lay).toBe(37);
    const odd = migrateSave(v29(withoutAutomation({ stats: { ...s.stats, totalClicks: -4.5 } })), 29, 30);
    expect(odd.gameState.automation.performed.lay).toBe(0);
  });

  it('keeps an automation block the save already holds', () => {
    const s = createInitialState();
    const held = { ...s.automation, performed: { ...s.automation.performed, train: 12 } };
    const out = migrateSave(v29(withoutAutomation({ automation: held })), 29, 30);
    expect(out.gameState.automation).toEqual(held);
  });

  it('a partial save without stats is left for the defaults', () => {
    const out = migrateSave(v29({ phase: 'colony' }), 29, 30);
    expect(out.version).toBe(30);
    expect(out.gameState).toEqual({ phase: 'colony' });
  });
});
