import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import { upgradeCost } from '../utils/math';

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

const EGG_HATCH_TIME = 5; // ticks
const LARVA_MATURE_TIME = 10; // ticks
const FOOD_PER_WORKER = 1; // food produced per worker per tick
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
   */
  tick(state: GameState): GameState {
    let eggs = state.resources.eggs;
    let larvae = state.resources.larvae;
    let workers = state.resources.workers;
    let food = state.resources.food;
    const eggTimers = [...state.eggHatchTimers];
    const larvaTimers = [...state.larvaMatureTimers];

    let workersChanged = false;
    let foodChanged = false;

    // Decrement egg timers and hatch → collect new larva timers separately
    const newEggTimers: number[] = [];
    const hatchedLarvaTimers: number[] = [];
    for (const timer of eggTimers) {
      const remaining = timer - 1;
      if (remaining <= 0) {
        // Egg hatches → larva (timer added AFTER larvae processing)
        eggs--;
        larvae++;
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
      const produced = workers * FOOD_PER_WORKER;
      const consumed = workers * FOOD_CONSUMED_PER_WORKER;
      food = Math.max(0, food + produced - consumed);
      foodChanged = true;
    }

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        eggs,
        larvae,
        workers,
        food,
      },
      eggHatchTimers: newEggTimers,
      larvaMatureTimers: newLarvaTimers,
    };

    if (foodChanged) {
      this.bus.emit('food_changed', { food: result.resources.food });
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
}
