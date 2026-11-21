import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { MS_PER_SEC } from '../../src/data/constants';

/** Pipeline size at which about one soldier completes a second. */
const ONE_PER_SEC = soldierBalance.trainMs / MS_PER_SEC;
import { createInitialState, type GameState } from '../../src/state/GameState';

/**
 * SoldierSystem tests — behavior-focused.
 * No hardcoded formula outputs. Tests invariants, edge cases, and direction of change.
 * Updated: weapon uses chitin, armor uses silk, building gates added.
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
    it('over trainMs, about 1 − 1/e of the pipeline trains (durations are ms, Story 3.2)', () => {
      state.soldierPipeline = { count: 10_000, progress: 0 };
      state.combatSoldiers = 0;
      const r = system.tick(state, soldierBalance.trainMs / MS_PER_SEC);
      expect(r.combatSoldiers / 10_000).toBeCloseTo(1 - Math.exp(-1), 2);
    });

    it('completes training at rate count / train time', () => {
      // About one completes a second; a 2 s step completes some.
      state.soldierPipeline = { count: ONE_PER_SEC, progress: 0 };
      state.combatSoldiers = 0;
      const before = {
        count: state.soldierPipeline.count,
        soldiers: state.combatSoldiers,
      };
      const result = system.tick(state, 2);
      expect(result.combatSoldiers).toBeGreaterThan(before.soldiers);
      expect(result.soldierPipeline.count).toBeLessThan(before.count);
    });

    it('completes multiple when count is large', () => {
      // About three complete a second.
      state.soldierPipeline = { count: 3 * ONE_PER_SEC, progress: 0 };
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
      // 25 in pipeline: a third of one completes a second; the fraction carries between ticks.
      state.soldierPipeline = { count: 25, progress: 0 };
      state.combatSoldiers = 0;
      const before = {
        count: state.soldierPipeline.count,
        soldiers: state.combatSoldiers,
      };
      let r = state;
      for (let i = 0; i < 6; i++) r = system.tick(r, 1);
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

  describe('upgradeWeapon', () => {
    it('costs chitin, not food', () => {
      state.buildings.chitin_armory = { level: 1 };
      state.combatResources.chitin = 50;
      const chitinBefore = state.combatResources.chitin;
      const foodBefore = state.resources.food;
      const result = system.upgradeWeapon(state);
      expect(result.combatResources.chitin).toBeLessThan(chitinBefore);
      expect(result.resources.food).toBe(foodBefore); // food unchanged
      expect(result.equipment.weapon).toBeGreaterThan(state.equipment.weapon);
    });

    it('returns unchanged when chitin insufficient', () => {
      state.buildings.chitin_armory = { level: 1 };
      state.combatResources.chitin = 0;
      const result = system.upgradeWeapon(state);
      expect(result).toBe(state);
    });

    it('returns unchanged when no chitin armory built', () => {
      state.combatResources.chitin = 100;
      // chitin_armory is level 0 by default
      const result = system.upgradeWeapon(state);
      expect(result).toBe(state);
    });

    it('returns unchanged when chitin armory level is 0', () => {
      state.buildings.chitin_armory = { level: 0 };
      state.combatResources.chitin = 100;
      const result = system.upgradeWeapon(state);
      expect(result).toBe(state);
    });

    it('returns unchanged at max equipment level', () => {
      state.buildings.chitin_armory = { level: 1 };
      state.combatResources.chitin = 100;
      state.equipment.weapon = soldierBalance.maxEquipmentLevel;
      const result = system.upgradeWeapon(state);
      expect(result).toBe(state);
    });
  });

  describe('upgradeArmor', () => {
    it('costs silk, not food', () => {
      state.buildings.silk_weaving = { level: 1 };
      state.combatResources.silk = 50;
      const silkBefore = state.combatResources.silk;
      const foodBefore = state.resources.food;
      const result = system.upgradeArmor(state);
      expect(result.combatResources.silk).toBeLessThan(silkBefore);
      expect(result.resources.food).toBe(foodBefore); // food unchanged
      expect(result.equipment.armor).toBeGreaterThan(state.equipment.armor);
    });

    it('returns unchanged when silk insufficient', () => {
      state.buildings.silk_weaving = { level: 1 };
      state.combatResources.silk = 0;
      const result = system.upgradeArmor(state);
      expect(result).toBe(state);
    });

    it('returns unchanged when no silk weaving built', () => {
      state.combatResources.silk = 100;
      // silk_weaving is level 0 by default
      const result = system.upgradeArmor(state);
      expect(result).toBe(state);
    });

    it('returns unchanged when silk weaving level is 0', () => {
      state.buildings.silk_weaving = { level: 0 };
      state.combatResources.silk = 100;
      const result = system.upgradeArmor(state);
      expect(result).toBe(state);
    });

    it('returns unchanged at max equipment level', () => {
      state.buildings.silk_weaving = { level: 1 };
      state.combatResources.silk = 100;
      state.equipment.armor = soldierBalance.maxEquipmentLevel;
      const result = system.upgradeArmor(state);
      expect(result).toBe(state);
    });
  });

  describe('events', () => {
    it('emits soldiers_changed when training completes', () => {
      let count = -1;
      bus.subscribe('soldiers_changed', (p) => { count = (p as { soldiers: number }).soldiers; });
      state.soldierPipeline = { count: 75, progress: 0 };
      system.tick(state, 2);
      expect(count).toBeGreaterThan(-1);
    });

    it('does not emit when no training completes', () => {
      let emitted = false;
      bus.subscribe('soldiers_changed', () => { emitted = true; });
      state.soldierPipeline = { count: 0, progress: 0 };
      system.tick(state, 1);
      expect(emitted).toBe(false);
    });

    it('emits weapon_upgraded on success', () => {
      state.buildings.chitin_armory = { level: 1 };
      state.combatResources.chitin = 50;
      let level = -1;
      bus.subscribe('weapon_upgraded', (p) => { level = (p as { level: number }).level; });
      system.upgradeWeapon(state);
      expect(level).toBeGreaterThan(-1);
    });

    it('emits armor_upgraded on success', () => {
      state.buildings.silk_weaving = { level: 1 };
      state.combatResources.silk = 50;
      let level = -1;
      bus.subscribe('armor_upgraded', (p) => { level = (p as { level: number }).level; });
      system.upgradeArmor(state);
      expect(level).toBeGreaterThan(-1);
    });
  });
});
