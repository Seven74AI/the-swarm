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
      // Timers are sorted before processing, so order may differ
      const sorted = [...result.eggHatchTimers].sort((a, b) => a - b);
      expect(sorted).toEqual([2, 4]);
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

    it('emits eggs_changed when eggs hatch during tick', () => {
      let emitted = false;
      bus.subscribe('eggs_changed', () => { emitted = true; });
      state.eggHatchTimers = [1];
      state.resources.eggs = 1;
      system.tick(state);
      expect(emitted).toBe(true);
    });

    it('does not emit eggs_changed when no eggs hatch', () => {
      let emitted = false;
      bus.subscribe('eggs_changed', () => { emitted = true; });
      state.eggHatchTimers = [];
      state.resources.eggs = 0;
      system.tick(state);
      expect(emitted).toBe(false);
    });

    it('emits larvae_changed when eggs hatch into larvae', () => {
      let emitted = false;
      bus.subscribe('larvae_changed', () => { emitted = true; });
      state.eggHatchTimers = [1];
      state.resources.eggs = 1;
      system.tick(state);
      expect(emitted).toBe(true);
    });

    it('emits larvae_changed when larva matures into worker', () => {
      let emitted = false;
      bus.subscribe('larvae_changed', () => { emitted = true; });
      state.larvaMatureTimers = [1];
      state.resources.larvae = 1;
      system.tick(state);
      expect(emitted).toBe(true);
    });

    it('does not emit larvae_changed when no larvae change', () => {
      let emitted = false;
      bus.subscribe('larvae_changed', () => { emitted = true; });
      state.eggHatchTimers = [];
      state.larvaMatureTimers = [];
      state.resources.eggs = 0;
      state.resources.larvae = 0;
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

  describe('worker assignment', () => {
    it('assignWorker moves an unassigned worker to a role', () => {
      state.resources.workers = 5;
      const result = system.assignWorker(state, 'gather');
      expect(result.workersAssigned.gather).toBe(1);
      expect(result.workersAssigned.tend).toBe(0);
    });

    it('assignWorker cannot assign more workers than available', () => {
      state.resources.workers = 1;
      state.workersAssigned = { gather: 1, tend: 0, dig: 0, guard: 0 };
      const result = system.assignWorker(state, 'gather');
      // All workers already assigned, should return unchanged
      expect(result).toBe(state);
    });

    it('unassignWorker moves a worker back from role', () => {
      state.resources.workers = 5;
      state.workersAssigned = { gather: 2, tend: 0, dig: 0, guard: 0 };
      const result = system.unassignWorker(state, 'gather');
      expect(result.workersAssigned.gather).toBe(1);
    });

    it('unassignWorker cannot go below 0', () => {
      state.resources.workers = 1;
      const result = system.unassignWorker(state, 'gather');
      expect(result.workersAssigned.gather).toBe(0);
    });

    it('assigned gather workers produce +2 food/tick instead of +1', () => {
      state.resources.workers = 3;
      state.resources.food = 100;
      state.workersAssigned = { gather: 3, tend: 0, dig: 0, guard: 0 };
      // 3 gather: 3 * 2 = 6 produced, 3 * 0.5 = 1.5 consumed, net = 4.5
      const result = system.tick(state);
      expect(result.resources.food).toBe(104.5);
    });

    it('assigned tend workers hasten egg hatching', () => {
      state.resources.workers = 2;
      state.resources.eggs = 3;
      state.eggHatchTimers = [5, 4, 3];
      state.workersAssigned = { gather: 0, tend: 2, dig: 0, guard: 0 };
      // 2 tend workers → 2 eggs get double decremented
      // Without tend: timers become [4, 3, 2]
      // With 2 tend: 2 lowest timers get extra -1: [4, 2, 1]
      const result = system.tick(state);
      // Sort for stable assertion
      const sorted = [...result.eggHatchTimers].sort((a, b) => a - b);
      expect(sorted).toEqual([1, 2, 4]);
    });

    it('tend workers only affect as many eggs as available', () => {
      state.resources.workers = 5;
      state.resources.eggs = 1;
      state.eggHatchTimers = [5];
      state.workersAssigned = { gather: 0, tend: 5, dig: 0, guard: 0 };
      // Only 1 egg, 5 tend workers: egg gets -2 (extra -1 from one tend)
      const result = system.tick(state);
      expect(result.eggHatchTimers).toEqual([3]); // 5 - 1 - 1 = 3
    });

    it('mixed gather and tend workers produce correctly', () => {
      state.resources.workers = 5;
      state.resources.food = 100;
      state.resources.eggs = 2;
      state.eggHatchTimers = [5, 5];
      state.workersAssigned = { gather: 3, tend: 2, dig: 0, guard: 0 };
      // Gather: 3 * 2 = 6 produced
      // Unassigned: 0
      // Total produced: 6, consumed: 5 * 0.5 = 2.5, net food = +3.5
      // Tend: 2 eggs get extra -1: both eggs become 5 - 1 - 1 = 3
      const result = system.tick(state);
      expect(result.resources.food).toBe(103.5);
      const sortedTimers = [...result.eggHatchTimers].sort((a, b) => a - b);
      expect(sortedTimers).toEqual([3, 3]);
    });
  });
});

describe('Phase 3 resource defaults', () => {
  it('initializes expansion resources to 0', () => {
    const state = createInitialState();
    expect(state.resources.wood).toBe(0);
    expect(state.resources.stone).toBe(0);
    expect(state.resources.nectar).toBe(0);
  });

  it('keeps existing resource keys unchanged', () => {
    const state = createInitialState();
    expect(state.resources.eggs).toBe(0);
    expect(state.resources.larvae).toBe(0);
    expect(state.resources.workers).toBe(0);
    expect(state.resources.food).toBe(0);
    expect(state.resources.nestCapacity).toBe(25);
  });

  it('new resources are typed as numbers', () => {
    const state = createInitialState();
    expect(typeof state.resources.wood).toBe('number');
    expect(typeof state.resources.stone).toBe('number');
    expect(typeof state.resources.nectar).toBe('number');
  });
});

describe('BuildingSystem integration', () => {
  it('getEffectiveNestCapacity includes warehouse bonus', () => {
    const bus = new EventBus();
    const system = new ResourceSystem(bus);
    const state = createInitialState();

    // No warehouse → base capacity
    expect(system.getEffectiveNestCapacity(state)).toBe(25);

    // Warehouse level 1 → +25
    const stateWithWarehouse: GameState = {
      ...state,
      buildings: { ...state.buildings, warehouse: { level: 1 } },
    };
    expect(system.getEffectiveNestCapacity(stateWithWarehouse)).toBe(50);

    // Warehouse level 2 → +50
    const stateWithWarehouse2: GameState = {
      ...state,
      buildings: { ...state.buildings, warehouse: { level: 2 } },
    };
    expect(system.getEffectiveNestCapacity(stateWithWarehouse2)).toBe(75);
  });

  it('getEffectiveNestCapacity handles missing warehouse building', () => {
    const bus = new EventBus();
    const system = new ResourceSystem(bus);
    const state = createInitialState();
    // buildings.warehouse defaults to level 0
    expect(system.getEffectiveNestCapacity(state)).toBe(25);
  });
});
