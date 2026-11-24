import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import { getFoodLimit } from '../../../src/systems/FoodLimit';
import { foodLimitBalance } from '../../../src/data/balance/foodLimit';
import { digBalance } from '../../../src/data/balance/dig';
import { ROOM_JOBS } from '../../../src/data/content/roomJobs';
import { ROOM_JOB_IDS, applyRoomJob } from '../../../src/systems/RoomJobs';
import { ResourceSystem, computeResourceRates } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { processTick } from '../../../src/engine/processTick';
import { catchUpWithReport } from '../../../src/engine/catchUp';
import { migrateSave } from '../../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../../src/persistence/SaveManager';
import { prestige } from '../../../src/systems/PrestigeSystem';
import { goalFor } from '../../../src/phases/transitions';
import { listItems, itemPanel, itemPrice } from '../../../src/systems/NextAction';
import { PANEL_PLACEMENT, isUnlocked } from '../../../src/data/content/tabs';
import { TICK_MS } from '../../../src/data/constants';

/**
 * Story 9.15 (FR62, FR63 Larder): the food store has a limit. A base for the
 * starting chambers, a share for every room dug, much more for every Larder.
 * Income past it is lost and counted (`foodLostAtLimit`); food already over
 * it is kept. Invariants only: no balance number is restated.
 */

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** A Colony nest of `rooms` rooms (`larders` of them Larders), `gatherers` gathering, with `food` in store. */
function nest(rooms: number, larders = 0, food = 0, gatherers = 40): GameState {
  const s = createInitialState();
  return {
    ...s,
    phase: Phase.COLONY,
    dig: { ...s.dig, roomsDug: rooms },
    roomJobs: { jobs: { ...s.roomJobs.jobs, larder: larders }, fresh: 0 },
    resources: { ...s.resources, workers: gatherers, food, nestCapacity: 10_000 },
    workersAssigned: { ...s.workersAssigned, gather: gatherers },
  };
}

const step = (s: GameState, dtSec: number): GameState => {
  const bus = new EventBus();
  return processTick(s, new ResourceSystem(bus), new SoldierSystem(bus), new MapSystem(), new TerritorySystem(), new EventQueue(), dtSec);
};

describe('Story 9.15: getFoodLimit', () => {
  it('is a whole, positive number that never falls as rooms are dug, and a Larder raises it by more than a room', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 50 }), (rooms, more) => {
        const a = getFoodLimit(nest(rooms));
        expect(Number.isInteger(a)).toBe(true);
        expect(a).toBeGreaterThan(0);
        expect(getFoodLimit(nest(rooms + more))).toBeGreaterThanOrEqual(a);
        if (rooms > 0) {
          const larder = getFoodLimit(nest(rooms, 1));
          expect(larder).toBeGreaterThan(a);
          expect(larder - a).toBeGreaterThan(getFoodLimit(nest(rooms + 1)) - a);
        }
      }),
    );
  });

  it('LARDER is a room job, as data', () => {
    expect(ROOM_JOB_IDS).toContain('larder');
    expect(ROOM_JOBS.find((j) => j.id === 'larder')?.label).toBe('LARDER');
    const s = { ...nest(3), roomJobs: { ...nest(3).roomJobs, fresh: 3 } };
    expect(getFoodLimit(applyRoomJob(s, 'plain', 'larder'))).toBeGreaterThan(getFoodLimit(s));
  });
});

