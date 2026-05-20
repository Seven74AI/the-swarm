import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem, EGG_HATCH_TIME, LARVA_MATURE_TIME } from '../../src/systems/ResourceSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ResourceSystem — pipeline-based', () => {
  let bus: EventBus;
  let system: ResourceSystem;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new ResourceSystem(bus);
    state = createInitialState();
  });

  describe('clickEgg', () => {
    it('adds 1 egg and 1 to egg pipeline', () => {
      const result = system.clickEgg(state);
      expect(result.resources.eggs).toBe(1);
      expect(result.eggPipeline.count).toBe(1);
      expect(result.eggPipeline.progress).toBe(0);
    });

    it('increments totalClicks and totalEggsLaid', () => {
      const result = system.clickEgg(state);
      expect(result.stats.totalClicks).toBe(1);
      expect(result.stats.totalEggsLaid).toBe(1);
    });

    it('multiple eggs per click with click_power', () => {
      state.upgrades.click_power = 2;
      const result = system.clickEgg(state);
      expect(result.resources.eggs).toBe(3);
      expect(result.eggPipeline.count).toBe(3);
    });

    it('accumulates pipeline count on repeated clicks', () => {
      let s = system.clickEgg(state);
      s = system.clickEgg(s);
      expect(s.resources.eggs).toBe(2);
      expect(s.eggPipeline.count).toBe(2);
    });
  });

  describe('tick — egg pipeline', () => {
    it('hatches eggs at rate count/EGG_HATCH_TIME', () => {
      // 10 eggs, 10 tick hatch time → 1 egg/tick
      state.resources.eggs = 10;
      state.eggPipeline = { count: 10, progress: 0 };

      const result = system.tick(state);
      expect(result.resources.eggs).toBe(9);
      expect(result.resources.larvae).toBe(1);
      expect(result.eggPipeline.count).toBe(9);
    });

    it('hatches multiple eggs when count is large', () => {
      state.resources.eggs = 30;
      state.eggPipeline = { count: 30, progress: 0 };

      const result = system.tick(state);
      // 30/10 = 3 eggs/tick
      expect(result.resources.eggs).toBe(27);
      expect(result.resources.larvae).toBe(3);
      expect(result.eggPipeline.count).toBe(27);
    });

    it('accumulates fractional progress for next tick', () => {
      // 3 eggs → rate = 3/10 = 0.3/tick
      state.resources.eggs = 3;
      state.eggPipeline = { count: 3, progress: 0 };

      // Tick 1: progress = 0.3, floor = 0, no hatch
      let r = system.tick(state);
      expect(r.resources.eggs).toBe(3);
      expect(r.eggPipeline.progress).toBe(0.3);

      // Tick 2: progress = 0.3 + 0.3 = 0.6, floor = 0
      r = system.tick(r);
      expect(r.eggPipeline.progress).toBe(0.6);

      // Tick 3: progress = 0.6 + 0.3 = 0.9, floor = 0
      r = system.tick(r);
      expect(r.eggPipeline.progress).toBeCloseTo(0.9);

      // Tick 4: progress = 0.9 + 0.3 = 1.2, floor = 1
      r = system.tick(r);
      expect(r.resources.eggs).toBe(2);
      expect(r.resources.larvae).toBe(1);
      expect(r.eggPipeline.progress).toBeCloseTo(0.2);
      expect(r.eggPipeline.count).toBe(2);
    });

    it('tend workers boost hatch rate by +25% each', () => {
      state.resources.workers = 4;
      state.resources.eggs = 10;
      state.eggPipeline = { count: 10, progress: 0 };
      state.workersAssigned = { gather: 0, tend: 4, dig: 0, guard: 0 };

      const result = system.tick(state);
      // Rate = 10/10 * (1 + 4*0.25) = 1 * 2 = 2 → 2 eggs hatch
      expect(result.resources.larvae).toBe(2);
      expect(result.eggPipeline.count).toBe(8);
    });

    it('empty pipeline does nothing', () => {
      state.eggPipeline = { count: 0, progress: 0 };
      const result = system.tick(state);
      expect(result.resources.eggs).toBe(0);
      expect(result.resources.larvae).toBe(0);
    });
  });

  describe('tick — larva pipeline', () => {
    it('matures larvae at rate count/LARVA_MATURE_TIME', () => {
      state.resources.larvae = 10;
      state.larvaPipeline = { count: 10, progress: 0 };

      const result = system.tick(state);
      expect(result.resources.larvae).toBe(9);
      expect(result.resources.workers).toBe(1);
      expect(result.larvaPipeline.count).toBe(9);
    });

    it('empty larva pipeline does nothing', () => {
      state.larvaPipeline = { count: 0, progress: 0 };
      state.resources.workers = 0;
      const result = system.tick(state);
      expect(result.resources.workers).toBe(0);
    });
  });

  describe('tick — food', () => {
    it('workers produce food', () => {
      state.resources.workers = 3;
      state.resources.food = 0;
      const result = system.tick(state);
      // 3 unassigned = 3 * 1 = 3, consumed = 3 * 0.5 = 1.5, net = +1.5
      expect(result.resources.food).toBe(2);
    });

    it('gather workers produce 2 food each', () => {
      state.resources.workers = 3;
      state.resources.food = 100;
      state.workersAssigned = { gather: 3, tend: 0, dig: 0, guard: 0 };
      const result = system.tick(state);
      // 3 gather * 2 = 6, consumed = 1.5, net = +4.5
      expect(result.resources.food).toBe(105);
    });
  });

  describe('events', () => {
    it('emits eggs_changed on click', () => {
      let eggs = 0;
      bus.subscribe('eggs_changed', (p) => { eggs = (p as { eggs: number }).eggs; });
      system.clickEgg(state);
      expect(eggs).toBe(1);
    });

    it('emits workers_changed when larva matures', () => {
      let workers = 0;
      bus.subscribe('workers_changed', (p) => { workers = (p as { workers: number }).workers; });
      state.resources.larvae = 10;
      state.larvaPipeline = { count: 10, progress: 0 };
      system.tick(state);
      expect(workers).toBe(1);
    });
  });
});
