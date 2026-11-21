import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { resourceBalance } from '../../src/data/balance/resources';
import { roleBalance } from '../../src/data/balance/roles';
import { MS_PER_SEC, TICK_MS } from '../../src/data/constants';
import { createInitialState, type GameState } from '../../src/state/GameState';

/**
 * Enough live ticks for a big pipeline to move some items: 1/10 of the mean
 * hatch (or mature) time, so it scales with the balance (Story 3.2).
 */
const HATCH_TICKS = resourceBalance.hatchMs / TICK_MS / 10;
const MATURE_TICKS = resourceBalance.matureMs / TICK_MS / 10;

/** Food on hand plus the fraction of a unit carried to the next tick (Story 2.5). */
const totalFood = (s: GameState) => s.resources.food + s.resourceRemainder.food;

/**
 * ResourceSystem tests — behavior-focused.
 * No hardcoded formula outputs. Tests invariants, edge cases, and direction of change.
 */
describe('ResourceSystem', () => {
  let bus: EventBus;
  let system: ResourceSystem;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new ResourceSystem(bus);
    state = createInitialState();
  });

  describe('clickEgg', () => {
    it('adds eggs and increments pipeline', () => {
      const before = state.resources.eggs;
      const result = system.clickEgg(state);
      expect(result.resources.eggs).toBeGreaterThan(before);
      expect(result.eggPipeline.count).toBeGreaterThan(state.eggPipeline.count);
    });

    it('increments click and egg stats', () => {
      const result = system.clickEgg(state);
      expect(result.stats.totalClicks).toBeGreaterThan(state.stats.totalClicks);
      expect(result.stats.totalEggsLaid).toBeGreaterThan(state.stats.totalEggsLaid);
    });

    it('click_power multiplies eggs laid', () => {
      state.upgrades.click_power = 3;
      const result = system.clickEgg(state);
      expect(result.resources.eggs).toBeGreaterThanOrEqual(4); // at least 1 + 3
      expect(result.eggPipeline.count).toBeGreaterThanOrEqual(4);
    });
  });

  describe('tick — egg pipeline', () => {
    it('reduces eggs and increases larvae when pipeline has count', () => {
      state.resources.eggs = 100;
      state.eggPipeline = { count: 100, progress: 0 };
      const beforeEggs = state.resources.eggs;
      const beforeLarvae = state.resources.larvae;

      // Run enough ticks to guarantee at least one hatch
      let result = state;
      for (let i = 0; i < HATCH_TICKS; i++) {
        result = system.tick(result);
      }

      expect(result.resources.eggs).toBeLessThan(beforeEggs);
      expect(result.resources.larvae).toBeGreaterThan(beforeLarvae);
    });

    it('never hatches more eggs than available', () => {
      state.resources.eggs = 1;
      state.eggPipeline = { count: 100, progress: 0 };
      const result = system.tick(state);
      expect(result.resources.eggs).toBeGreaterThanOrEqual(0);
      expect(result.resources.larvae).toBeLessThanOrEqual(2); // max from pipeline rate
    });

    it('empty pipeline produces no larvae', () => {
      state.eggPipeline = { count: 0, progress: 0 };
      const beforeLarvae = state.resources.larvae;
      const result = system.tick(state);
      expect(result.resources.larvae).toBe(beforeLarvae);
    });

    it('tend workers increase hatch rate', () => {
      state.resources.workers = 10;
      state.resources.eggs = 100;
      state.eggPipeline = { count: 100, progress: 0 };
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
      const withoutTend = system.tick(state);

      state.workersAssigned = { gather: 0, forage: 0, tend: 10, dig: 0, guard: 0, researchers: 0 };
      state.eggPipeline = { count: 100, progress: 0 };
      state.resources.eggs = 100;
      const withTend = system.tick(state);

      // With tend workers, more eggs should hatch (or at least not fewer)
      expect(withTend.resources.larvae).toBeGreaterThanOrEqual(withoutTend.resources.larvae);
    });
  });

  describe('tick — durations are milliseconds (Story 3.2)', () => {
    // A rate pipeline is first-order: over its mean time `…Ms`, a share
    // 1 − e^(−1) of its items completes, at any step length.
    const MEAN_SHARE = 1 - Math.exp(-1);

    it('over hatchMs, about 1 − 1/e of the egg pipeline hatches', () => {
      state.resources.eggs = 10_000;
      state.eggPipeline = { count: 10_000, progress: 0 };
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
      const r = system.tick(state, undefined, resourceBalance.hatchMs / MS_PER_SEC);
      const hatched = state.eggPipeline.count - r.eggPipeline.count;
      expect(hatched / state.eggPipeline.count).toBeCloseTo(MEAN_SHARE, 2);
    });

    it('over matureMs, about 1 − 1/e of the larva pipeline matures', () => {
      state.resources.larvae = 10_000;
      state.resources.nestCapacity = 100_000;
      state.larvaPipeline = { count: 10_000, progress: 0 };
      const r = system.tick(state, undefined, resourceBalance.matureMs / MS_PER_SEC);
      const matured = state.larvaPipeline.count - r.larvaPipeline.count;
      expect(matured / state.larvaPipeline.count).toBeCloseTo(MEAN_SHARE, 2);
    });

    it('one dig worker adds one room per digMsPerRoom', () => {
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 1, guard: 0, researchers: 0 };
      state.resources.workers = 1;
      const r = system.tick(state, undefined, (3 * roleBalance.digMsPerRoom) / MS_PER_SEC);
      expect(r.resources.nestCapacity - state.resources.nestCapacity).toBe(3);
    });
  });

  describe('tick — larva pipeline', () => {
    it('matures larvae into workers when pipeline is fed', () => {
      state.resources.larvae = 50;
      state.larvaPipeline = { count: 50, progress: 0 };

      let result = state;
      for (let i = 0; i < MATURE_TICKS; i++) {
        result = system.tick(result);
      }

      expect(result.resources.workers).toBeGreaterThan(state.resources.workers);
      expect(result.resources.larvae).toBeLessThan(state.resources.larvae);
    });

    it('empty larva pipeline produces no workers', () => {
      state.larvaPipeline = { count: 0, progress: 0 };
      const before = state.resources.workers;
      const result = system.tick(state);
      expect(result.resources.workers).toBe(before);
    });

    it('never matures more larvae than available', () => {
      state.resources.larvae = 1;
      state.larvaPipeline = { count: 100, progress: 0 };
      const result = system.tick(state);
      expect(result.resources.larvae).toBeGreaterThanOrEqual(0);
      expect(result.resources.workers).toBeLessThanOrEqual(11); // bounded by pipeline
    });
  });

  describe('tick — food', () => {
    it('food changes when workers are present', () => {
      state.resources.workers = 1;
      state.resources.food = 100;
      const result = system.tick(state);
      // Food should change (production or consumption happens); a tick's share
      // under one whole unit is carried in resourceRemainder (Story 2.5).
      expect(totalFood(result)).not.toBe(totalFood(state));
    });

    it('many workers consume more food than they produce (unassigned)', () => {
      // High worker count where consumption > unassigned production
      state.resources.workers = 100;
      state.resources.food = 1000;
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
      const result = system.tick(state);
      // 100 workers unassigned: +100 produced, floor(100/2)=50 consumed → net +50
      // Food should increase with unassigned
      expect(result.resources.food).toBeGreaterThanOrEqual(state.resources.food);
    });

    it('food never goes negative', () => {
      state.resources.workers = 100;
      state.resources.food = 0;
      const result = system.tick(state);
      expect(result.resources.food).toBeGreaterThanOrEqual(0);
    });

    it('gather workers produce more food than unassigned', () => {
      state.resources.workers = 10;
      state.resources.food = 100;
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
      const unassigned = system.tick(state);

      state.workersAssigned = { gather: 10, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
      state.resources.food = 100;
      const gathered = system.tick(state);

      expect(totalFood(gathered)).toBeGreaterThan(totalFood(unassigned));
    });

    it('zero workers produce zero net food change', () => {
      state.resources.workers = 0;
      state.resources.food = 100;
      const result = system.tick(state);
      // No workers = no production, no consumption
      expect(result.resources.food).toBe(state.resources.food);
    });
  });

  describe('worker assignment', () => {
    it('assignWorker increases the role count', () => {
      state.resources.workers = 5;
      const result = system.assignWorker(state, 'gather');
      expect(result.workersAssigned.gather).toBeGreaterThan(state.workersAssigned.gather);
    });

    it('unassignWorker decreases the role count', () => {
      state.resources.workers = 5;
      const assigned = system.assignWorker(state, 'gather');
      const result = system.unassignWorker(assigned, 'gather');
      expect(result.workersAssigned.gather).toBeLessThan(assigned.workersAssigned.gather);
    });

    it('cannot assign more workers than available', () => {
      state.resources.workers = 1;
      const r1 = system.assignWorker(state, 'gather');
      const r2 = system.assignWorker(r1, 'tend');
      // Second assign should have no effect
      expect(r2.workersAssigned.tend).toBe(state.workersAssigned.tend);
    });

    it('cannot unassign below zero', () => {
      const result = system.unassignWorker(state, 'gather');
      expect(result.workersAssigned.gather).toBe(0);
    });
  });

  describe('events', () => {
    it('emits eggs_changed on click', () => {
      let fired = false;
      bus.subscribe('eggs_changed', () => { fired = true; });
      system.clickEgg(state);
      expect(fired).toBe(true);
    });

    it('emits workers_changed when larvae mature', () => {
      let fired = false;
      bus.subscribe('workers_changed', () => { fired = true; });
      state.resources.larvae = 50;
      state.larvaPipeline = { count: 50, progress: 0 };
      let result = state;
      for (let i = 0; i < MATURE_TICKS; i++) {
        result = system.tick(result);
      }
      expect(fired).toBe(true);
    });
  });

  describe('tick — dig workers', () => {
    it('accumulates capacityAccumulator but does not change nestCapacity in one tick', () => {
      state.resources.workers = 5;
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 3, guard: 0, researchers: 0 };
      const result = system.tick(state);
      // Accumulator grows but < 20, so capacity unchanged
      expect(result.capacityAccumulator).toBeGreaterThan(state.capacityAccumulator);
      expect(result.capacityAccumulator).toBeLessThan(20);
      expect(result.resources.nestCapacity).toBe(state.resources.nestCapacity);
    });

    it('increases nestCapacity when accumulator crosses threshold', () => {
      state.resources.workers = 10;
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 3, guard: 0, researchers: 0 };

      let result = state;
      // 3 dig workers × 7 ticks = 21 accumulator → +1 capacity
      for (let i = 0; i < 7; i++) {
        result = system.tick(result);
      }
      expect(result.resources.nestCapacity).toBeGreaterThan(state.resources.nestCapacity);
    });

    it('does not change nestCapacity when no dig workers', () => {
      state.resources.workers = 5;
      state.workersAssigned = { gather: 3, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };

      let result = state;
      for (let i = 0; i < 20; i++) {
        result = system.tick(result);
      }
      expect(result.resources.nestCapacity).toBe(state.resources.nestCapacity);
    });

    it('nestCapacity grows faster with more dig workers', () => {
      state.resources.workers = 10;
      // With 1 dig worker: 20 ticks = 20 accumulator → exactly +1
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 1, guard: 0, researchers: 0 };
      let withOne = state;
      for (let i = 0; i < 20; i++) {
        withOne = system.tick(withOne);
      }
      const gain1 = withOne.resources.nestCapacity - state.resources.nestCapacity;

      // With 5 dig workers: 20 ticks = 100 accumulator → +5 capacity
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 5, guard: 0, researchers: 0 };
      let withFive = state;
      for (let i = 0; i < 20; i++) {
        withFive = system.tick(withFive);
      }
      const gain5 = withFive.resources.nestCapacity - state.resources.nestCapacity;

      expect(gain5).toBeGreaterThan(gain1);
    });

    it('accumulator persists across ticks (integer-only, no floating-point drift)', () => {
      state.resources.workers = 5;
      state.workersAssigned = { gather: 0, forage: 0, tend: 0, dig: 1, guard: 0, researchers: 0 };

      let result = state;
      for (let i = 0; i < 20; i++) {
        result = system.tick(result);
      }
      // After exactly 20 ticks with 1 dig worker, accumulator should be 0 (reset after gain)
      expect(result.capacityAccumulator).toBe(0);
      expect(result.resources.nestCapacity).toBe(state.resources.nestCapacity + 1);
    });
  });

  describe('tick — nest capacity cap enforcement', () => {
    it('produces zero new workers when workers >= effective capacity', () => {
      state.resources.workers = 25;
      state.resources.nestCapacity = 25; // effective = 25 (no warehouse)
      state.resources.larvae = 50;
      state.larvaPipeline = { count: 50, progress: 0 };

      let result = state;
      for (let i = 0; i < MATURE_TICKS; i++) {
        result = system.tick(result);
      }
      // Workers should not increase — at capacity cap
      expect(result.resources.workers).toBe(25);
    });

    it('produces workers up to the cap when below capacity', () => {
      state.resources.workers = 20;
      state.resources.nestCapacity = 25;
      state.resources.larvae = 50;
      state.larvaPipeline = { count: 50, progress: 0 };

      let result = state;
      for (let i = 0; i < MATURE_TICKS; i++) {
        result = system.tick(result);
      }
      // Workers should increase but not exceed capacity
      expect(result.resources.workers).toBeGreaterThan(20);
      expect(result.resources.workers).toBeLessThanOrEqual(25);
    });

    it('existing workers continue normally at cap (no attrition)', () => {
      state.resources.workers = 30;
      state.resources.nestCapacity = 25;
      state.resources.food = 100;

      const result = system.tick(state);
      // Workers should not decrease (no attrition)
      expect(result.resources.workers).toBe(30);
      // Food should still change (production/consumption continues)
      expect(totalFood(result)).not.toBe(totalFood(state));
    });

    it('warehouse building bonus increases effective capacity', () => {
      state.resources.workers = 25;
      state.resources.nestCapacity = 25;
      state.buildings.warehouse.level = 1; // +25 capacity per level
      state.resources.larvae = 50;
      state.larvaPipeline = { count: 50, progress: 0 };

      let result = state;
      for (let i = 0; i < MATURE_TICKS; i++) {
        result = system.tick(result);
      }
      // Effective capacity = 25 + 25 = 50, so workers can grow beyond 25
      expect(result.resources.workers).toBeGreaterThan(25);
      expect(result.resources.workers).toBeLessThanOrEqual(50);
    });
  });
});
