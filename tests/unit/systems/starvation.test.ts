import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase } from '../../../src/phases/phases';
import { starvationBalance } from '../../../src/data/balance/starvation';
import { roomJobBalance } from '../../../src/data/balance/roomJobs';
import { ROOM_JOBS } from '../../../src/data/content/roomJobs';
import { ROOM_JOB_IDS } from '../../../src/systems/RoomJobs';
import { deathIntervalMs, eaters, getSettlesAt, graceMs, isStarvingNow, tickStarvation } from '../../../src/systems/Starvation';
import { getAssignedWorkers, netFoodOf } from '../../../src/systems/ResourceSystem';
import { EventBus } from '../../../src/engine/EventBus';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { catchUp } from '../../../src/engine/catchUp';
import { offlineDeathCap } from '../../../src/engine/offlineRules';
import { migrateSave } from '../../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../../src/persistence/SaveManager';
import { prestige } from '../../../src/systems/PrestigeSystem';
import { MS_PER_SEC, OFFLINE_WORKER_FLOOR_SHARE, TICK_MS } from '../../../src/data/constants';

/**
 * Story 9.16 (FR61, FR24, FR4, FR63 Pantry): starvation warns, then shrinks
 * the colony to fit. Once food is at zero and the colony eats more than it
 * makes, after a grace one eater (a worker or a soldier) dies every death
 * interval, until production covers use. Eggs, larvae and the queen never
 * starve. Invariants only: no balance number is restated.
 */

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** A hungry Combat colony: `workers` (`gather` of them gathering, the rest on `role` or free), `soldiers` trained, no food. */
function hungry(o: { workers?: number; gather?: number; dig?: number; soldiers?: number; food?: number; pantries?: number; seed?: number } = {}): GameState {
  const s = createInitialState();
  const workers = o.workers ?? 100;
  return {
    ...s,
    phase: Phase.COMBAT,
    seed: o.seed ?? s.seed,
    resources: { ...s.resources, workers, food: o.food ?? 0, eggs: 7, larvae: 5, nestCapacity: 10_000 },
    eggPipeline: { count: 7, progress: 0 },
    larvaPipeline: { count: 5, progress: 0 },
    // Workers off GATHER dig by default: DIG brings in no food, so the colony goes hungry.
    workersAssigned: { ...s.workersAssigned, gather: o.gather ?? 0, dig: o.dig ?? Math.max(0, workers - (o.gather ?? 0)) },
    combatSoldiers: o.soldiers ?? 20,
    roomJobs: { ...s.roomJobs, jobs: { ...s.roomJobs.jobs, pantry: o.pantries ?? 0 } },
  };
}

const sec = (ms: number) => ms / MS_PER_SEC;
/** `ms` of starvation in steps of `stepMs`. */
function starve(s: GameState, ms: number, stepMs: number = TICK_MS): GameState {
  let out = s;
  for (let done = 0; done < ms; done += stepMs) out = tickStarvation(out, sec(Math.min(stepMs, ms - done)));
  return out;
}
const deaths = (a: GameState, b: GameState) => eaters(a) - eaters(b);

