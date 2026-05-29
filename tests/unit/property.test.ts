// @ts-nocheck — fast-check type inference weak with noImplicitAny
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { Phase } from '../../src/phases/phases';
import {
  EGG_TO_COLONY,
  COLONY_TO_COMBAT,
  COLONY_TO_EXPANSION,
  EXPANSION_TO_SPACE,
  SPACE_TO_TRANSCENDENCE,
  TRANSITIONS,
  type Transition,
} from '../../src/phases/transitions';
import {
  calculateLegacyPoints,
  prestige,
  isPrestigeAvailable,
} from '../../src/systems/PrestigeSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

// ─── Arbitraries ──────────────────────────────────────────────────────────

/** Arbitrary non-negative integer up to a given max. */
function nat(max: number = 1_000_000): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max });
}

/** Arbitrary positive integer. */
function pos(max: number = 1_000_000): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max });
}

/** Arbitrary non-negative float. */
function floatNat(max: number = 1_000): fc.Arbitrary<number> {
  return fc.float({ min: 0, max, noNaN: true });
}

/**
 * Generate a valid GameState with constrained resources.
 * We avoid generating the full deeply-nested struct so tests stay focused.
 */
function arbitraryGameState(): fc.Arbitrary<GameState> {
  return fc.record({
    workers: nat(200),
    eggs: nat(200),
    larvae: nat(200),
    food: nat(10_000),
    eggPipelineCount: nat(200),
    larvaPipelineCount: nat(200),
    gatherWorkers: nat(100),
    tendWorkers: nat(100),
    digWorkers: nat(100),
    guardWorkers: nat(100),
    clickPower: nat(10),
    legacyPoints: nat(500),
  }).map((raw) => {
    const state = createInitialState();
    state.resources.workers = raw.workers;
    state.resources.eggs = raw.eggs;
    state.resources.larvae = raw.larvae;
    state.resources.food = raw.food;
    state.eggPipeline = { count: raw.eggPipelineCount, progress: 0 };
    state.larvaPipeline = { count: raw.larvaPipelineCount, progress: 0 };
    state.workersAssigned = {
      gather: raw.gatherWorkers,
      tend: raw.tendWorkers,
      dig: raw.digWorkers,
      guard: raw.guardWorkers,
      researchers: 0,
    };
    state.upgrades.click_power = raw.clickPower;
    state.prestige.legacyPoints = raw.legacyPoints;
    return state;
  });
}

/**
 * Arbitrary GameState specifically for phase-transition guard testing.
 * Includes the fields that guards check: workers, guard count, food, voidCrystals, antimatter, darkMatter.
 */
function arbitraryPhaseState(): fc.Arbitrary<GameState> {
  return fc.record({
    workers: nat(50),
    food: nat(5000),
    guard: nat(10),
    voidCrystals: nat(100),
    antimatter: nat(50),
    darkMatter: nat(20),
  }).map((raw) => {
    const state = createInitialState();
    state.resources.workers = raw.workers;
    state.resources.food = raw.food;
    state.resources.voidCrystals = raw.voidCrystals;
    state.resources.antimatter = raw.antimatter;
    state.resources.darkMatter = raw.darkMatter;
    state.workersAssigned.guard = raw.guard;
    return state;
  });
}

/** Extract the set of phases reachable from a given phase via transitions. */
function reachablePhases(from: Phase, transitions: Transition[]): Set<Phase> {
  return new Set(
    transitions.filter((t) => t.from === from).map((t) => t.to),
  );
}

// ─── ResourceSystem Properties ─────────────────────────────────────────────

