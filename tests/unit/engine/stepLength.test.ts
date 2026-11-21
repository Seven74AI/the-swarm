import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createEmptyMap, createInitialState, TileType, type GameState } from '../../../src/state/GameState';
import { processTick } from '../../../src/engine/processTick';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { ResourceSystem, computeResourceRates } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { getConversionDefs, getConversionRate } from '../../../src/systems/ResourceConversionSystem';
import { tickProbeSwarm, PROBE_SWARM_THRESHOLD, MAX_ACTIVE_EXPLORATIONS } from '../../../src/systems/ExplorationSystem';
import { Phase } from '../../../src/phases/phases';
import { getAutoLayRate } from '../../../src/engine/AutoProductionLoop';
import { TICK_MS } from '../../../src/data/constants';
import { pipelineTolerance, rateTolerance, WHOLE_UNIT_CARRY } from '../helpers/stepTolerance';

/**
 * Story 2.5 (FR2, AR4): every system gives the same result for any step length.
 *
 * Each property draws a random seeded state and runs it through `processTick`
 * twice: `n` steps of one tick (50 ms) and one step of `n × 50 ms`
 * (n up to 200, so up to the 10 s macro-step that catch-up will use, Story 2.6).
 *
 * Exact, for both runs (integer invariants):
 *  - every value in `state.resources` is an integer ≥ 0;
 *  - no pipeline loses items: eggs = eggPipeline.count, larvae = larvaPipeline.count,
 *    eggs + larvae + workers grows by exactly the eggs laid, and
 *    combatSoldiers + soldierPipeline.count never changes in a tick.
 *
 * Within a tolerance (rates). The single step is the exact answer for the
 * rates at its start; the fine run differs only where the state that sets a
 * rate changes inside the window. The tolerance is that change, bounded:
 *  - Pipelines (`pipelineTolerance`, in tests/unit/helpers/stepTolerance.ts): each stage carries less than one item of
 *    fractional progress (1 item per stage), and a fine run hatches from whole
 *    items while the single step uses the continuous solution, which differs by
 *    less than one item per stage at any moment: at most `k × T` items, where
 *    `k` is the stage's rate constant (per second) and `T` the window.
 *    Rooms dug inside the window open to waiting larvae from the single step's
 *    start, while the fine run's larvae wait for each room: up to the rooms dug.
 *  - Conversions: a run rate (and the inputs paying for runs) set by state that
 *    changes in the window is held by the rate tolerance below, per stage.
 *    Eggs laid inside the window (auto-production) start hatching in the fine
 *    run only: at most `inflow × T × k × T` more items, and laying carries
 *    its own fraction of an egg (one more item).
 *  - Accumulated amounts (`rateTolerance`): food, wood, stone and nectar are
 *    credited at the rate of the step's start. Over the window the fine run's
 *    rate moves between its minimum and maximum, so the totals differ by at
 *    most `(max − min) × T`, plus one whole unit for flooring.
 */

const TICK_SEC = TICK_MS / 1000;

/** A seeded generator for the random parts (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const MAX_TICKS = 200;
/** Fixed seed: the property tests are reproducible on every run (AC: seeded). */
const SEED = 20_5;
const RUNS = 100;

function systems() {
  const bus = new EventBus();
  return {
    resources: new ResourceSystem(bus),
    soldiers: new SoldierSystem(bus),
    map: new MapSystem(),
    territory: new TerritorySystem(),
  };
}

function step(state: GameState, dtSec: number): GameState {
  const s = systems();
  return processTick(state, s.resources, s.soldiers, s.map, s.territory, new EventQueue(), dtSec);
}

/** `n` one-tick steps; `onStep` sees every intermediate state. */
function fine(state: GameState, n: number, onStep?: (s: GameState) => void): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = step(s, TICK_SEC);
    onStep?.(s);
  }
  return s;
}

function coarse(state: GameState, n: number): GameState {
  return step(state, (n * TICK_MS) / 1000);
}

// ─── Random states ─────────────────────────────────────────────────────────