describe('Story 9.16: when starvation bites', () => {
  it('a colony with food, or one that makes what it eats, never starves', () => {
    expect(isStarvingNow(hungry({ food: 1 }))).toBe(false);
    expect(isStarvingNow(hungry({ workers: 100, gather: 100, soldiers: 0 }))).toBe(false);
    expect(isStarvingNow(hungry())).toBe(true);
  });

  it('the first death comes no sooner than the grace after food reaches zero', () => {
    const s = hungry();
    const before = starve(s, graceMs(s) - TICK_MS);
    expect(deaths(s, before)).toBe(0);
    const after = starve(s, graceMs(s) + TICK_MS);
    expect(deaths(s, after)).toBe(1);
  });

  it('then one eater dies every death interval, and a bigger deficit never kills faster', () => {
    const big = hungry({ workers: 1000, soldiers: 400 });
    const bigger = hungry({ workers: 5000, soldiers: 2000 });
    const span = graceMs(big) + 10 * deathIntervalMs(big);
    const expected = Math.floor((span - graceMs(big)) / deathIntervalMs(big)) + 1;
    // Both stay hungry the whole span: the same deaths, however big the deficit.
    expect(deaths(big, starve(big, span, 500))).toBe(expected);
    expect(deaths(bigger, starve(bigger, span, 500))).toBe(expected);
    expect(deathIntervalMs(big)).toBeGreaterThanOrEqual(2_000);
    expect(deathIntervalMs(big)).toBeLessThanOrEqual(10_000);
  });

  it('eggs, larvae and the queen never starve; deaths are counted by kind', () => {
    const s = hungry({ workers: 300, soldiers: 100 });
    const after = starve(s, graceMs(s) + 40 * deathIntervalMs(s), 1000);
    expect(after.resources.eggs).toBe(s.resources.eggs);
    expect(after.resources.larvae).toBe(s.resources.larvae);
    const dw = s.resources.workers - after.resources.workers;
    const ds = s.combatSoldiers + s.soldierPipeline.count - (after.combatSoldiers + after.soldierPipeline.count);
    expect(dw + ds).toBeGreaterThan(0);
    expect(after.starvation.starvedWorkers).toBe(dw);
    expect(after.starvation.starvedSoldiers).toBe(ds);
  });

  it('picks the dead between workers and soldiers by their counts, from the seeded stream', () => {
    const run = (seed: number) => starve(hungry({ workers: 200, soldiers: 200, seed }), 120_000, 1000);
    const a = run(1);
    expect(run(1)).toEqual(a);
    // Over many seeds both kinds die.
    const kinds = new Set<string>();
    for (let seed = 1; seed < 12; seed++) {
      const r = run(seed);
      if (r.starvation.starvedWorkers > 0) kinds.add('w');
      if (r.starvation.starvedSoldiers > 0) kinds.add('s');
    }
    expect(kinds).toEqual(new Set(['w', 's']));
  });

  it('a dead worker comes off a role that brings in no food (free workers who feed themselves live); roles never exceed workers', () => {
    const s = hungry({ workers: 10, dig: 8, soldiers: 0 });
    let cur = s;
    for (let i = 0; i < 60; i++) {
      const next = tickStarvation(cur, sec(deathIntervalMs(s)));
      if (next.resources.workers < cur.resources.workers) {
        expect(next.workersAssigned.dig).toBe(cur.workersAssigned.dig - 1);
        expect(next.resources.workers - getAssignedWorkers(next)).toBe(cur.resources.workers - getAssignedWorkers(cur));
      }
      expect(getAssignedWorkers(next)).toBeLessThanOrEqual(next.resources.workers);
      cur = next;
    }
  });
});

