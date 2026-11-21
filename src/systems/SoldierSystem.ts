import type { EventBus } from '../engine/EventBus';
import type { EventSink } from '../engine/events';
import type { GameState } from '../state/GameState';
import { upgradeCost } from '../utils/math';
import { completedShare } from '../utils/decay';
import { getPrestigeBonuses } from './PrestigeBonusSystem';
import { getMutationEffects } from './MutationSystem';
import { MS_PER_SEC } from '../data/constants';
import { soldierBalance as B } from '../data/balance/soldiers';
import { combatBalance } from '../data/balance/combat';

/**
 * SoldierSystem handles soldier recruitment, training, and equipment upgrades.
 * Uses rate-based pipeline for training (O(1) per tick instead of O(n)).
 */
/** Chitin (weapon) or silk (armour) to raise equipment from `level`. */
export function getEquipmentUpgradeCost(level: number): number {
  return upgradeCost(B.equipmentUpgrade.baseCost, B.equipmentUpgrade.costMultiplier, level);
}

export class SoldierSystem {
  constructor(private bus: EventBus) {}

  /**
   * Recruit a soldier: `combatBalance.army.workersPerSoldier` workers become
   * 1 soldier after training time (Story 4.4). Workers reduce immediately;
   * the soldier is added via the pipeline and eats from now on.
   */
  recruitSoldier(state: GameState): GameState {
    const workers = combatBalance.army.workersPerSoldier;
    if (state.resources.workers < workers) return state;
    if (state.resources.food < B.costFood) return state;

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        workers: state.resources.workers - workers,
        food: state.resources.food - B.costFood,
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
    const trainK = prestigeBonuses.soldierTraining * (MS_PER_SEC / B.trainMs);
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
    if (weapon >= B.maxEquipmentLevel) return state;

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
    if (armor >= B.maxEquipmentLevel) return state;

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

/** What the first `level` levels of a piece of equipment add to one stat (`combatBalance.equipment`, Story 4.2). */
function equipmentGain<K extends 'weapon' | 'armor'>(
  piece: K,
  level: number,
  stat: keyof (typeof combatBalance.equipment)[K][number],
): number {
  const levels = combatBalance.equipment[piece] as readonly Record<string, unknown>[];
  return levels.slice(0, level).reduce((sum, l) => sum + (typeof l[stat as string] === 'number' ? (l[stat as string] as number) : 0), 0);
}

export function getSoldierStrength(state: GameState): number {
  return B.baseStrength + equipmentGain('weapon', state.equipment.weapon, 'strength') + getMutationEffects(state).strength;
}

export function getSoldierDefense(state: GameState): number {
  return B.baseDefense + equipmentGain('armor', state.equipment.armor, 'defense');
}

export function getSoldierSpeed(state: GameState): number {
  return B.baseSpeed + getMutationEffects(state).speed;
}

export function getSoldierMaxHp(state: GameState): number {
  return B.baseMaxHp + equipmentGain('armor', state.equipment.armor, 'maxHp') + getMutationEffects(state).maxHp;
}