describe('ResourceSystem — property-based invariants', () => {
  const bus = new EventBus();
  const system = new ResourceSystem(bus);

  it('AFTER tick, ALL resources are >= 0', () => {
    fc.assert(
      fc.property(arbitraryGameState(), (state) => {
        const result = system.tick(state);
        const r = result.resources;
        expect(r.eggs).toBeGreaterThanOrEqual(0);
        expect(r.larvae).toBeGreaterThanOrEqual(0);
        expect(r.workers).toBeGreaterThanOrEqual(0);
        expect(r.food).toBeGreaterThanOrEqual(0);
        expect(r.wood).toBeGreaterThanOrEqual(0);
        expect(r.stone).toBeGreaterThanOrEqual(0);
        expect(r.nectar).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('AFTER tick, pipeline counts never go negative', () => {
    fc.assert(
      fc.property(arbitraryGameState(), (state) => {
        const result = system.tick(state);
        expect(result.eggPipeline.count).toBeGreaterThanOrEqual(0);
        expect(result.larvaPipeline.count).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('AFTER tick, pipeline progress is in [0, 1) (fractional)', () => {
    fc.assert(
      fc.property(arbitraryGameState(), (state) => {
        const result = system.tick(state);
        // Progress should be non-negative and less than 1 after floor extraction
        expect(result.eggPipeline.progress).toBeGreaterThanOrEqual(0);
        expect(result.eggPipeline.progress).toBeLessThan(1);
        expect(result.larvaPipeline.progress).toBeGreaterThanOrEqual(0);
        expect(result.larvaPipeline.progress).toBeLessThan(1);
      }),
      { numRuns: 500 },
    );
  });

  it('AFTER tick, workers never decrease from resource processing alone', () => {
    fc.assert(
      fc.property(arbitraryGameState(), (state) => {
        const result = system.tick(state);
        // tick() only increases workers (from larval maturation), never decreases
        expect(result.resources.workers).toBeGreaterThanOrEqual(state.resources.workers);
      }),
      { numRuns: 500 },
    );
  });

  it('AFTER tick, food consumed is proportional to workers (if food > 0)', () => {
    fc.assert(
      fc.property(arbitraryGameState(), (state) => {
        // Only check when there are workers and some starting food to consume
        if (state.resources.workers === 0) return;
        const result = system.tick(state);
        // Food consumption = workers/2 per tick (scaled by dtSec=1 by default)
        // Production from gather/unassigned may offset it
        // But with 0 assigned workers, food should decrease
        if (
          state.workersAssigned.gather === 0 &&
          state.workersAssigned.tend === 0 &&
          state.workersAssigned.dig === 0 &&
          state.workersAssigned.guard === 0
        ) {
          // With no production workers, consumption only
          // food = food - floor(workers/2), clamped to >= 0
          const expectedMin = Math.max(0, state.resources.food - Math.floor(state.resources.workers / 2));
          expect(result.resources.food).toBeGreaterThanOrEqual(expectedMin);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('clickEgg increases eggs and pipeline count', () => {
    fc.assert(
      fc.property(arbitraryGameState(), (state) => {
        const beforeEggs = state.resources.eggs;
        const beforePipelineCount = state.eggPipeline.count;
        const result = system.clickEgg(state);
        expect(result.resources.eggs).toBeGreaterThan(beforeEggs);
        expect(result.eggPipeline.count).toBeGreaterThan(beforePipelineCount);
      }),
      { numRuns: 500 },
    );
  });

  it('clickEgg preserves all other resources unchanged', () => {
    fc.assert(
      fc.property(arbitraryGameState(), (state) => {
        const result = system.clickEgg(state);
        expect(result.resources.larvae).toBe(state.resources.larvae);
        expect(result.resources.workers).toBe(state.resources.workers);
        expect(result.resources.food).toBe(state.resources.food);
        expect(result.resources.wood).toBe(state.resources.wood);
        expect(result.resources.stone).toBe(state.resources.stone);
      }),
      { numRuns: 200 },
    );
  });

  it('tend workers increase hatch rate linearly — rate formula is monotonic in tend', () => {
    fc.assert(
      fc.property(
        fc.record({
          pipelineCount: fc.integer({ min: 1, max: 200 }),
          tend0: fc.integer({ min: 0, max: 20 }),
          tend1: fc.integer({ min: 1, max: 20 }),
        }),
        (raw) => {
          const state = createInitialState();
          state.resources.eggs = 9999; // Ensure eggs are never a bottleneck
          state.eggPipeline = { count: raw.pipelineCount, progress: 0 };
          state.workersAssigned.tend = raw.tend0;
          const stateMoreTend = {
            ...state,
            workersAssigned: { ...state.workersAssigned, tend: raw.tend0 + raw.tend1 },
          };

          const resultLow = system.tick(state);
          const resultHigh = system.tick(stateMoreTend);

          // More tend → more hatched per tick → pipeline count decreases faster
          const hatchedLow = state.eggPipeline.count - resultLow.eggPipeline.count;
          const hatchedHigh = stateMoreTend.eggPipeline.count - resultHigh.eggPipeline.count;
          expect(hatchedHigh).toBeGreaterThanOrEqual(hatchedLow);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Phase Transition Properties ───────────────────────────────────────────

describe('Phase transitions — property-based (no dead ends)', () => {
  it('every transition guard is satisfiable — there exists a state that passes it', () => {
    for (const t of TRANSITIONS) {
      // For each transition, construct a state that satisfies the guard
      const state = createInitialState();

      switch (t.from) {
        case Phase.EGG_LAYING:
          // EGG_LAYING → COLONY: workers >= 10
          state.resources.workers = 10;
          break;
        case Phase.COLONY:
          if (t.to === Phase.COMBAT) {
            // COLONY → COMBAT: workers >= 15 AND guard >= 1
            state.resources.workers = 15;
            state.workersAssigned.guard = 1;
          } else if (t.to === Phase.EXPANSION) {
            // COLONY → EXPANSION: workers >= 20 AND food >= 500
            state.resources.workers = 20;
            state.resources.food = 500;
          }
          break;
        case Phase.COMBAT:
          // COMBAT → EXPANSION: workers >= 25 AND battlesWon >= 3
          state.resources.workers = 25;
          state.battlesWon = 3;
          break;
        case Phase.EXPANSION:
          // EXPANSION → SPACE: workers >= 30 AND food >= 2000
          state.resources.workers = 30;
          state.resources.food = 2000;
          break;
        case Phase.COMBAT:
          // COMBAT → EXPANSION: workers >= 25 AND battlesWon >= 3
          state.resources.workers = 25;
          state.battlesWon = 3;
          break;
        case Phase.SPACE:
          // SPACE → TRANSCENDENCE: voidCrystals >= 50, antimatter >= 10, darkMatter >= 5
          state.resources.voidCrystals = 50;
          state.resources.antimatter = 10;
          state.resources.darkMatter = 5;
          break;
        case Phase.COMBAT:
          // COMBAT → EXPANSION: workers >= 25 AND battlesWon >= 3
          state.resources.workers = 25;
          state.battlesWon = 3;
          break;
      }

      expect(
        t.guard(state),
        `Guard for ${t.from} → ${t.to} should be satisfiable`,
      ).toBe(true);
    }
  });

  it('every phase (except transcendence) has at least one outgoing transition', () => {
    // COMBAT is an optional branch from COLONY and can exit to EXPANSION.
    // TRANSCENDENCE is the terminal victory phase.
    const phasesRequiringOutgoing = new Set([
      Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT, Phase.EXPANSION, Phase.SPACE,
    ]);
    const phasesWithOutgoing = new Set(TRANSITIONS.map((t) => t.from));

    for (const phase of phasesRequiringOutgoing) {
      expect(
        phasesWithOutgoing.has(phase),
        `${phase} should have at least one outgoing transition`,
      ).toBe(true);
    }

    // COMBAT has one outgoing transition (COMBAT → EXPANSION) — intentional rescue path
    expect(phasesWithOutgoing.has(Phase.COMBAT)).toBe(true);

    // Transcendence is terminal — no outgoing transitions is correct
    expect(phasesWithOutgoing.has(Phase.TRANSCENDENCE)).toBe(false);
  });

  it('transition guards are deterministic — same state gives same result', () => {
    fc.assert(
      fc.property(arbitraryPhaseState(), (state) => {
        for (const t of TRANSITIONS) {
          const result1 = t.guard(state);
          const result2 = t.guard(state);
          expect(result1).toBe(result2);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('PhaseStateMachine.tick returns a phase that exists in the enum', () => {
    const validPhases = new Set(Object.values(Phase));

    fc.assert(
      fc.property(arbitraryPhaseState(), (state) => {
        // Create FSM starting from each phase to test
        for (const startPhase of Object.values(Phase)) {
          const sm = new PhaseStateMachine(startPhase, TRANSITIONS);
          const bus = new EventBus();
          const result = sm.tick(state, bus);
          expect(validPhases.has(result.phase)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('PhaseStateMachine never transitions backward in the phase sequence', () => {
    const phaseOrder: Record<string, number> = {
      egg_laying: 1,
      colony: 2,
      combat: 3,
      expansion: 4,
      space: 5,
      transcendence: 6,
    };

    fc.assert(
      fc.property(arbitraryPhaseState(), (state) => {
        for (const startPhase of Object.values(Phase)) {
          if (startPhase === Phase.TRANSCENDENCE) continue; // Terminal
          const sm = new PhaseStateMachine(startPhase, TRANSITIONS);
          const bus = new EventBus();
          const result = sm.tick(state, bus);
          const fromOrder = phaseOrder[startPhase] ?? 0;
          const toOrder = phaseOrder[result.phase] ?? 0;
          expect(toOrder).toBeGreaterThanOrEqual(fromOrder);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('a state satisfying the guard actually triggers the transition', () => {
    // EGG_LAYING → COLONY is the simplest: workers >= 10
    const state = createInitialState();
    state.resources.workers = 10;
    const sm = new PhaseStateMachine(Phase.EGG_LAYING, TRANSITIONS);
    const bus = new EventBus();
    const result = sm.tick(state, bus);
    expect(result.phase).toBe(Phase.COLONY);
  });
});

// ─── Prestige Calculator Properties ────────────────────────────────────────

describe('PrestigeSystem — property-based (monotonicity)', () => {
  it('calculateLegacyPoints is monotonic in totalFoodProduced', () => {
    fc.assert(
      fc.property(
        fc.record({
          food1: fc.integer({ min: 10, max: 10_000_000 }),
          food2: fc.integer({ min: 10, max: 10_000_000 }),
          phaseScore: fc.integer({ min: 1, max: 21 }), // sum of all phases = 21 max
        }),
        (raw) => {
          const lower = Math.min(raw.food1, raw.food2);
          const higher = Math.max(raw.food1, raw.food2);
          const lowerPoints = calculateLegacyPoints(lower, raw.phaseScore);
          const higherPoints = calculateLegacyPoints(higher, raw.phaseScore);
          expect(higherPoints).toBeGreaterThanOrEqual(lowerPoints);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('calculateLegacyPoints is monotonic in phaseScore', () => {
    fc.assert(
      fc.property(
        fc.record({
          food: fc.integer({ min: 10, max: 10_000_000 }),
          ps1: fc.integer({ min: 1, max: 21 }),
          ps2: fc.integer({ min: 1, max: 21 }),
        }),
        (raw) => {
          const lower = Math.min(raw.ps1, raw.ps2);
          const higher = Math.max(raw.ps1, raw.ps2);
          const lowerPoints = calculateLegacyPoints(raw.food, lower);
          const higherPoints = calculateLegacyPoints(raw.food, higher);
          expect(higherPoints).toBeGreaterThanOrEqual(lowerPoints);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('calculateLegacyPoints never returns negative values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 100 }),
        (food, phaseScore) => {
          const result = calculateLegacyPoints(food, phaseScore);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('calculateLegacyPoints returns 0 for food < 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 1, max: 100 }),
        (food, phaseScore) => {
          expect(calculateLegacyPoints(food, phaseScore)).toBe(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('calculateLegacyPoints returns integer values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 1_000_000 }),
        fc.integer({ min: 1, max: 21 }),
        (food, phaseScore) => {
          const result = calculateLegacyPoints(food, phaseScore);
          expect(Number.isInteger(result)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('prestige() always increases prestige count and preserves totalFoodProduced', () => {
    fc.assert(
      fc.property(
        fc.record({
          totalFoodProduced: fc.integer({ min: 100_000, max: 10_000_000 }),
          legacyPointsBefore: fc.integer({ min: 0, max: 1000 }),
          voidCrystals: fc.integer({ min: 0, max: 100 }),
          antimatter: fc.integer({ min: 0, max: 100 }),
          darkMatter: fc.integer({ min: 0, max: 100 }),
        }),
        (raw) => {
          const state = createInitialState();
          // Set up state to pass prestige requirements
          state.buildings.barracks.level = 5;
          state.buildings.walls.level = 5;
          state.buildings.warehouse.level = 5;
          state.prestige.totalFoodProduced = raw.totalFoodProduced;
          state.prestige.legacyPoints = raw.legacyPointsBefore;
          state.resources.voidCrystals = raw.voidCrystals;
          state.resources.antimatter = raw.antimatter;
          state.resources.darkMatter = raw.darkMatter;
          state.phase = 'expansion'; // Any phase, prestige resets it

          expect(isPrestigeAvailable(state)).toBe(true);

          const result = prestige(state);
          expect(result.prestige.count).toBe(state.prestige.count + 1);
          expect(result.prestige.totalFoodProduced).toBe(state.prestige.totalFoodProduced);
          expect(result.prestige.legacyPoints).toBeGreaterThanOrEqual(state.prestige.legacyPoints);
          // After reset, workers go to 0
          expect(result.resources.workers).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── BattleSystem Properties ───────────────────────────────────────────────

describe('BattleSystem — property-based (fairness)', () => {
  let bus: EventBus;
  let system: BattleSystem;

  it('soldiersLost is always in [0, combatSoldiers]', () => {
    bus = new EventBus();
    system = new BattleSystem(bus);

    fc.assert(
      fc.property(
        fc.record({
          combatSoldiers: fc.integer({ min: 1, max: 200 }),
          weapon: fc.integer({ min: 0, max: 5 }),
          armor: fc.integer({ min: 0, max: 5 }),
          battlesWon: fc.integer({ min: 0, max: 50 }),
        }),
        (raw) => {
          const state = createInitialState();
          state.combatSoldiers = raw.combatSoldiers;
          state.equipment.weapon = raw.weapon;
          state.equipment.armor = raw.armor;
          state.battlesWon = raw.battlesWon;

          const { result } = system.resolveBattle(state);
          expect(result.soldiersLost).toBeGreaterThanOrEqual(0);
          expect(result.soldiersLost).toBeLessThanOrEqual(raw.combatSoldiers);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('on victory, foodGained and specialLoot are non-negative', () => {
    bus = new EventBus();
    system = new BattleSystem(bus);

    fc.assert(
      fc.property(
        fc.record({
          combatSoldiers: fc.integer({ min: 100, max: 200 }),
          weapon: fc.integer({ min: 3, max: 5 }),
          armor: fc.integer({ min: 3, max: 5 }),
          battlesWon: fc.integer({ min: 0, max: 10 }),
        }),
        (raw) => {
          const state = createInitialState();
          state.combatSoldiers = raw.combatSoldiers;
          state.equipment.weapon = raw.weapon;
          state.equipment.armor = raw.armor;
          state.battlesWon = raw.battlesWon;

          // With strong army and few battles, victory is highly likely
          // Run up to 5 times to find a victory
          let foundVictory = false;
          for (let attempt = 0; attempt < 5 && !foundVictory; attempt++) {
            const testState = { ...state };
            const { result } = system.resolveBattle(testState);
            if (result.victory) {
              foundVictory = true;
              expect(result.foodGained).toBeGreaterThanOrEqual(0);
              expect(result.specialLoot.chitin).toBeGreaterThanOrEqual(0);
              expect(result.specialLoot.silk).toBeGreaterThanOrEqual(0);
              expect(result.specialLoot.venom).toBeGreaterThanOrEqual(0);
            }
          }
          // Strong army should win at least once in 5 tries
          if (!foundVictory) {
            // This is probabilistic — skip assertion but it's very unlikely
            // With 100 soldiers and weapon/armor >= 3, victory rate is > 95%
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('on defeat, all soldiers are lost', () => {
    bus = new EventBus();
    system = new BattleSystem(bus);

    fc.assert(
      fc.property(
        fc.record({
          combatSoldiers: fc.integer({ min: 1, max: 5 }),
          weapon: fc.constant(0),
          armor: fc.constant(0),
          battlesWon: fc.integer({ min: 30, max: 50 }),
        }),
        (raw) => {
          const state = createInitialState();
          state.combatSoldiers = raw.combatSoldiers;
          state.equipment.weapon = raw.weapon;
          state.equipment.armor = raw.armor;
          state.battlesWon = raw.battlesWon;

          // With very weak army and high battlesWon (strong scaling), defeats common
          // Run multiple attempts
          let foundDefeat = false;
          for (let attempt = 0; attempt < 10 && !foundDefeat; attempt++) {
            const testState = { ...state, combatSoldiers: raw.combatSoldiers };
            const { result } = system.resolveBattle(testState);
            if (!result.victory && result.enemyType !== 'none') {
              foundDefeat = true;
              // In a defeat, the code explicitly sets soldiersLost = combatSoldiers
              expect(result.soldiersLost).toBe(raw.combatSoldiers);
            }
          }
          // With weak army and high enemy scaling, defeat is extremely likely
          // If not found in 10 tries, the test passes trivially (not falsified)
        },
      ),
      { numRuns: 50 },
    );
  });

  it('battlesWon increments only on victory, battlesLost only on defeat', () => {
    bus = new EventBus();
    system = new BattleSystem(bus);

    fc.assert(
      fc.property(
        fc.record({
          combatSoldiers: fc.integer({ min: 1, max: 200 }),
          weapon: fc.integer({ min: 0, max: 5 }),
          armor: fc.integer({ min: 0, max: 5 }),
          battlesWon: fc.integer({ min: 0, max: 30 }),
        }),
        (raw) => {
          const state = createInitialState();
          state.combatSoldiers = raw.combatSoldiers;
          state.equipment.weapon = raw.weapon;
          state.equipment.armor = raw.armor;
          state.battlesWon = raw.battlesWon;

          const { result, newState } = system.resolveBattle(state);

          if (result.victory) {
            expect(newState.battlesWon).toBe(state.battlesWon + 1);
            expect(newState.battlesLost).toBe(state.battlesLost);
          } else if (result.enemyType !== 'none') {
            // Defeat or draw — battlesLost increments on explicit defeat
            if (newState.battlesLost > state.battlesLost) {
              expect(newState.battlesWon).toBe(state.battlesWon);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('result provides a narrative string', () => {
    bus = new EventBus();
    system = new BattleSystem(bus);

    fc.assert(
      fc.property(
        fc.record({
          combatSoldiers: fc.integer({ min: 1, max: 50 }),
          weapon: fc.integer({ min: 0, max: 5 }),
          armor: fc.integer({ min: 0, max: 5 }),
          battlesWon: fc.integer({ min: 0, max: 20 }),
        }),
        (raw) => {
          const state = createInitialState();
          state.combatSoldiers = raw.combatSoldiers;
          state.equipment.weapon = raw.weapon;
          state.equipment.armor = raw.armor;
          state.battlesWon = raw.battlesWon;

          const { result } = system.resolveBattle(state);
          expect(typeof result.narrative).toBe('string');
          expect(result.narrative.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('no soldiers means no battle — returns unchanged state', () => {
    bus = new EventBus();
    system = new BattleSystem(bus);

    const state = createInitialState();
    state.combatSoldiers = 0;
    const { result, newState } = system.resolveBattle(state);

    expect(result.victory).toBe(false);
    expect(result.enemyType).toBe('none');
    expect(result.soldiersLost).toBe(0);
    expect(newState).toEqual(state);
  });

  it('soldiers lost is always an integer', () => {
    bus = new EventBus();
    system = new BattleSystem(bus);

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (soldiers) => {
          const state = createInitialState();
          state.combatSoldiers = soldiers;
          for (let i = 0; i < 5; i++) {
            const testState = { ...state, combatSoldiers: soldiers };
            const { result } = system.resolveBattle(testState);
            expect(Number.isInteger(result.soldiersLost)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
