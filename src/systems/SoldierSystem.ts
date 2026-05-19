import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import { upgradeCost } from '../utils/math';

export const SOLDIER_COST_FOOD = 5;
export const SOLDIER_TRAIN_TIME = 15;
export const MAX_EQUIPMENT_LEVEL = 5;

/**
 * SoldierSystem handles soldier recruitment, training, and equipment upgrades.
 * Pure logic — no DOM access. Emits events on the provided EventBus.
 */
export class SoldierSystem {
  constructor(private bus: EventBus) {}

  /**
   * Recruit a soldier: convert 1 worker to 1 soldier after training time.
   * Workers reduce immediately; soldier added after training timer expires.
   * Cost: 5 food + 15s training time.
   */
  recruitSoldier(state: GameState): GameState {
    if (state.resources.workers < 1) return state;
    if (state.resources.food < SOLDIER_COST_FOOD) return state;

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        workers: state.resources.workers - 1,
        food: state.resources.food - SOLDIER_COST_FOOD,
      },
      soldierTrainTimers: [...state.soldierTrainTimers, SOLDIER_TRAIN_TIME],
    };

    this.bus.emit('soldiers_changed', { soldiers: result.combatSoldiers });
    return result;
  }

  /**
   * Process a single game tick (1 second) for soldier training.
   * Decrements soldier train timers; when a timer reaches 0, a soldier is added.
   */
  tick(state: GameState): GameState {
    const timers = [...state.soldierTrainTimers];
    if (timers.length === 0) return state;

    let newSoldiers = 0;
    const newTimers: number[] = [];

    for (const timer of timers) {
      const remaining = timer - 1;
      if (remaining <= 0) {
        newSoldiers++;
      } else {
        newTimers.push(remaining);
      }
    }

    const result: GameState = {
      ...state,
      soldierTrainTimers: newTimers,
      combatSoldiers: state.combatSoldiers + newSoldiers,
    };

    if (newSoldiers > 0) {
      this.bus.emit('soldiers_changed', { soldiers: result.combatSoldiers });
    }

    return result;
  }

  /**
   * Upgrade weapon by 1 level.
   * Cost: floor(10 * 1.20 ^ weaponLevel) food.
   * Max level: 5.
   */
  upgradeWeapon(state: GameState): GameState {
    if (state.equipment.weapon >= MAX_EQUIPMENT_LEVEL) return state;
    const cost = upgradeCost(10, 1.20, state.equipment.weapon);
    if (state.resources.food < cost) return state;

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food - cost,
      },
      equipment: {
        ...state.equipment,
        weapon: state.equipment.weapon + 1,
      },
    };

    this.bus.emit('weapon_upgraded', { level: result.equipment.weapon });
    return result;
  }

  /**
   * Upgrade armor by 1 level.
   * Cost: floor(10 * 1.20 ^ armorLevel) food.
   * Max level: 5.
   */
  upgradeArmor(state: GameState): GameState {
    if (state.equipment.armor >= MAX_EQUIPMENT_LEVEL) return state;
    const cost = upgradeCost(10, 1.20, state.equipment.armor);
    if (state.resources.food < cost) return state;

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food - cost,
      },
      equipment: {
        ...state.equipment,
        armor: state.equipment.armor + 1,
      },
    };

    this.bus.emit('armor_upgraded', { level: result.equipment.armor });
    return result;
  }
}

/**
 * Get soldier strength: base 1.0 + weapon level.
 */
export function getSoldierStrength(state: GameState): number {
  return 1 + state.equipment.weapon;
}

/**
 * Get soldier defense: base 1.0 + armor level.
 */
export function getSoldierDefense(state: GameState): number {
  return 1 + state.equipment.armor;
}

/**
 * Get soldier speed: constant base 5.
 */
export function getSoldierSpeed(_state: GameState): number {
  return 5;
}

/**
 * Get soldier max HP: base 10 + armor level * 2.
 */
export function getSoldierMaxHp(state: GameState): number {
  return 10 + state.equipment.armor * 2;
}
