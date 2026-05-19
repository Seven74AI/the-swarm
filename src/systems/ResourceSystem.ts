import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { upgradeCost } from '../utils/math';
import { getEffects } from './BuildingSystem';

/**
 * Upgrade definitions.
 * Each upgrade has an id, base food cost, and cost multiplier.
 */
interface UpgradeDef {
  baseCost: number;
  costMultiplier: number;
}

const UPGRADES: Record<string, UpgradeDef> = {
  click_power: { baseCost: 10, costMultiplier: 1.15 },
};

export const EGG_HATCH_TIME = 5; // ticks
export const LARVA_MATURE_TIME = 10; // ticks
const FOOD_PER_WORKER = 1; // food produced per unassigned worker per tick
const FOOD_PER_GATHER = 2; // food produced per gather worker per tick
const FOOD_CONSUMED_PER_WORKER = 0.5; // food consumed per worker per tick

/**
 * ResourceSystem handles all resource mutations: clicking, ticking, buying.
 * Pure logic — no DOM access. Emits events on the provided EventBus.
 */
export class ResourceSystem {
  constructor(private bus: EventBus) {}

  /**
   * Lay an egg. Adds 1 egg (or more with click_power upgrade) and a 5-tick hatch timer.
   */
  clickEgg(state: GameState): GameState {
    const eggsPerClick = 1 + (state.upgrades.click_power ?? 0);
    const newTimers = [...state.eggHatchTimers];
    for (let i = 0; i < eggsPerClick; i++) {
      newTimers.push(EGG_HATCH_TIME);
    }

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        eggs: state.resources.eggs + eggsPerClick,
      },
      eggHatchTimers: newTimers,
      stats: {
        ...state.stats,
        totalEggsLaid: state.stats.totalEggsLaid + eggsPerClick,
        totalClicks: state.stats.totalClicks + 1,
      },
    };

    this.bus.emit('eggs_changed', { eggs: result.resources.eggs });
    return result;
  }

  /**
   * Process a single game tick (1 second).
   * - Decrement egg timers, hatch any at 0 → larvae
   * - Decrement larva timers, mature any at 0 → workers
   * - Workers produce and consume food
   * - Apply territory bonuses (optional)
   */
  tick(state: GameState, territoryBonuses?: TerritoryBonuses): GameState {
    let eggs = state.resources.eggs;
    let larvae = state.resources.larvae;
    let workers = state.resources.workers;
    let food = state.resources.food;
    let wood = state.resources.wood;
    let stone = state.resources.stone;
    let nectar = state.resources.nectar;
    const eggTimers = [...state.eggHatchTimers];
    const larvaTimers = [...state.larvaMatureTimers];

    let eggsChanged = false;
    let larvaeChanged = false;
    let workersChanged = false;
    let foodChanged = false;

    // Decrement egg timers and hatch → collect new larva timers separately
    const newEggTimers: number[] = [];
    const hatchedLarvaTimers: number[] = [];

    // Sort egg timers so tend workers affect the oldest (lowest) timers first
    const sortedEggTimers = [...eggTimers].sort((a, b) => a - b);
    const tendCount = state.workersAssigned.tend;

    for (let i = 0; i < sortedEggTimers.length; i++) {
      const timer = sortedEggTimers[i];
      // Tend workers give an extra -1 to the oldest eggs
      const extraDecrement = i < tendCount ? 1 : 0;
      const remaining = timer - 1 - extraDecrement;
      if (remaining <= 0) {
        // Egg hatches → larva
        eggs--;
        larvae++;
        eggsChanged = true;
        larvaeChanged = true;
        hatchedLarvaTimers.push(LARVA_MATURE_TIME);
      } else {
        newEggTimers.push(remaining);
      }
    }

    // Decrement larva timers and mature (only existing larvae, not newly hatched)
    const newLarvaTimers: number[] = [];
    for (const timer of larvaTimers) {
      const remaining = timer - 1;
      if (remaining <= 0) {
        // Larva matures → worker
        larvae--;
        workers++;
        larvaeChanged = true;
        workersChanged = true;
      } else {
        newLarvaTimers.push(remaining);
      }
    }
    // Add newly hatched larva timers AFTER decrementing existing ones
    for (const t of hatchedLarvaTimers) {
      newLarvaTimers.push(t);
    }

    // Workers produce food
    if (workers > 0) {
      const assigned = state.workersAssigned;
      const gatherCount = assigned.gather;
      const unassignedCount = workers - gatherCount - assigned.tend - assigned.dig - assigned.guard;
      const produced =
        gatherCount * FOOD_PER_GATHER +
        Math.max(0, unassignedCount) * FOOD_PER_WORKER;
      const consumed = workers * FOOD_CONSUMED_PER_WORKER;
      food = Math.max(0, food + produced - consumed);
      foodChanged = true;
    }

    // Apply territory bonuses
    let woodChanged = false;
    let stoneChanged = false;
    let nectarChanged = false;

    if (workers > 0 && territoryBonuses) {
      if (territoryBonuses.food > 0) {
        const bonusFood = workers * territoryBonuses.food;
        food += bonusFood;
        foodChanged = true;
      }
      if (territoryBonuses.stone > 0) {
        stone += workers * territoryBonuses.stone;
        stoneChanged = true;
      }
      if (territoryBonuses.nectar > 0) {
        nectar += workers * territoryBonuses.nectar;
        nectarChanged = true;
      }
    }

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        eggs,
        larvae,
        workers,
        food,
        wood,
        stone,
        nectar,
      },
      eggHatchTimers: newEggTimers,
      larvaMatureTimers: newLarvaTimers,
    };

    if (eggsChanged) {
      this.bus.emit('eggs_changed', { eggs: result.resources.eggs });
    }
    if (larvaeChanged) {
      this.bus.emit('larvae_changed', { larvae: result.resources.larvae });
    }
    if (foodChanged) {
      this.bus.emit('food_changed', { food: result.resources.food });
    }
    if (woodChanged) {
      this.bus.emit('wood_changed', { wood: result.resources.wood });
    }
    if (stoneChanged) {
      this.bus.emit('stone_changed', { stone: result.resources.stone });
    }
    if (nectarChanged) {
      this.bus.emit('nectar_changed', { nectar: result.resources.nectar });
    }
    if (workersChanged) {
      this.bus.emit('workers_changed', { workers: result.resources.workers });
    }

    return result;
  }

  /**
   * Purchase an upgrade. Deducts resources and increments upgrade level.
   * Returns unchanged state if insufficient resources.
   */
  buyUpgrade(state: GameState, upgradeId: string): GameState {
    const def = UPGRADES[upgradeId];
    if (!def) return state;

    const currentLevel = state.upgrades[upgradeId] ?? 0;
    const cost = upgradeCost(def.baseCost, def.costMultiplier, currentLevel);

    if (state.resources.food < cost) return state;

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food - cost,
      },
      upgrades: {
        ...state.upgrades,
        [upgradeId]: currentLevel + 1,
      },
    };

    this.bus.emit('upgrade_purchased', { upgradeId, level: currentLevel + 1 });
    return result;
  }

  /**
   * Assign one unassigned worker to a role.
   * Returns unchanged state if no unassigned workers available.
   */
  assignWorker(state: GameState, role: 'gather' | 'tend' | 'dig' | 'guard'): GameState {
    const assigned = state.workersAssigned;
    const totalAssigned = assigned.gather + assigned.tend + assigned.dig + assigned.guard;
    if (totalAssigned >= state.resources.workers) return state;

    const result: GameState = {
      ...state,
      workersAssigned: {
        ...assigned,
        [role]: assigned[role] + 1,
      },
    };

    this.bus.emit('workers_assigned', { role, assigned: result.workersAssigned });
    return result;
  }

  /**
   * Unassign one worker from a role.
   * Won't go below 0 for that role.
   */
  unassignWorker(state: GameState, role: 'gather' | 'tend' | 'dig' | 'guard'): GameState {
    const assigned = state.workersAssigned;
    if (assigned[role] <= 0) return state;

    const result: GameState = {
      ...state,
      workersAssigned: {
        ...assigned,
        [role]: assigned[role] - 1,
      },
    };

    this.bus.emit('workers_assigned', { role, assigned: result.workersAssigned });
    return result;
  }

  /**
   * Get the effective nest capacity including warehouse building bonuses.
   */
  getEffectiveNestCapacity(state: GameState): number {
    const base = state.resources.nestCapacity;
    const effects = getEffects('warehouse', state.buildings.warehouse.level);
    return base + (effects.nestCapacity ?? 0);
  }
}
