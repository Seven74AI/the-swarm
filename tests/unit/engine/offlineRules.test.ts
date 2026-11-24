import { afterEach, describe, expect, it, vi } from 'vitest';
import { catchUp, type CatchUpDeps } from '../../../src/engine/catchUp';
import { resume } from '../../../src/engine/resume';
import { processTick } from '../../../src/engine/processTick';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { offlineWorkerFloor } from '../../../src/engine/offlineRules';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import type { TerritoryBonuses } from '../../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { EGG_TO_COLONY, TRANSITIONS } from '../../../src/phases/transitions';
import { HOUR_MS, OFFLINE_WORKER_FLOOR_SHARE } from '../../../src/data/constants';
import type { EventSink } from '../../../src/engine/events';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';

/**
 * Story 2.7 (FR24, AR4): offline time follows its own rules. Inside a
 * catch-up no decision event spawns or counts down, no phase is committed
 * (the goal latch may set), every event goes to a collecting queue that is
 * never flushed, automation runs as the player set it, and starvation never
 * takes the workforce below `floor(0.5 × workers before the absence)`. The
 * floor is a catch-up rule only: foreground ticks don't apply it.
 */

/** Seeded PRNG (mulberry32), so the property runs are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A starving colony for the floor tests: whenever the food store is empty,
 * a share of the workforce dies each step (FR4's starvation, Epic 3, is not
 * built yet). Anything that kills workers offline must still respect the floor.
 */
class StarvingResourceSystem extends ResourceSystem {
  constructor(bus: EventBus, private readonly deathShare: number) {
    super(bus);
  }
  override tick(
    state: GameState,
    bonuses?: TerritoryBonuses,
    dtSec?: number,
    skip?: boolean,
    events?: EventSink,
  ): GameState {
    const s = super.tick(state, bonuses, dtSec, skip, events);
    if (s.resources.food > 0 || s.resources.workers === 0) return s;
    const dead = Math.max(1, Math.ceil(s.resources.workers * this.deathShare));
    return { ...s, resources: { ...s.resources, workers: Math.max(0, s.resources.workers - dead) } };
  }
}

function deps(bus = new EventBus(), resourceSystem: ResourceSystem = new ResourceSystem(bus)): CatchUpDeps {
  const fsm = new PhaseStateMachine(TRANSITIONS);
  return {
    resourceSystem,
    soldierSystem: new SoldierSystem(bus),
    mapSystem: new MapSystem(),
    territorySystem: new TerritorySystem(),
    latch: (s) => fsm.latch(s),
  };
}

/** A busy colony: gatherers, a pipeline in flight and soldiers in training. */
const colony = (over: Parameters<typeof makeState>[0] = {}) =>
  makeState({
    phase: 'colony',
    resources: { workers: 40, food: 2_000, eggs: 30, larvae: 10 },
    eggPipeline: { count: 30, progress: 0 },
    larvaPipeline: { count: 10, progress: 0 },
    soldierPipeline: { count: 3, progress: 0 },
    workersAssigned: { gather: 20, tend: 5 },
    ...over,
  });

/** A starving colony: nobody gathers and the store is nearly empty. */
const starving = (workers: number, food: number) =>
  makeState({
    phase: 'colony',
    resources: { workers, food, eggs: 0, larvae: 0, nestCapacity: Math.max(workers, 10) },
    workersAssigned: { gather: 0, tend: 0, dig: 0, guard: workers },
  });

afterEach(() => vi.restoreAllMocks());

describe('offline rules: decisions', () => {
  it('an open decision neither counts down nor times out over a long absence', () => {
    const before = colony({
      decision: { open: { id: 'beetle_sighting', remainingMs: 5_000, openedAtSessionMs: 0, roll: 0.5 }, nextSpawnSessionMs: 0 },
    });
    const after = resume(before, 6 * HOUR_MS, deps()).state;
    expect(after.decision).toEqual(before.decision);
  });

  it('no decision event spawns during catch-up, even when one is due', () => {
    const queued: string[] = [];
    const emit = EventQueue.prototype.emit;
    vi.spyOn(EventQueue.prototype, 'emit').mockImplementation(function (this: EventQueue, name, payload) {
      queued.push(String(name));
      return emit.call(this, name, payload as never);
    } as typeof emit);
    const before = colony({ decision: { open: null, nextSpawnSessionMs: 0 } });
    const after = resume(before, 6 * HOUR_MS, deps()).state;
    expect(after.decision.open).toBeNull();
    expect(after.decision.nextSpawnSessionMs).toBe(before.decision.nextSpawnSessionMs);
    expect(queued).not.toContain('decision_spawned');
    expect(queued).not.toContain('decision_resolved');
  });
});

describe('offline rules: phases', () => {
  it('a goal met offline latches but the phase is never committed', () => {
    const before = makeState({ phase: 'egg_laying' });
    // Meet every condition of the first goal, read from transitions.ts (never restated).
    const met = EGG_TO_COLONY.conditions.reduce<GameState>(
      (s, c) => (c.id === 'workers' ? { ...s, resources: { ...s.resources, workers: c.target(s), nestCapacity: c.target(s) } } : s),
      before,
    );
    expect(EGG_TO_COLONY.guard(met)).toBe(true);
    const queued: string[] = [];
    const emit = EventQueue.prototype.emit;
    vi.spyOn(EventQueue.prototype, 'emit').mockImplementation(function (this: EventQueue, name, payload) {
      queued.push(String(name));
      return emit.call(this, name, payload as never);
    } as typeof emit);

    const after = resume(met, 2 * HOUR_MS, deps()).state;
    expect(after.phase).toBe(met.phase);
    expect(after.phaseGoal?.latched).toBe(true);
    expect(queued).not.toContain('phase_committed');
  });
});

