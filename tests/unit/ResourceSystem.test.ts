import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ResourceSystem', () => {
  let system: ResourceSystem;
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new ResourceSystem(bus);
    state = createInitialState();
  });

  describe('clickEgg', () => {
    it('increments eggs by 1', () => {
      const result = system.clickEgg(state);
      expect(result.resources.eggs).toBe(1);
    });

    it('adds a 5-tick hatch timer', () => {
      const result = system.clickEgg(state);
      expect(result.eggHatchTimers).toEqual([5]);
    });

    it('increments totalEggsLaid stat', () => {
      const result = system.clickEgg(state);
      expect(result.stats.totalEggsLaid).toBe(1);
    });

    it('increments totalClicks stat', () => {
      const result = system.clickEgg(state);
      expect(result.stats.totalClicks).toBe(1);
    });

    it('emits eggs_changed event', () => {
      let emitted = false;
      bus.subscribe('eggs_changed', () => { emitted = true; });
      system.clickEgg(state);
      expect(emitted).toBe(true);
    });

    it('multiple clicks accumulate eggs and timers', () => {
      let result = system.clickEgg(state);
      result = system.clickEgg(result);
      expect(result.resources.eggs).toBe(2);
      expect(result.eggHatchTimers).toEqual([5, 5]);
      expect(result.stats.totalClicks).toBe(2);
    });
  });

  describe('tick', () => {
    it('decrements egg hatch timers by 1', () => {
      state.eggHatchTimers = [5, 3];
      state.resources.eggs = 2;
      const result = system.tick(state);
      expect(result.eggHatchTimers).toEqual([4, 2]);
    });

    it('hatches egg when timer reaches 0', () => {
      state.eggHatchTimers = [1];
      state.resources.eggs = 1;
      const result = system.tick(state);
      expect(result.eggHatchTimers).toEqual([]);
      expect(result.resources.eggs).toBe(0);
      expect(result.resources.larvae).toBe(1);
      expect(result.larvaMatureTimers).toEqual([10]);
    });

    it('decrements larva mature timers by 1', () => {
      state.larvaMatureTimers = [10, 5];
      state.resources.larvae = 2;
      const result = system.tick(state);
      expect(result.larvaMatureTimers).toEqual([9, 4]);
    });

    it('matures larva into worker when timer reaches 0', () => {
      state.larvaMatureTimers = [1];
      state.resources.larvae = 1;
      const result = system.tick(state);
      expect(result.larvaMatureTimers).toEqual([]);
      expect(result.resources.larvae).toBe(0);
      expect(result.resources.workers).toBe(1);
    });

    it('workers produce 1 food each per tick (net of consumption)', () => {
      state.resources.workers = 3;
      state.resources.food = 0;
      const result = system.tick(state);
      // 3 produced, 1.5 consumed = net 1.5
      expect(result.resources.food).toBe(1.5);
    });

    it('workers consume 0.5 food each per tick', () => {
      state.resources.workers = 4;
      state.resources.food = 10;
      const result = system.tick(state);
      // 4 workers * 0.5 = 2 consumed, 4 produced = net +2
      expect(result.resources.food).toBe(12);
    });

    it('food never goes below 0', () => {
      state.resources.workers = 10;
      state.resources.food = 0;
      const result = system.tick(state);
      // 10 produced, 5 consumed, but production is added first so net is 5
      expect(result.resources.food).toBe(5);
    });

    it('emits workers_changed when new worker matures', () => {
      let emitted = false;
      bus.subscribe('workers_changed', () => { emitted = true; });
      state.larvaMatureTimers = [1];
      state.resources.larvae = 1;
      system.tick(state);
      expect(emitted).toBe(true);
    });

    it('emits food_changed when workers produce/consume', () => {
      let emitted = false;
      bus.subscribe('food_changed', () => { emitted = true; });
      state.resources.workers = 1;
      system.tick(state);
      expect(emitted).toBe(true);
    });

    it('does not emit workers_changed when no worker matures', () => {
      let emitted = false;
      bus.subscribe('workers_changed', () => { emitted = true; });
      system.tick(state);
      expect(emitted).toBe(false);
    });
  });

  describe('buyUpgrade', () => {
    it('deducts food for upgrade cost', () => {
      state.resources.food = 100;
      state.upgrades = { click_power: 0 };
      const result = system.buyUpgrade(state, 'click_power');
      // Cost: 10 * 1.15^0 = 10
      expect(result.resources.food).toBe(90);
    });

    it('increments upgrade level', () => {
      state.resources.food = 100;
      state.upgrades = { click_power: 0 };
      const result = system.buyUpgrade(state, 'click_power');
      expect(result.upgrades.click_power).toBe(1);
    });

    it('cannot buy upgrade without sufficient food', () => {
      state.resources.food = 5;
      state.upgrades = { click_power: 0 };
      const result = system.buyUpgrade(state, 'click_power');
      // Should return unchanged state
      expect(result).toBe(state);
      expect(result.resources.food).toBe(5);
    });

    it('emits upgrade_purchased event', () => {
      let emitted = false;
      bus.subscribe('upgrade_purchased', () => { emitted = true; });
      state.resources.food = 100;
      state.upgrades = { click_power: 0 };
      system.buyUpgrade(state, 'click_power');
      expect(emitted).toBe(true);
    });

    it('upgrade cost scales with level', () => {
      state.resources.food = 1000;
      state.upgrades = { click_power: 5 };
      const result = system.buyUpgrade(state, 'click_power');
      // Cost: 10 * 1.15^5 = 10 * 2.011... = 20, floor = 20
      expect(result.resources.food).toBe(980);
    });
  });
});
