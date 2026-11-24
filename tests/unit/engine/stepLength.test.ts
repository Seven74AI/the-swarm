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
import { TICK_MS } from '../../../src/data/constants';
import { pipelineTolerance, rateTolerance, stageRates, WHOLE_UNIT_CARRY } from '../helpers/stepTolerance';
import { automationBalance } from '../../../src/data/balance/automation';
import { combatBalance } from '../../../src/data/balance/combat';
import { AUTOMATION_VERB_IDS } from '../../../src/data/content/automation';
import { automationCount, autoLayPerSec } from '../../../src/systems/AutomationTargets';
import { getCrowding } from '../../../src/systems/Crowding';

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
    // Story 4.7: the Fungus Garden scales gatherer food, Tunnels the digging.
    garden: fc.integer({ min: 0, max: 3 }),
    tunnels: fc.integer({ min: 0, max: 3 }),
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
    s.workersAssigned = { gather: part(0), forage: part(4), tend: part(1), dig: part(2), guard: part(3), researchers: 0 };
    s.resources.eggs = r.eggs;
    s.eggPipeline = { count: r.eggs, progress: r.eggProgress };
    s.resources.larvae = r.larvae;
    s.larvaPipeline = { count: r.larvae, progress: r.larvaProgress };
    s.resources.food = r.food;
    s.buildings = { ...s.buildings, fungus_garden: { level: r.garden }, tunnels: { level: r.tunnels } };
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
        const k = stageRates(state, step);
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

  it('draws crowded nests too (Story 9.13), so every property here covers crowding', () => {
    const draws = fc.sample(arbState, { seed: SEED, numRuns: RUNS });
    expect(draws.filter((s) => getCrowding(s).multiplier < 1).length).toBeGreaterThan(RUNS / 4);
    expect(draws.some((s) => getCrowding(s).multiplier === 1)).toBe(true);
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
          // The tick credits food while anyone eats: workers, or soldiers (Story 4.4).
          const eats = s.resources.workers > 0 || s.combatSoldiers + s.soldierPipeline.count > 0;
          net.push(eats ? r.foodProducedPerSec - r.foodConsumedPerSec : 0);
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
    // Random by design, from the seed (Story 3.1): compare means over many seeded trials.
    const base = createInitialState();
    base.resources.surveyData = PROBE_SWARM_THRESHOLD;
    const trials = 400;
    const window = 40; // ticks: few enough that the active-exploration cap rarely binds
    const launches = (n: number, perStepTicks: number, seed: number) => {
      let s: GameState = { ...base, seed };
      for (let t = 0; t < n; t += perStepTicks) {
        s = tickProbeSwarm(s, (perStepTicks * TICK_MS) / 1000);
        s = { ...s, stats: { ...s.stats, playTimeMs: s.stats.playTimeMs + perStepTicks * TICK_MS } };
      }
      return s.spaceExplorations.length;
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

// ─── Automation targets (Story 4.10) ───────────────────────────────────────

/**
 * Story 4.10: automation targets run inside `processTick`, so they join the
 * step-length properties. A step works the count toward the target once,
 * after its production; the fine run does it every 50 ms.
 *
 * Exact, for both runs: no ant is made or lost (eggs + larvae + workers, plus
 * the workers in soldiers, scouts and warriors, grow by exactly the eggs
 * laid), and no count passes its target (or the count it started above it).
 *
 * Within a tolerance: with food and free workers to spare for the whole
 * target, both runs end with the army at the target exactly. The queen's
 * eggs are laid at one rate in both: the runs differ by the carried fraction
 * of an egg (one), by the eggs one fine step lays before the brood is
 * re-measured (a tick's worth of the rate), and by the room larvae make by
 * maturing inside the window, which the fine run refills as it opens and the
 * single step only at its end (at most the workers the window adds).
 */
const arbAutomated: fc.Arbitrary<GameState> = fc
  .record({
    base: arbState,
    phase: fc.constantFrom(Phase.COMBAT, Phase.EXPANSION, Phase.SPACE),
    lay: fc.option(fc.integer({ min: 0, max: 900 }), { nil: null }),
    train: fc.option(fc.integer({ min: 0, max: 200 }), { nil: null }),
    scout: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
    barracks: fc.integer({ min: 0, max: 3 }),
    clickPower: fc.integer({ min: 0, max: 40 }),
  })
  .map((r) => {
    const s = structuredClone(r.base);
    s.phase = r.phase;
    s.autoProduction.enabled = false;
    s.prestigeTree.purchased = s.prestigeTree.purchased.filter((id) => id !== 'auto_egg_laying');
    s.buildings.barracks = { level: r.barracks, count: r.barracks };
    s.upgrades = { ...s.upgrades, click_power: r.clickPower };
    const n = automationBalance.targets.unlockAfterManual;
    const row = (t: number | null) => ({ target: t ?? 0, on: t !== null });
    s.automation = {
      performed: { lay: n, train: n, scout: n, warrior: n },
      targets: { lay: row(r.lay), train: row(r.train), scout: row(r.scout), warrior: row(r.scout) },
      layProgress: 0,
    };
    return s;
  });

const antsOf = (s: GameState) =>
  s.resources.eggs + s.resources.larvae + s.resources.workers
  + (s.combatSoldiers + s.soldierPipeline.count) * combatBalance.army.workersPerSoldier
  + s.soldiers.scouts + s.soldiers.warriors;

describe('Story 4.10: automation targets give the same result for any step length', { timeout: 30_000 }, () => {
  it('no ant is made or lost, and no count passes its target, in either run', () => {
    fc.assert(
      fc.property(arbAutomated, arbTicks, (state, n) => {
        const check = (before: GameState, after: GameState, where: string) => {
          const laid = after.stats.totalEggsLaid - before.stats.totalEggsLaid;
          expect(antsOf(after), `${where}: ants grow only by the eggs laid`).toBe(antsOf(before) + laid);
          for (const verb of AUTOMATION_VERB_IDS) {
            const t = before.automation.targets[verb];
            if (!t.on) continue;
            const bound = Math.max(t.target, automationCount(before, verb));
            expect(automationCount(after, verb), `${where}: ${verb} within its target`).toBeLessThanOrEqual(bound);
          }
        };
        let prev = state;
        fine(state, n, (s) => { check(prev, s, 'fine step'); prev = s; });
        check(state, coarse(state, n), `one ${n}-tick step`);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('with enough food and free workers, both runs end at the training target', () => {
    fc.assert(
      fc.property(arbAutomated, arbTicks, fc.integer({ min: 0, max: 60 }), (state, n, target) => {
        const s = structuredClone(state);
        s.automation.targets.train = { target, on: true };
        s.resources.food = 1_000_000;
        s.resources.workers += target * combatBalance.army.workersPerSoldier;
        s.resources.nestCapacity += target * combatBalance.army.workersPerSoldier;
        const want = Math.max(target, automationCount(s, 'train'));
        expect(automationCount(fine(s, n), 'train')).toBe(want);
        expect(automationCount(coarse(s, n), 'train')).toBe(want);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('the queen lays the same eggs within the tolerance', () => {
    fc.assert(
      fc.property(arbAutomated, arbTicks, (state, n) => {
        fc.pre(state.automation.targets.lay.on);
        const a = fine(state, n);
        const b = coarse(state, n);
        const laid = (s: GameState) => s.stats.totalEggsLaid - state.stats.totalEggsLaid;
        const born = Math.max(a.resources.workers, b.resources.workers) - state.resources.workers;
        const perTick = Math.ceil(autoLayPerSec(state) * TICK_SEC);
        expect(Math.abs(laid(a) - laid(b)), `n=${n}`).toBeLessThanOrEqual(WHOLE_UNIT_CARRY + perTick + Math.max(0, born));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