const PHASES = [Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT, Phase.EXPANSION, Phase.SPACE];
const PRESTIGE_IDS = ['egg_laying_bonus', 'hatching_bonus', 'food_bonus', 'soldier_training_bonus', 'worker_efficiency_bonus'];

const arbState: fc.Arbitrary<GameState> = fc
  .record({
    phase: fc.constantFrom(...PHASES),
    workers: fc.integer({ min: 0, max: 300 }),
    headroom: fc.integer({ min: -50, max: 300 }),
    shares: fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 5, maxLength: 5 }),
    eggs: fc.integer({ min: 0, max: 600 }),
    larvae: fc.integer({ min: 0, max: 600 }),
    eggProgress: fc.double({ min: 0, max: 0.999, noNaN: true }),
    larvaProgress: fc.double({ min: 0, max: 0.999, noNaN: true }),
    food: fc.integer({ min: 0, max: 5_000 }),
    training: fc.integer({ min: 0, max: 120 }),
    combatSoldiers: fc.integer({ min: 0, max: 50 }),
    prestige: fc.subarray(PRESTIGE_IDS),
    autoEggLayer: fc.boolean(),
    autoEggs: fc.boolean(),
    nursery: fc.integer({ min: 0, max: 3 }),
    forest: fc.integer({ min: 0, max: 2 }),
    mountain: fc.integer({ min: 0, max: 2 }),
    meadow: fc.integer({ min: 0, max: 2 }),
    voidSynthesis: fc.boolean(),
    researchers: fc.integer({ min: 0, max: 80 }),
    stone: fc.integer({ min: 0, max: 400 }),
    nectar: fc.integer({ min: 0, max: 200 }),
    antimatter: fc.boolean(),
    particleLab: fc.integer({ min: 0, max: 7 }),
    voidCrystals: fc.integer({ min: 0, max: 60 }),
    missionTicks: fc.option(fc.integer({ min: 1, max: 400 }), { nil: null }),
  })
  .map((r) => {
    const s = createInitialState();
    s.phase = r.phase;
    s.resources.workers = r.workers;
    s.resources.nestCapacity = Math.max(0, r.workers + r.headroom);
    // Assignments never exceed the workers on hand.
    const total = r.shares.reduce((a, b) => a + b, 0) || 1;
    const part = (i: number) => Math.floor((r.workers * r.shares[i]) / total / 1.25);
    s.workersAssigned = { gather: part(0), tend: part(1), dig: part(2), guard: part(3), researchers: 0 };
    s.resources.eggs = r.eggs;
    s.eggPipeline = { count: r.eggs, progress: r.eggProgress };
    s.resources.larvae = r.larvae;
    s.larvaPipeline = { count: r.larvae, progress: r.larvaProgress };
    s.resources.food = r.food;
    s.soldierPipeline = { count: r.training, progress: 0 };
    s.combatSoldiers = r.combatSoldiers;
    s.prestigeTree.purchased = [...r.prestige, ...(r.autoEggLayer ? ['auto_egg_laying'] : [])];
    if (r.autoEggs) {
      s.autoProduction.enabled = true;
      s.autoProduction.researches = { basic_incubation: true };
      s.autoProduction.buildings.nursery = r.nursery;
    }
    // A discovered map is never regenerated; claim a few resource tiles.
    const tiles = createEmptyMap();
    tiles[0] = { ...tiles[0], discovered: true };
    let i = 1;
    const claim = (type: TileType, count: number) => {
      for (let c = 0; c < count; c++, i++) tiles[i] = { ...tiles[i], type, discovered: true, claimed: true };
    };
    claim(TileType.FOREST, r.forest);
    claim(TileType.MOUNTAIN, r.mountain);
    claim(TileType.MEADOW, r.meadow);
    s.mapTiles = tiles;
    if (r.voidSynthesis) {
      s.research.projects.voidCrystalSynthesis = { status: 'done' };
      s.workersAssigned.researchers = r.researchers;
      s.resources.stone = r.stone;
      s.resources.nectar = r.nectar;
    }
    if (r.antimatter) {
      s.research.projects.antimatterContainment = { status: 'done' };
      s.conversions.particleLab = r.particleLab;
      s.resources.voidCrystals = r.voidCrystals;
    }
    if (r.missionTicks !== null) {
      s.spaceships = [{
        id: 'ship-1', type: 'scout_ship', level: 1, fuel: 0, maxFuel: 100, status: 'exploring',
        destinationName: 'Kepler', missionTicksRemaining: r.missionTicks,
      }];
    }
    return s;
  });

