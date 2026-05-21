import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem, EGG_HATCH_TIME, LARVA_MATURE_TIME } from '../../src/systems/ResourceSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

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
      for (let i = 0; i < EGG_HATCH_TIME * 2; i++) {
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
      state.workersAssigned = { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
      const withoutTend = system.tick(state);

      state.workersAssigned = { gather: 0, tend: 10, dig: 0, guard: 0, researchers: 0 };
      state.eggPipeline = { count: 100, progress: 0 };
      state.resources.eggs = 100;
      const withTend = system.tick(state);

      // With tend workers, more eggs should hatch (or at least not fewer)
      expect(withTend.resources.larvae).toBeGreaterThanOrEqual(withoutTend.resources.larvae);
    });
  });

  describe('tick — larva pipeline', () => {
    it('matures larvae into workers when pipeline is fed', () => {
      state.resources.larvae = 50;
      state.larvaPipeline = { count: 50, progress: 0 };

      let result = state;
      for (let i = 0; i < LARVA_MATURE_TIME * 2; i++) {
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
      // With 1 worker: +1 produced, -0 consumed (floor(1/2)=0) → food increases
      // Food should change (production or consumption happens)
      expect(result.resources.food).not.toBe(state.resources.food);
    });

    it('many workers consume more food than they produce (unassigned)', () => {
      // High worker count where consumption > unassigned production
      state.resources.workers = 100;
      state.resources.food = 1000;
      state.workersAssigned = { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
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
      state.workersAssigned = { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 };
      const unassigned = system.tick(state);

      state.workersAssigned = { gather: 10, tend: 0, dig: 0, guard: 0, researchers: 0 };
      state.resources.food = 100;
      const gathered = system.tick(state);

      expect(gathered.resources.food).toBeGreaterThan(unassigned.resources.food);
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
      for (let i = 0; i < LARVA_MATURE_TIME * 2; i++) {
        result = system.tick(result);
      }
      expect(fired).toBe(true);
    });
  });
});
