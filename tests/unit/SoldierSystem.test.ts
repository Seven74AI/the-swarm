import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SoldierSystem, SOLDIER_TRAIN_TIME } from '../../src/systems/SoldierSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('SoldierSystem — pipeline-based', () => {
  let bus: EventBus;
  let system: SoldierSystem;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new SoldierSystem(bus);
    state = createInitialState();
  });

  describe('recruitSoldier', () => {
    it('converts 1 worker to pipeline entry', () => {
      state.resources.workers = 5;
      state.resources.food = 10;
      const result = system.recruitSoldier(state);
      expect(result.resources.workers).toBe(4);
      expect(result.resources.food).toBe(5);
      expect(result.soldierPipeline.count).toBe(1);
      expect(result.combatSoldiers).toBe(0);
    });

    it('returns unchanged if no workers', () => {
      state.resources.workers = 0;
      const result = system.recruitSoldier(state);
      expect(result).toBe(state);
    });

    it('returns unchanged if not enough food', () => {
      state.resources.workers = 5;
      state.resources.food = 1;
      const result = system.recruitSoldier(state);
      expect(result).toBe(state);
    });

    it('accumulates pipeline entries', () => {
      state.resources.workers = 10;
      state.resources.food = 50;
      let r = system.recruitSoldier(state);
      r = system.recruitSoldier(r);
      expect(r.resources.workers).toBe(8);
      expect(r.soldierPipeline.count).toBe(2);
    });
  });

  describe('tick', () => {
    it('completes training at rate count/SOLDIER_TRAIN_TIME', () => {
      // 15 in pipeline, 15 tick training → 1/tick
      state.soldierPipeline = { count: 15, progress: 0 };
      state.combatSoldiers = 0;
      const result = system.tick(state);
      expect(result.combatSoldiers).toBe(1);
      expect(result.soldierPipeline.count).toBe(14);
    });

    it('completes multiple when count is large', () => {
      // 45 in pipeline, rate = 45/15 = 3/tick
      state.soldierPipeline = { count: 45, progress: 0 };
      state.combatSoldiers = 0;
      const result = system.tick(state);
      expect(result.combatSoldiers).toBe(3);
      expect(result.soldierPipeline.count).toBe(42);
    });

    it('accumulates fractional progress', () => {
      // 5 in pipeline, rate = 5/15 = 0.333/tick
      state.soldierPipeline = { count: 5, progress: 0 };
      state.combatSoldiers = 0;

      // 3 ticks → progress = 1.0 → 1 soldier
      let r = state;
      for (let i = 0; i < 3; i++) r = system.tick(r);
      expect(r.combatSoldiers).toBe(1);
      expect(r.soldierPipeline.count).toBe(4);
    });

    it('returns unchanged if pipeline empty', () => {
      state.soldierPipeline = { count: 0, progress: 0 };
      const result = system.tick(state);
      expect(result).toBe(state);
    });

    it('does not exceed pipeline count', () => {
      // 100 in pipeline, rate = 100/15 = 6.66/tick, but only 100 max
      state.soldierPipeline = { count: 100, progress: 14.9 };
      state.combatSoldiers = 0;
      const result = system.tick(state);
      // progress becomes 14.9 + 6.66 = 21.56, floor = 21
      // but capped at count=100, so 21
      expect(result.combatSoldiers).toBeGreaterThan(0);
      expect(result.soldierPipeline.count).toBeLessThan(100);
    });
  });

  describe('events', () => {
    it('emits soldiers_changed when training completes', () => {
      let count = -1;
      bus.subscribe('soldiers_changed', (p) => { count = (p as { soldiers: number }).soldiers; });
      state.soldierPipeline = { count: 15, progress: 0 };
      system.tick(state);
      expect(count).toBe(1);
    });

    it('does not emit when no training completes', () => {
      let emitted = false;
      bus.subscribe('soldiers_changed', () => { emitted = true; });
      state.soldierPipeline = { count: 0, progress: 0 };
      system.tick(state);
      expect(emitted).toBe(false);
    });
  });
});
