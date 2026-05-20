import { describe, it, expect, beforeEach } from 'vitest';
import {
  SoldierSystem,
  SOLDIER_COST_FOOD,
  SOLDIER_TRAIN_TIME,
  MAX_EQUIPMENT_LEVEL,
  getSoldierStrength,
  getSoldierDefense,
  getSoldierSpeed,
  getSoldierMaxHp,
} from '../../src/systems/SoldierSystem';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('SoldierSystem', () => {
  let system: SoldierSystem;
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new SoldierSystem(bus);
    state = createInitialState();
  });

  describe('recruitSoldier', () => {
    it('decrements workers by 1', () => {
      state.resources.workers = 3;
      state.resources.food = 100;
      const result = system.recruitSoldier(state);
      expect(result.resources.workers).toBe(2);
    });

    it('deducts 5 food', () => {
      state.resources.workers = 3;
      state.resources.food = 100;
      const result = system.recruitSoldier(state);
      expect(result.resources.food).toBe(95);
    });

    it('adds a 15-tick soldier train timer', () => {
      state.resources.workers = 3;
      state.resources.food = 100;
      const result = system.recruitSoldier(state);
      expect(result.soldierTrainTimers).toEqual([SOLDIER_TRAIN_TIME]);
    });

    it('fails when workers < 1 (returns unchanged state)', () => {
      state.resources.workers = 0;
      state.resources.food = 100;
      const result = system.recruitSoldier(state);
      expect(result).toBe(state);
      expect(result.resources.workers).toBe(0);
    });

    it('fails when food < 5 (returns unchanged state)', () => {
      state.resources.workers = 3;
      state.resources.food = 3;
      const result = system.recruitSoldier(state);
      expect(result).toBe(state);
      expect(result.resources.food).toBe(3);
    });

    it('emits soldiers_changed event on successful recruit', () => {
      let emitted = false;
      bus.subscribe('soldiers_changed', () => {
        emitted = true;
      });
      state.resources.workers = 3;
      state.resources.food = 100;
      system.recruitSoldier(state);
      expect(emitted).toBe(true);
    });

    it('does not emit soldiers_changed when recruit fails', () => {
      let emitted = false;
      bus.subscribe('soldiers_changed', () => {
        emitted = true;
      });
      state.resources.workers = 0;
      state.resources.food = 100;
      system.recruitSoldier(state);
      expect(emitted).toBe(false);
    });
  });

  describe('tick', () => {
    it('decrements soldier train timers by 1', () => {
      state.soldierTrainTimers = [15, 10];
      const result = system.tick(state);
      expect(result.soldierTrainTimers).toEqual([14, 9]);
    });

    it('completes training when timer reaches 0', () => {
      state.soldierTrainTimers = [1];
      state.combatSoldiers = 0;
      const result = system.tick(state);
      expect(result.soldierTrainTimers).toEqual([]);
      expect(result.combatSoldiers).toBe(1);
    });

    it('processes multiple timers simultaneously', () => {
      state.soldierTrainTimers = [3, 1, 5];
      state.combatSoldiers = 0;
      const result = system.tick(state);
      // timer 1 completes → soldier added; others decrement
      expect(result.soldierTrainTimers).toEqual([2, 4]);
      expect(result.combatSoldiers).toBe(1);
    });

    it('increments soldiers for each completed timer', () => {
      state.soldierTrainTimers = [1, 1, 1];
      state.combatSoldiers = 2;
      const result = system.tick(state);
      // Only 1 soldier finishes per tick — others defer to next tick
      expect(result.soldierTrainTimers).toEqual([1, 1]);
      expect(result.combatSoldiers).toBe(3);
    });

    it('emits soldiers_changed when soldiers are added via training', () => {
      let emitted = false;
      bus.subscribe('soldiers_changed', () => {
        emitted = true;
      });
      state.soldierTrainTimers = [1];
      state.combatSoldiers = 0;
      system.tick(state);
      expect(emitted).toBe(true);
    });

    it('does not emit soldiers_changed when no training completes', () => {
      let emitted = false;
      bus.subscribe('soldiers_changed', () => {
        emitted = true;
      });
      state.soldierTrainTimers = [5];
      state.combatSoldiers = 0;
      system.tick(state);
      expect(emitted).toBe(false);
    });

    it('handles empty timer array gracefully', () => {
      state.soldierTrainTimers = [];
      state.combatSoldiers = 0;
      const result = system.tick(state);
      expect(result.soldierTrainTimers).toEqual([]);
      expect(result.combatSoldiers).toBe(0);
    });
  });

  describe('upgradeWeapon', () => {
    it('increments weapon level from 0 to 1', () => {
      state.resources.food = 100;
      state.equipment.weapon = 0;
      const result = system.upgradeWeapon(state);
      expect(result.equipment.weapon).toBe(1);
    });

    it('deducts cost: 10 * 1.20^level food', () => {
      // level 0: cost = floor(10 * 1.20^0) = floor(10) = 10
      state.resources.food = 100;
      state.equipment.weapon = 0;
      const result = system.upgradeWeapon(state);
      expect(result.resources.food).toBe(90);
    });

    it('cost scales with level: level 3 = floor(10 * 1.20^3) = floor(10 * 1.728) = 17', () => {
      state.resources.food = 100;
      state.equipment.weapon = 3;
      const result = system.upgradeWeapon(state);
      expect(result.resources.food).toBe(83);
    });

    it('fails at max level 5 (returns unchanged state)', () => {
      state.resources.food = 100;
      state.equipment.weapon = 5;
      const result = system.upgradeWeapon(state);
      expect(result).toBe(state);
      expect(result.equipment.weapon).toBe(5);
    });

    it('fails when insufficient food', () => {
      state.resources.food = 5;
      state.equipment.weapon = 0;
      const result = system.upgradeWeapon(state);
      expect(result).toBe(state);
      expect(result.equipment.weapon).toBe(0);
    });

    it('emits weapon_upgraded event', () => {
      let emitted = false;
      bus.subscribe('weapon_upgraded', () => {
        emitted = true;
      });
      state.resources.food = 100;
      state.equipment.weapon = 0;
      system.upgradeWeapon(state);
      expect(emitted).toBe(true);
    });
  });

  describe('upgradeArmor', () => {
    it('increments armor level from 0 to 1', () => {
      state.resources.food = 100;
      state.equipment.armor = 0;
      const result = system.upgradeArmor(state);
      expect(result.equipment.armor).toBe(1);
    });

    it('deducts cost: 10 * 1.20^level food', () => {
      state.resources.food = 100;
      state.equipment.armor = 0;
      const result = system.upgradeArmor(state);
      expect(result.resources.food).toBe(90);
    });

    it('cost scales with level: level 2 = floor(10 * 1.20^2) = floor(10 * 1.44) = 14', () => {
      state.resources.food = 100;
      state.equipment.armor = 2;
      const result = system.upgradeArmor(state);
      expect(result.resources.food).toBe(86);
    });

    it('fails at max level 5 (returns unchanged state)', () => {
      state.resources.food = 100;
      state.equipment.armor = 5;
      const result = system.upgradeArmor(state);
      expect(result).toBe(state);
      expect(result.equipment.armor).toBe(5);
    });

    it('fails when insufficient food', () => {
      state.resources.food = 5;
      state.equipment.armor = 0;
      const result = system.upgradeArmor(state);
      expect(result).toBe(state);
      expect(result.equipment.armor).toBe(0);
    });

    it('emits armor_upgraded event', () => {
      let emitted = false;
      bus.subscribe('armor_upgraded', () => {
        emitted = true;
      });
      state.resources.food = 100;
      state.equipment.armor = 0;
      system.upgradeArmor(state);
      expect(emitted).toBe(true);
    });
  });

  describe('soldier stats', () => {
    it('getSoldierStrength: base 1 + weaponLevel', () => {
      state.equipment.weapon = 0;
      expect(getSoldierStrength(state)).toBe(1);
      state.equipment.weapon = 3;
      expect(getSoldierStrength(state)).toBe(4);
      state.equipment.weapon = 5;
      expect(getSoldierStrength(state)).toBe(6);
    });

    it('getSoldierDefense: base 1 + armorLevel', () => {
      state.equipment.armor = 0;
      expect(getSoldierDefense(state)).toBe(1);
      state.equipment.armor = 2;
      expect(getSoldierDefense(state)).toBe(3);
      state.equipment.armor = 5;
      expect(getSoldierDefense(state)).toBe(6);
    });

    it('getSoldierSpeed: base 5', () => {
      expect(getSoldierSpeed(state)).toBe(5);
      // Speed should be constant regardless of equipment
      state.equipment.weapon = 5;
      state.equipment.armor = 5;
      expect(getSoldierSpeed(state)).toBe(5);
    });

    it('getSoldierMaxHp: base 10 + armorLevel * 2', () => {
      state.equipment.armor = 0;
      expect(getSoldierMaxHp(state)).toBe(10);
      state.equipment.armor = 1;
      expect(getSoldierMaxHp(state)).toBe(12);
      state.equipment.armor = 5;
      expect(getSoldierMaxHp(state)).toBe(20);
    });
  });
});

describe('SoldierSystem constants', () => {
  it('SOLDIER_COST_FOOD is 5', () => {
    expect(SOLDIER_COST_FOOD).toBe(5);
  });

  it('SOLDIER_TRAIN_TIME is 15', () => {
    expect(SOLDIER_TRAIN_TIME).toBe(15);
  });

  it('MAX_EQUIPMENT_LEVEL is 5', () => {
    expect(MAX_EQUIPMENT_LEVEL).toBe(5);
  });
});