const arbTicks = fc.integer({ min: 1, max: MAX_TICKS });

// ─── Invariants and tolerances ─────────────────────────────────────────────

function expectIntegerInvariants(before: GameState, after: GameState, where: string): void {
  for (const [key, value] of Object.entries(after.resources)) {
    expect(Number.isInteger(value), `${where}: resources.${key} = ${value} is an integer`).toBe(true);
    expect(value, `${where}: resources.${key} >= 0`).toBeGreaterThanOrEqual(0);
  }
  expect(after.resources.eggs, `${where}: every egg is in the egg pipeline`).toBe(after.eggPipeline.count);
  expect(after.resources.larvae, `${where}: every larva is in the larva pipeline`).toBe(after.larvaPipeline.count);
  const brood = (s: GameState) => s.resources.eggs + s.resources.larvae + s.resources.workers;
  const laid = after.stats.totalEggsLaid - before.stats.totalEggsLaid;
  expect(brood(after), `${where}: eggs + larvae + workers grow only by the eggs laid`).toBe(brood(before) + laid);
  const army = (s: GameState) => s.combatSoldiers + s.soldierPipeline.count;
  expect(army(after), `${where}: no soldier is lost in training`).toBe(army(before));
}

/** The largest rate constant (per second) of each pipeline stage in `s`, from its rate at count 1. */
function stageRates(s: GameState): { hatch: number; mature: number; train: number; inflow: number } {
  // Measured, not hard-coded: one item in a stage, one tick, no carried progress.
  const probe = (patch: (x: GameState) => void) => {
    const x = structuredClone(s);
    x.eggPipeline = { count: 0, progress: 0 };
    x.larvaPipeline = { count: 0, progress: 0 };
    x.soldierPipeline = { count: 0, progress: 0 };
    x.autoProduction = { ...x.autoProduction, enabled: false };
    x.prestigeTree = { purchased: x.prestigeTree.purchased.filter((id) => id !== 'auto_egg_laying') };
    patch(x);
    return x;
  };
  const after = (x: GameState) => step(x, TICK_SEC);
  const hatch = after(probe((x) => { x.resources.eggs = 1_000_000; x.eggPipeline.count = 1_000_000; })).resources.larvae / 1_000_000 / TICK_SEC;
  const mature = after(probe((x) => { x.resources.larvae = 1_000_000; x.larvaPipeline.count = 1_000_000; x.resources.nestCapacity = 10_000_000; })).resources.workers;
  const matureRate = (mature - s.resources.workers) / 1_000_000 / TICK_SEC;
  const train = after(probe((x) => { x.soldierPipeline.count = 1_000_000; })).combatSoldiers;
  const trainRate = (train - s.combatSoldiers) / 1_000_000 / TICK_SEC;
  return { hatch, mature: matureRate, train: trainRate, inflow: getAutoLayRate(s) };
}

// ─── Properties ────────────────────────────────────────────────────────────