describe('Story 9.15: food stops at the limit', () => {
  it('income past the limit is lost and counted, in whole units; nothing else is made or lost', () => {
    const s = nest(0, 0, getFoodLimit(nest(0)) - 1);
    expect(computeResourceRates(s).foodProducedPerSec - computeResourceRates(s).foodConsumedPerSec).toBeGreaterThan(0);
    const after = step(s, 60);
    expect(after.resources.food).toBe(getFoodLimit(after));
    expect(after.foodLostAtLimit).toBeGreaterThan(0);
    expect(Number.isInteger(after.foodLostAtLimit)).toBe(true);
    const uncapped = step({ ...s, dig: { ...s.dig, roomsDug: 100_000 } }, 60);
    // What was lost is what the store could not hold (within a unit for the carried fraction).
    expect(Math.abs(after.resources.food + after.foodLostAtLimit - uncapped.resources.food)).toBeLessThanOrEqual(1);
  });

  it('gives the same food and the same loss for any step length', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 1, max: 200 }), fc.integer({ min: 0, max: 3000 }), (rooms, n, below) => {
        const s = nest(rooms, 0, Math.max(0, getFoodLimit(nest(rooms)) - below));
        let fine = s;
        for (let i = 0; i < n; i++) fine = step(fine, TICK_MS / 1000);
        const coarse = step(s, (n * TICK_MS) / 1000);
        // Whole units, the fraction carried: at most one apart.
        expect(Math.abs(fine.resources.food - coarse.resources.food)).toBeLessThanOrEqual(1);
        expect(Math.abs(fine.foodLostAtLimit - coarse.foodLostAtLimit)).toBeLessThanOrEqual(1);
        expect(fine.resources.food).toBeLessThanOrEqual(Math.max(s.resources.food, getFoodLimit(fine)));
      }),
      { numRuns: 60 },
    );
  });

  it('a store already over the limit keeps its food: only new income is lost', () => {
    const limit = getFoodLimit(nest(0));
    const over = nest(0, 0, limit * 3);
    const after = step(over, 60);
    expect(after.resources.food).toBe(over.resources.food);
    expect(after.foodLostAtLimit).toBeGreaterThan(0);
    // An eating colony over the limit still eats from it.
    const eating = { ...over, workersAssigned: { ...over.workersAssigned, gather: 0, dig: 40 } };
    expect(step(eating, 60).resources.food).toBeLessThan(over.resources.food);
  });

  it('catch-up stops at the limit too, and says when the store filled', () => {
    const s = nest(0, 0, 0);
    const bus = new EventBus();
    const deps = { resourceSystem: new ResourceSystem(bus), soldierSystem: new SoldierSystem(bus), mapSystem: new MapSystem(), territorySystem: new TerritorySystem(), latch: (x: GameState) => x };
    const ms = 4 * 3600_000;
    const { state, report } = catchUpWithReport(s, ms, Math.floor(ms / TICK_MS), deps);
    expect(state.resources.food).toBeLessThanOrEqual(getFoodLimit(state));
    expect(state.foodLostAtLimit).toBeGreaterThan(0);
    expect(report.foodFullAfterMs).not.toBeNull();
    expect(report.foodFullAfterMs!).toBeGreaterThan(0);
    expect(report.foodFullAfterMs!).toBeLessThan(ms);
    const short = catchUpWithReport(s, 1000, Math.floor(1000 / TICK_MS), deps);
    expect(short.report.foodFullAfterMs).toBeNull();
  });
});

describe('Story 9.15: no catch-22 under the limit', () => {
  /** The highest limit a colony can reach by a phase's guard: the rooms its workers need, every one a Larder. */
  function limitAtGuard(phase: Phase): number {
    const s0 = { ...createInitialState(), phase };
    // The most workers any guard up to this one asked for: the run has passed them all.
    const upTo = PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(phase) + 1);
    const workers = Math.max(0, ...upTo.map((p) => goalFor(p)?.conditions.find((c) => c.id === 'workers')?.target({ ...s0, phase: p }) ?? 0));
    const rooms = phase === Phase.EGG_LAYING ? 0 : Math.max(0, Math.ceil((workers - s0.resources.nestCapacity) / digBalance.roomSize));
    return getFoodLimit(nest(rooms, rooms));
  }

  it('every food price open in a phase, and its guard’s own food, fits under the limit reachable by that guard', () => {
    for (const phase of PHASE_ORDER) {
      const goal = goalFor(phase);
      if (!goal) continue;
      const s = { ...createInitialState(), phase };
      const limit = limitAtGuard(phase);
      for (const ref of listItems()) {
        if (!isUnlocked(PANEL_PLACEMENT[itemPanel(ref)].unlockPhase, phase)) continue;
        const food = (itemPrice(s, ref) as { food?: number }).food ?? 0;
        expect(food, `${phase}: ${JSON.stringify(ref)}`).toBeLessThanOrEqual(limit);
      }
      const guardFood = goal.conditions.find((c) => c.id === 'food')?.target(s) ?? 0;
      expect(guardFood, `${phase}: the guard's food`).toBeLessThanOrEqual(limit);
    }
  });
});

describe('Story 9.15: saves and prestige', () => {
  it('a save from before the limit loads with nothing lost and no Larder, and keeps all its food', () => {
    const v = SaveManager.SAVE_VERSION;
    const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    delete s.foodLostAtLimit;
    const rj = s.roomJobs as { jobs: Record<string, number> };
    delete rj.jobs.larder;
    const old: SaveData = { version: v - 1, timestamp: 1, playTimeMs: 0, gameState: { ...s, resources: { ...(s.resources as object), food: 1e9 } } as unknown as GameState };
    const gs = migrateSave(old, v - 1, v).gameState;
    expect(gs.foodLostAtLimit).toBe(0);
    expect(gs.roomJobs.jobs.larder).toBe(0);
    expect(gs.resources.food).toBe(1e9);
  });

  it('prestige resets the count with the run', () => {
    const s = { ...nest(2), foodLostAtLimit: 1234 };
    expect(prestige(s).foodLostAtLimit).toBe(0);
  });
});

void foodLimitBalance;