describe('Story 9.16: shrink to fit', () => {
  const arb = fc.record({
    workers: fc.integer({ min: 0, max: 400 }),
    gatherShare: fc.double({ min: 0, max: 1, noNaN: true }),
    soldiers: fc.integer({ min: 0, max: 200 }),
    food: fc.constantFrom(0, 0, 0, 50),
    ms: fc.integer({ min: 0, max: 300_000 }),
    seed: fc.integer({ min: 1, max: 1_000_000 }),
  }).map((r) => ({ s: hungry({ workers: r.workers, gather: Math.floor(r.workers * r.gatherShare), soldiers: r.soldiers, food: r.food, seed: r.seed }), ms: r.ms }));

  it('no death happens while the net food rate is zero or better', () => {
    fc.assert(
      fc.property(arb, ({ s, ms }) => {
        if (netFoodOf(s) >= 0 || s.resources.food > 0) expect(eaters(tickStarvation(s, sec(ms)))).toBe(eaters(s));
      }),
      { numRuns: 200 },
    );
  });

  it('never ends a step smaller than where it settles, and at the settling size the food rate is zero or better', () => {
    fc.assert(
      fc.property(arb, ({ s, ms }) => {
        const settle = getSettlesAt(s);
        const after = tickStarvation(s, sec(ms));
        expect(eaters(after)).toBeGreaterThanOrEqual(settle.workers + settle.soldiers);
        expect(settle.netFoodPerSec).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('dies the same number for any step length, within one', () => {
    fc.assert(
      fc.property(arb, fc.integer({ min: 1, max: 200 }), ({ s }, n) => {
        const ms = graceMs(s) + n * TICK_MS * 10;
        const fine = starve(s, ms, TICK_MS);
        const coarse = starve(s, ms, 10_000);
        expect(Math.abs(eaters(fine) - eaters(coarse))).toBeLessThanOrEqual(1);
      }),
      { numRuns: 60 },
    );
  });
});

describe('Story 9.16: never wipes the run', () => {
  /** Hungry, with free workers and gatherers who make more food than they eat. */
  const mixed = (free: number, dig: number, gather: number, soldiers: number) => {
    const s = hungry({ workers: free + dig + gather, gather, dig, soldiers });
    return s;
  };

  it('a colony whose free workers and gatherers feed themselves settles above zero, and its gatherers never starve', () => {
    for (const [free, dig, gather, soldiers] of [[10, 10, 0, 20], [50, 0, 0, 50], [5, 40, 10, 30], [0, 100, 20, 0]]) {
      const s = mixed(free, dig, gather, soldiers);
      const after = starve(s, 30 * 60_000, 1000);
      expect(eaters(after), `${free}/${dig}/${gather}/${soldiers}`).toBeGreaterThan(0);
      expect(after.workersAssigned.gather).toBe(s.workersAssigned.gather);
      expect(getSettlesAt(s).workers + getSettlesAt(s).soldiers).toBeGreaterThan(0);
    }
  });

  it('every death raises the food rate (only eaters who eat more than they make die)', () => {
    let cur = mixed(10, 30, 5, 20);
    for (let i = 0; i < 200; i++) {
      const next = tickStarvation(cur, sec(deathIntervalMs(cur)));
      if (eaters(next) < eaters(cur)) expect(netFoodOf(next)).toBeGreaterThan(netFoodOf(cur));
      cur = next;
    }
  });
});

describe('Story 9.16: the clock after a cap', () => {
  it('a stretch that stopped at the away cap owes at most one death on the next live step', () => {
    const s = hungry({ workers: 200, soldiers: 50 });
    const bus = new EventBus();
    const deps = { resourceSystem: new ResourceSystem(bus), soldierSystem: new SoldierSystem(bus), mapSystem: new MapSystem(), territorySystem: new TerritorySystem(), latch: (x: GameState) => x };
    const ms = 12 * 3600_000;
    const away = catchUp(s, ms, Math.floor(ms / TICK_MS), deps);
    expect(away.starvation.starvedWorkers + away.starvation.starvedSoldiers).toBe(offlineDeathCap(s));
    expect(deaths(away, tickStarvation(away, TICK_MS / MS_PER_SEC))).toBeLessThanOrEqual(1);
  });
});

describe('Story 9.16: the Pantry', () => {
  it('is a room job, as data', () => {
    expect(ROOM_JOB_IDS).toContain('pantry');
    expect(ROOM_JOBS.find((j) => j.id === 'pantry')?.label).toBe('PANTRY');
    expect(roomJobBalance.jobs.pantry).toBeDefined();
  });

  it('lengthens the grace and the death interval, up to a cap, and never stops starvation', () => {
    const none = hungry();
    const one = hungry({ pantries: 1 });
    const lots = hungry({ pantries: 10_000 });
    expect(graceMs(one)).toBeGreaterThan(graceMs(none));
    expect(deathIntervalMs(one)).toBeGreaterThan(deathIntervalMs(none));
    expect(graceMs(lots)).toBeLessThanOrEqual(graceMs(none) * starvationBalance.pantryMaxFactor);
    expect(deathIntervalMs(lots)).toBeLessThanOrEqual(deathIntervalMs(none) * starvationBalance.pantryMaxFactor);
    expect(deaths(lots, starve(lots, graceMs(lots) + 3 * deathIntervalMs(lots), 1000))).toBeGreaterThan(0);
  });
});

describe('Story 9.16: away, at most 20% of the eaters', () => {
  it('the floor share is 0.8 and covers soldiers too', () => {
    expect(OFFLINE_WORKER_FLOOR_SHARE).toBe(0.8);
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 500 }), fc.integer({ min: 0, max: 300 }), fc.integer({ min: 1, max: 48 }), (workers, soldiers, hours) => {
        const s = hungry({ workers, soldiers });
        const bus = new EventBus();
        const deps = { resourceSystem: new ResourceSystem(bus), soldierSystem: new SoldierSystem(bus), mapSystem: new MapSystem(), territorySystem: new TerritorySystem(), latch: (x: GameState) => x };
        const ms = hours * 3600_000;
        const after = catchUp(s, ms, Math.floor(ms / TICK_MS), deps);
        const lost = after.starvation.starvedWorkers + after.starvation.starvedSoldiers;
        expect(lost).toBeLessThanOrEqual(offlineDeathCap(s));
        expect(lost).toBeLessThanOrEqual(Math.round((1 - OFFLINE_WORKER_FLOOR_SHARE) * eaters(s)));
      }),
      { numRuns: 25 },
    );
  });
});

describe('Story 9.16: away, food that runs out late still starves', () => {
  it('a store that lasts most of a half-efficiency absence runs out, and then ants die', () => {
    const s = hungry({ workers: 300, soldiers: 50 });
    const bus = new EventBus();
    const deps = { resourceSystem: new ResourceSystem(bus), soldierSystem: new SoldierSystem(bus), mapSystem: new MapSystem(), territorySystem: new TerritorySystem(), latch: (x: GameState) => x };
    const ms = 8 * 3600_000;
    // Enough food for about 3/4 of the absence at the current deficit.
    const food = Math.floor(-netFoodOf(s) * (ms / MS_PER_SEC) * 0.75);
    const after = catchUp({ ...s, resources: { ...s.resources, food } }, ms, Math.floor(ms / TICK_MS / 2), deps);
    expect(after.starvation.starvedWorkers + after.starvation.starvedSoldiers).toBeGreaterThan(0);
  });

  it('the cap is a whole share of the eaters before: 20% of 10 is 2', () => {
    expect(offlineDeathCap(hungry({ workers: 10, soldiers: 0 }))).toBe(2);
    expect(offlineDeathCap(hungry({ workers: 80, soldiers: 20 }))).toBe(20);
  });
});

describe('Story 9.16: saves and prestige', () => {
  it('a save from before starvation loads with a still clock, no deaths and no Pantry', () => {
    const v = SaveManager.SAVE_VERSION;
    const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    delete s.starvation;
    delete (s.roomJobs as { jobs: Record<string, number> }).jobs.pantry;
    const old: SaveData = { version: v - 1, timestamp: 1, playTimeMs: 0, gameState: s as unknown as GameState };
    const gs = migrateSave(old, v - 1, v).gameState;
    expect(gs.starvation).toEqual(createInitialState().starvation);
    expect(gs.roomJobs.jobs.pantry).toBe(0);
  });

  it('prestige starts the run with a still clock and no deaths counted', () => {
    const s = starve(hungry(), 120_000, 1000);
    expect(s.starvation.starvedWorkers + s.starvation.starvedSoldiers).toBeGreaterThan(0);
    expect(prestige(s).starvation).toEqual(createInitialState().starvation);
  });
});
