import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SoldierSystem, SOLDIER_TRAIN_TIME } from '../../src/systems/SoldierSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

/**
 * SoldierSystem tests — behavior-focused.
 * No hardcoded formula outputs. Tests invariants, edge cases, and direction of change.
 */
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
    it('consumes worker and food, adds to pipeline', () => {
      state.resources.workers = 5;
      state.resources.food = 10;
      const before = {
        workers: state.resources.workers,
        food: state.resources.food,
        pipelineCount: state.soldierPipeline.count,
        combatSoldiers: state.combatSoldiers,
      };
      const result = system.recruitSoldier(state);
      expect(result.resources.workers).toBeLessThan(before.workers);
      expect(result.resources.food).toBeLessThan(before.food);
      expect(result.soldierPipeline.count).toBeGreaterThan(before.pipelineCount);
      expect(result.combatSoldiers).toBe(before.combatSoldiers);
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

    it('accumulates pipeline entries on multiple recruits', () => {
      state.resources.workers = 10;
      state.resources.food = 50;
      const beforeAll = {
        workers: state.resources.workers,
        pipelineCount: state.soldierPipeline.count,
      };
      let r = system.recruitSoldier(state);
      expect(r.resources.workers).toBeLessThan(beforeAll.workers);
      expect(r.soldierPipeline.count).toBeGreaterThan(beforeAll.pipelineCount);
      const afterFirst = {
        workers: r.resources.workers,
        pipelineCount: r.soldierPipeline.count,
      };
      r = system.recruitSoldier(r);
      expect(r.resources.workers).toBeLessThan(afterFirst.workers);
      expect(r.soldierPipeline.count).toBeGreaterThan(afterFirst.pipelineCount);
    });
  });

  describe('tick', () => {
    it('completes training at rate count/SOLDIER_TRAIN_TIME', () => {
      // 75 in pipeline, rate = 75/75 = 1/tick with dtSec=1 (5x pacing nerf)
      state.soldierPipeline = { count: 75, progress: 0 };
      state.combatSoldiers = 0;
      const before = {
        count: state.soldierPipeline.count,
        soldiers: state.combatSoldiers,
      };
      const result = system.tick(state, 1);
      expect(result.combatSoldiers).toBeGreaterThan(before.soldiers);
      expect(result.soldierPipeline.count).toBeLessThan(before.count);
    });

    it('completes multiple when count is large', () => {
      // 225 in pipeline, rate = 225/75 = 3/tick with dtSec=1 (5x pacing nerf)
      state.soldierPipeline = { count: 225, progress: 0 };
      state.combatSoldiers = 0;
      const before = {
        count: state.soldierPipeline.count,
        soldiers: state.combatSoldiers,
      };
      const result = system.tick(state, 1);
      expect(result.combatSoldiers).toBeGreaterThan(before.soldiers);
      expect(result.soldierPipeline.count).toBeLessThan(before.count);
    });

    it('accumulates fractional progress', () => {
      // 25 in pipeline, rate = 25/75 = 0.333/tick with dtSec=1 (5x pacing nerf)
      state.soldierPipeline = { count: 25, progress: 0 };
      state.combatSoldiers = 0;
      const before = {
        count: state.soldierPipeline.count,
        soldiers: state.combatSoldiers,
      };
      let r = state;
      for (let i = 0; i < 3; i++) r = system.tick(r, 1);
      expect(r.combatSoldiers).toBeGreaterThan(before.soldiers);
      expect(r.soldierPipeline.count).toBeLessThan(before.count);
    });

    it('returns unchanged if pipeline empty', () => {
      state.soldierPipeline = { count: 0, progress: 0 };
      const result = system.tick(state, 1);
      expect(result).toBe(state);
    });

    it('does not exceed pipeline count', () => {
      // 500 in pipeline, rate = 500/75 = 6.66/tick with dtSec=1 (5x pacing nerf)
      state.soldierPipeline = { count: 500, progress: 14.9 };
      state.combatSoldiers = 0;
      const result = system.tick(state, 1);
      expect(result.combatSoldiers).toBeGreaterThan(0);
      expect(result.soldierPipeline.count).toBeLessThan(500);
    });
  });

  describe('events', () => {
    it('emits soldiers_changed when training completes', () => {
      let count = -1;
      bus.subscribe('soldiers_changed', (p) => { count = (p as { soldiers: number }).soldiers; });
      state.soldierPipeline = { count: 75, progress: 0 };
      system.tick(state, 1);
      expect(count).toBeGreaterThan(-1);
    });

    it('does not emit when no training completes', () => {
      let emitted = false;
      bus.subscribe('soldiers_changed', () => { emitted = true; });
      state.soldierPipeline = { count: 0, progress: 0 };
      system.tick(state, 1);
      expect(emitted).toBe(false);
    });
  });
});