describe('Story 2.5: systems give the same result for any step length', { timeout: 30_000 }, () => {
  it('one step of n × 50 ms and n steps of 50 ms both keep the integer invariants', () => {
    fc.assert(
      fc.property(arbState, arbTicks, (state, n) => {
        let prev = state;
        fine(state, n, (s) => { expectIntegerInvariants(prev, s, `fine step`); prev = s; });
        expectIntegerInvariants(state, coarse(state, n), `one ${n}-tick step`);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('pipelines (eggs → larvae → workers, soldier training) move the same items within the tolerance', () => {
    fc.assert(
      fc.property(arbState, arbTicks, (state, n) => {
        const T = n * TICK_SEC;
        const a = fine(state, n);
        const b = coarse(state, n);
        const k = stageRates(state);
        const kMax = Math.max(k.hatch, k.mature);
        const where = `n=${n}`;
        expect(Math.abs(a.resources.eggs - b.resources.eggs), `${where}: eggs`)
          .toBeLessThanOrEqual(pipelineTolerance(k.hatch, 1, T, k.inflow));
        // Rooms dug inside the window: the single step opens them to waiting larvae from its start.
        const dug = b.resources.nestCapacity - state.resources.nestCapacity;
        expect(Math.abs(a.resources.larvae - b.resources.larvae), `${where}: larvae`)
          .toBeLessThanOrEqual(pipelineTolerance(kMax, 2, T, k.inflow) + dug);
        expect(Math.abs(a.resources.workers - b.resources.workers), `${where}: workers`)
          .toBeLessThanOrEqual(pipelineTolerance(kMax, 2, T, k.inflow) + dug);
        expect(Math.abs(a.combatSoldiers - b.combatSoldiers), `${where}: soldiers trained`)
          .toBeLessThanOrEqual(pipelineTolerance(k.train, 1, T));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('dig workers add the same nest capacity for any step length', () => {
    fc.assert(
      fc.property(arbState, arbTicks, (state, n) => {
        const a = fine(state, n);
        const b = coarse(state, n);
        // Capacity is credited in whole rooms with the progress carried: at most one apart.
        expect(Math.abs(a.resources.nestCapacity - b.resources.nestCapacity)).toBeLessThanOrEqual(WHOLE_UNIT_CARRY);
        if (state.workersAssigned.dig > 0 && n === MAX_TICKS) {
          expect(b.resources.nestCapacity).toBeGreaterThan(state.resources.nestCapacity);
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('food, wood, stone and nectar accumulate the same amount within the rate tolerance', () => {
    fc.assert(
      fc.property(arbState, arbTicks, (state, n) => {
        const T = n * TICK_SEC;
        const bonuses = new TerritorySystem();
        const net: number[] = [];
        const wood: number[] = [];
        const stone: number[] = [];
        const nectar: number[] = [];
        const sample = (s: GameState) => {
          const r = computeResourceRates(s, bonuses.getBonuses(s));
          net.push(s.resources.workers > 0 ? r.foodProducedPerSec - r.foodConsumedPerSec : 0);
          wood.push(r.woodPerSec);
          stone.push(r.stonePerSec);
          nectar.push(r.nectarPerSec);
        };
        sample(state);
        const a = fine(state, n, sample);
        const b = coarse(state, n);
        // Food floors at 0 in both runs; a starving colony is compared on that floor.
        expect(Math.abs(a.resources.food - b.resources.food), `food, n=${n}`).toBeLessThanOrEqual(rateTolerance(net, T));
        // Conversions spend stone and nectar: compare what they produced, not the stock.
        if (!state.research.projects.voidCrystalSynthesis || state.research.projects.voidCrystalSynthesis.status !== 'done') {
          expect(Math.abs(a.resources.stone - b.resources.stone), `stone, n=${n}`).toBeLessThanOrEqual(rateTolerance(stone, T));
          expect(Math.abs(a.resources.nectar - b.resources.nectar), `nectar, n=${n}`).toBeLessThanOrEqual(rateTolerance(nectar, T));
        }
        expect(Math.abs(a.resources.wood - b.resources.wood), `wood, n=${n}`).toBeLessThanOrEqual(rateTolerance(wood, T));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('resource conversions run the same number of times for any step length', () => {
    fc.assert(
      fc.property(arbState, arbTicks, (state, n) => {
        const T = n * TICK_SEC;
        // A conversion's rate changes in the window when its staff or inputs do
        // (stone and nectar mined by new workers, crystals made by the stage before).
        const synth: number[] = [];
        const contain: number[] = [];
        const stone: number[] = [];
        const nectar: number[] = [];
        const territory = new TerritorySystem();
        const sample = (s: GameState) => {
          synth.push(getConversionRate(s, 'voidCrystalSynthesis'));
          contain.push(getConversionRate(s, 'antimatterContainment'));
          const r = computeResourceRates(s, territory.getBonuses(s));
          stone.push(r.stonePerSec);
          nectar.push(r.nectarPerSec);
        };
        sample(state);
        const a = fine(state, n, sample);
        const b = coarse(state, n);
        // Runs differ by the change in the run rate, or by the runs the change in
        // input supply pays for, whichever limits them (rateTolerance includes the
        // one run of carried progress per stage).
        const inputs = getConversionDefs().find((d) => d.id === 'voidCrystalSynthesis')!.inputs;
        const synthTol = rateTolerance(synth, T)
          + rateTolerance(stone, T) / inputs.stone! + rateTolerance(nectar, T) / inputs.nectar!;
        const containTol = rateTolerance(contain, T) + synthTol;
        // Crystals are made by one stage and spent (2 a run) by the next.
        expect(Math.abs(a.resources.voidCrystals - b.resources.voidCrystals), `voidCrystals, n=${n}`)
          .toBeLessThanOrEqual(synthTol + 2 * containTol);
        expect(Math.abs(a.resources.antimatter - b.resources.antimatter), `antimatter, n=${n}`)
          .toBeLessThanOrEqual(containTol);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('a conversion with a rate under one run per tick still runs (its progress carries)', () => {
    const s = createInitialState();
    s.research.projects.voidCrystalSynthesis = { status: 'done' };
    s.workersAssigned.researchers = 20; // the smallest staff that runs it at all
    s.resources.stone = 1_000;
    s.resources.nectar = 1_000;
    s.mapTiles = createEmptyMap().map((t, i) => (i === 0 ? { ...t, discovered: true } : t));
    const a = fine(s, MAX_TICKS);
    const b = coarse(s, MAX_TICKS);
    expect(a.resources.voidCrystals).toBeGreaterThan(0);
    expect(a.resources.voidCrystals).toBe(b.resources.voidCrystals);
  });

  it('spaceship missions count down by game time, not by calls', () => {
    fc.assert(
      fc.property(arbState, arbTicks, (state, n) => {
        fc.pre(state.spaceships.length > 0);
        const a = fine(state, n);
        const b = coarse(state, n);
        const left = (s: GameState) => s.spaceships[0]?.missionTicksRemaining ?? 0;
        expect(a.spaceships[0]?.status).toBe(b.spaceships[0]?.status);
        expect(left(a)).toBe(left(b));
        expect(left(b)).toBeGreaterThanOrEqual(0);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('probe swarm launches the same number of explorations on average for any step length', () => {
    // Random by design (Story 3.1 seeds it): compare means over many seeded trials.
    const base = createInitialState();
    base.resources.surveyData = PROBE_SWARM_THRESHOLD;
    const trials = 400;
    const window = 40; // ticks: few enough that the active-exploration cap rarely binds
    const launches = (n: number, perStepTicks: number, seed: number) => {
      const rand = mulberry32(seed);
      const real = Math.random;
      Math.random = rand;
      try {
        let s = base;
        for (let t = 0; t < n; t += perStepTicks) s = tickProbeSwarm(s, (perStepTicks * TICK_MS) / 1000);
        return s.spaceExplorations.length;
      } finally {
        Math.random = real;
      }
    };
    let fineSum = 0;
    let coarseSum = 0;
    for (let i = 0; i < trials; i++) {
      fineSum += launches(window, 1, 1_000 + i);
      coarseSum += launches(window, window, 9_000 + i);
    }
    const fineMean = fineSum / trials;
    const coarseMean = coarseSum / trials;
    expect(fineMean).toBeGreaterThan(0);
    expect(fineMean).toBeLessThan(MAX_ACTIVE_EXPLORATIONS);
    // Two sample means of a count bounded by the cap: within 15 % of each other.
    expect(Math.abs(fineMean - coarseMean)).toBeLessThanOrEqual(0.15 * fineMean);
  });
});