describe('offline rules: events', () => {
  it('nothing a catch-up raises reaches the bus, so nothing plays or animates', () => {
    const bus = new EventBus();
    const heard = vi.spyOn(bus, 'emit');
    const before = colony({
      autoProduction: { enabled: true, researches: {}, buildings: { nursery: 2 }, progress: 0 },
    });
    const after = resume(before, 3 * HOUR_MS, deps(bus)).state;
    // The colony did change (events were raised) ...
    expect(after.stats.playTimeMs).toBeGreaterThan(before.stats.playTimeMs);
    expect(after.combatSoldiers).toBeGreaterThan(before.combatSoldiers);
    // ... yet the bus heard none of it.
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('offline rules: automation', () => {
  it('player-set automation runs offline as configured, and stays off when switched off', () => {
    const automation = (enabled: boolean) =>
      colony({ autoProduction: { enabled, researches: {}, buildings: { nursery: 2 }, progress: 0 } });
    const on = automation(true);
    const off = automation(false);
    const laidOn = resume(on, 2 * HOUR_MS, deps()).state.stats.totalEggsLaid - on.stats.totalEggsLaid;
    const laidOff = resume(off, 2 * HOUR_MS, deps()).state.stats.totalEggsLaid - off.stats.totalEggsLaid;
    expect(laidOn).toBeGreaterThan(0);
    expect(laidOn).toBeGreaterThan(laidOff);
  });

  it('player-set role assignments are kept through catch-up', () => {
    const before = colony();
    const after = resume(before, 4 * HOUR_MS, deps()).state;
    expect(after.workersAssigned).toEqual(before.workersAssigned);
  });
});

describe('offline rules: starvation floor (FR24)', () => {
  it('the floor is ceil(OFFLINE_WORKER_FLOOR_SHARE × eaters before the absence), a whole number (Story 9.16: soldiers count)', () => {
    for (const w of [0, 1, 7, 40, 999]) {
      for (const soldiers of [0, 13]) {
        const floor = offlineWorkerFloor(makeState({ resources: { workers: w }, combatSoldiers: soldiers }));
        expect(Number.isInteger(floor)).toBe(true);
        expect(floor).toBe(Math.ceil(OFFLINE_WORKER_FLOOR_SHARE * (w + soldiers)));
        expect(floor).toBeLessThanOrEqual(w + soldiers);
      }
    }
  });

  it('property: starvation during catch-up never takes workers below the floor', () => {
    const rand = rng(0x2_7);
    for (let run = 0; run < 60; run++) {
      const workers = Math.floor(rand() * 600);
      const food = Math.floor(rand() * 200);
      const deathShare = 0.05 + rand() * 0.9;
      // From a minute to past the 24 h ceiling (the cap cuts it).
      const elapsedMs = 60_000 + Math.floor(rand() * 30 * HOUR_MS);
      const before = starving(workers, food);
      const bus = new EventBus();
      const after = resume(before, elapsedMs, deps(bus, new StarvingResourceSystem(bus, deathShare))).state;
      const floor = Math.ceil(OFFLINE_WORKER_FLOOR_SHARE * before.resources.workers);
      expect(Number.isInteger(after.resources.workers)).toBe(true);
      expect(after.resources.workers, `run ${run}: ${workers} workers, ${elapsedMs} ms`).toBeGreaterThanOrEqual(floor);
    }
  });

  it('the floor never adds workers: without starvation the workforce is what the systems made it', () => {
    const before = colony();
    const after = resume(before, 4 * HOUR_MS, deps()).state;
    expect(after.resources.workers).toBeGreaterThanOrEqual(before.resources.workers);
    const starvingBefore = starving(100, 0);
    const bus = new EventBus();
    const starved = resume(starvingBefore, 4 * HOUR_MS, deps(bus, new StarvingResourceSystem(bus, 0.5))).state;
    expect(starved.resources.workers).toBeLessThanOrEqual(starvingBefore.resources.workers);
  });

  it('applies to every catch-up, fine-stepped too', () => {
    const before = starving(80, 0);
    const bus = new EventBus();
    const after = catchUp(before, HOUR_MS, HOUR_MS / 50, deps(bus, new StarvingResourceSystem(bus, 0.5)), 50);
    expect(after.resources.workers).toBeGreaterThanOrEqual(offlineWorkerFloor(before));
  });

  it('does not apply to foreground play: the shared processTick lets starvation go below it', () => {
    const before = starving(80, 0);
    const bus = new EventBus();
    const d = deps(bus, new StarvingResourceSystem(bus, 0.5));
    let s = before;
    for (let i = 0; i < 20; i++) {
      s = processTick(s, d.resourceSystem, d.soldierSystem, d.mapSystem, d.territorySystem, new EventQueue(), 0.05);
    }
    expect(s.resources.workers).toBeLessThan(offlineWorkerFloor(before));
  });
});
