import type { EventBus } from '../engine/EventBus';
import type { EventSink } from '../engine/events';
import type { GameState } from '../state/GameState';
import { upgradeCost } from '../utils/math';
import { completedShare } from '../utils/decay';
import { getPrestigeBonuses } from './PrestigeBonusSystem';
import { getMutationEffects } from './MutationSystem';

export const SOLDIER_COST_FOOD = 5;
export const SOLDIER_TRAIN_TIME = 75; // 5x pacing nerf (was 15)
export const MAX_EQUIPMENT_LEVEL = 5;

/**
 * SoldierSystem handles soldier recruitment, training, and equipment upgrades.
 * Uses rate-based pipeline for training (O(1) per tick instead of O(n)).
 */
/** Chitin (weapon) or silk (armour) to raise equipment from `level`. */
export function getEquipmentUpgradeCost(level: number): number {
  return upgradeCost(10, 1.2, level);
}

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
   * @param dtSec Delta time in seconds (from Ticker, typically 0.05 for 50ms ticks).
   * @param events Where tick events go: the game loop passes the tick's queue (AR18).
   */
  tick(state: GameState, dtSec: number, events: EventSink = this.bus): GameState {
    const pipe = { ...state.soldierPipeline };
    if (pipe.count === 0) return state;

    const prestigeBonuses = getPrestigeBonuses(state);
    // Exact flow over the step (Story 2.5): one long step trains what many short ones do.
    const trainK = prestigeBonuses.soldierTraining / SOLDIER_TRAIN_TIME;
    pipe.progress += pipe.count * completedShare(trainK, dtSec);
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
      events.emit('soldiers_changed', { soldiers: result.combatSoldiers });
      events.emit('soldier_recruited', { type: 'soldier', count: newSoldiers });
    }

    return result;
  }

  upgradeWeapon(state: GameState): GameState {
    const weapon = state.equipment.weapon;
    if (weapon >= MAX_EQUIPMENT_LEVEL) return state;

    // Gate: requires Chitin Armory
    if ((state.buildings.chitin_armory?.level ?? 0) < 1) return state;

    const cost = getEquipmentUpgradeCost(weapon);
    if (state.combatResources.chitin < cost) return state;

    const result: GameState = {
      ...state,
      combatResources: {
        ...state.combatResources,
        chitin: state.combatResources.chitin - cost,
      },
      equipment: { ...state.equipment, weapon: weapon + 1 },
    };

    this.bus.emit('weapon_upgraded', { level: result.equipment.weapon });
    return result;
  }

  upgradeArmor(state: GameState): GameState {
    const armor = state.equipment.armor;
    if (armor >= MAX_EQUIPMENT_LEVEL) return state;

    // Gate: requires Silk Weaving
    if ((state.buildings.silk_weaving?.level ?? 0) < 1) return state;

    const cost = getEquipmentUpgradeCost(armor);
    if (state.combatResources.silk < cost) return state;

    const result: GameState = {
      ...state,
      combatResources: {
        ...state.combatResources,
        silk: state.combatResources.silk - cost,
      },
      equipment: { ...state.equipment, armor: armor + 1 },
    };

    this.bus.emit('armor_upgraded', { level: result.equipment.armor });
    return result;
  }
}

export function getSoldierStrength(state: GameState): number {
  return 1 + state.equipment.weapon + getMutationEffects(state).strength;
}

export function getSoldierDefense(state: GameState): number {
  return 1 + state.equipment.armor;
}

export function getSoldierSpeed(state: GameState): number {
  return 5 + getMutationEffects(state).speed;
}

export function getSoldierMaxHp(state: GameState): number {
  return 10 + state.equipment.armor * 2 + getMutationEffects(state).maxHp;
}
