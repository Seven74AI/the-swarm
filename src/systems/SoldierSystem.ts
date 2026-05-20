import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import { upgradeCost } from '../utils/math';

export const SOLDIER_COST_FOOD = 5;
export const SOLDIER_TRAIN_TIME = 15;
export const MAX_EQUIPMENT_LEVEL = 5;

/**
 * SoldierSystem handles soldier recruitment, training, and equipment upgrades.
 * Uses rate-based pipeline for training (O(1) per tick instead of O(n)).
 */
export class SoldierSystem {
  constructor(private bus: EventBus) {}

  /**
   * Recruit a soldier: convert 1 worker to 1 soldier after training time.
   * Workers reduce immediately; soldier added via pipeline.
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
      soldierPipeline: {
        count: state.soldierPipeline.count + 1,
        progress: state.soldierPipeline.progress,
      },
    };

    this.bus.emit('soldiers_changed', { soldiers: result.combatSoldiers });
    return result;
  }

  /**
   * Process a single tick: rate-based soldier training.
   */
  tick(state: GameState): GameState {
    const pipe = { ...state.soldierPipeline };
    if (pipe.count === 0) return state;

    const trainRate = pipe.count / SOLDIER_TRAIN_TIME;
    pipe.progress += trainRate;
    const completed = Math.floor(pipe.progress);
    pipe.progress -= completed;

    if (completed <= 0) {
      return { ...state, soldierPipeline: pipe };
    }

    const newSoldiers = Math.min(completed, pipe.count);
    pipe.count -= newSoldiers;

    const result: GameState = {
      ...state,
      soldierPipeline: pipe,
      combatSoldiers: state.combatSoldiers + newSoldiers,
    };

    if (newSoldiers > 0) {
      this.bus.emit('soldiers_changed', { soldiers: result.combatSoldiers });
      this.bus.emit('soldier_recruited', { type: 'soldier', count: newSoldiers });
    }

    return result;
  }

  upgradeWeapon(state: GameState): GameState {
    const weapon = state.equipment.weapon;
    if (weapon >= MAX_EQUIPMENT_LEVEL) return state;

    const cost = upgradeCost(10, 1.2, weapon);
    if (state.resources.food < cost) return state;

    const result: GameState = {
      ...state,
      resources: { ...state.resources, food: state.resources.food - cost },
      equipment: { ...state.equipment, weapon: weapon + 1 },
    };

    this.bus.emit('weapon_upgraded', { level: result.equipment.weapon });
    return result;
  }

  upgradeArmor(state: GameState): GameState {
    const armor = state.equipment.armor;
    if (armor >= MAX_EQUIPMENT_LEVEL) return state;

    const cost = upgradeCost(10, 1.2, armor);
    if (state.resources.food < cost) return state;

    const result: GameState = {
      ...state,
      resources: { ...state.resources, food: state.resources.food - cost },
      equipment: { ...state.equipment, armor: armor + 1 },
    };

    this.bus.emit('armor_upgraded', { level: result.equipment.armor });
    return result;
  }
}

export function getSoldierStrength(state: GameState): number {
  return 1 + state.equipment.weapon;
}

export function getSoldierDefense(state: GameState): number {
  return 1 + state.equipment.armor;
}

export function getSoldierSpeed(_state: GameState): number {
  return 5;
}

export function getSoldierMaxHp(state: GameState): number {
  return 10 + state.equipment.armor * 2;
}
