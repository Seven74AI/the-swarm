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
const FOOD_PER_WORKER = 1;
const FOOD_PER_GATHER = 2;
const FOOD_CONSUMED_PER_WORKER = 0.5;
const TEND_RATE_BONUS = 1 / EGG_HATCH_TIME; // per tend worker

/**
 * ResourceSystem handles all resource mutations: clicking, ticking, buying.
 * Uses rate-based pipelines instead of per-item timer arrays.
 */
export class ResourceSystem {
  constructor(private bus: EventBus) {}

  /**
   * Lay eggs. Adds eggs and pushes them into the hatching pipeline.
   */
  clickEgg(state: GameState): GameState {
    const eggsPerClick = 1 + (state.upgrades.click_power ?? 0);

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        eggs: state.resources.eggs + eggsPerClick,
      },
      eggPipeline: {
        count: state.eggPipeline.count + eggsPerClick,
        progress: state.eggPipeline.progress,
      },
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
   * Rate-based pipelines replace per-item timer iteration → O(1).
   */
  tick(state: GameState, territoryBonuses?: TerritoryBonuses): GameState {
    let eggs = state.resources.eggs;
    let larvae = state.resources.larvae;
    let workers = state.resources.workers;
    let food = state.resources.food;
    let wood = state.resources.wood;
    let stone = state.resources.stone;
    let nectar = state.resources.nectar;

    let eggsChanged = false;
    let larvaeChanged = false;
    let workersChanged = false;
    let foodChanged = false;

    // ── Egg pipeline: eggs → larvae ──
    const eggPipe = { ...state.eggPipeline };
    if (eggPipe.count > 0) {
      const tendCount = state.workersAssigned.tend;
      const baseRate = eggPipe.count / EGG_HATCH_TIME;
      const tendRate = Math.min(tendCount, eggPipe.count) * TEND_RATE_BONUS;
      const hatchRate = baseRate + tendRate;

      eggPipe.progress += hatchRate;
      const hatched = Math.floor(eggPipe.progress);
      eggPipe.progress -= hatched;

      if (hatched > 0) {
        const actual = Math.min(hatched, eggs);
        eggs -= actual;
        larvae += actual;
        eggPipe.count = Math.max(0, eggPipe.count - actual);
        eggsChanged = true;
        larvaeChanged = true;
      }
    }

    // ── Larva pipeline: larvae → workers ──
    const larvaPipe = { ...state.larvaPipeline };
    if (larvaPipe.count > 0) {
      const matureRate = larvaPipe.count / LARVA_MATURE_TIME;
      larvaPipe.progress += matureRate;
      const matured = Math.floor(larvaPipe.progress);
      larvaPipe.progress -= matured;

      if (matured > 0) {
        const actual = Math.min(matured, larvae);
        larvae -= actual;
        workers += actual;
        larvaPipe.count = Math.max(0, larvaPipe.count - actual);
        larvaeChanged = true;
        workersChanged = true;
      }
    }

    // ── Food production ──
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

    // ── Territory bonuses ──
    let woodChanged = false;
    let stoneChanged = false;
    let nectarChanged = false;

    if (workers > 0 && territoryBonuses) {
      if (territoryBonuses.food > 0) {
        food += workers * territoryBonuses.food;
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
      eggPipeline: eggPipe,
      larvaPipeline: larvaPipe,
    };

    if (eggsChanged) this.bus.emit('eggs_changed', { eggs: result.resources.eggs });
    if (larvaeChanged) this.bus.emit('larvae_changed', { larvae: result.resources.larvae });
    if (foodChanged) this.bus.emit('food_changed', { food: result.resources.food });
    if (woodChanged) this.bus.emit('wood_changed', { wood: result.resources.wood });
    if (stoneChanged) this.bus.emit('stone_changed', { stone: result.resources.stone });
    if (nectarChanged) this.bus.emit('nectar_changed', { nectar: result.resources.nectar });
    if (workersChanged) this.bus.emit('workers_changed', { workers: result.resources.workers });

    return result;
  }

  buyUpgrade(state: GameState, upgradeId: string): GameState {
    const def = UPGRADES[upgradeId];
    if (!def) return state;

    const currentLevel = state.upgrades[upgradeId] ?? 0;
    const cost = upgradeCost(def.baseCost, def.costMultiplier, currentLevel);
    if (state.resources.food < cost) return state;

    const result: GameState = {
      ...state,
      resources: { ...state.resources, food: state.resources.food - cost },
      upgrades: { ...state.upgrades, [upgradeId]: currentLevel + 1 },
    };

    this.bus.emit('upgrade_purchased', { upgradeId, level: currentLevel + 1 });
    return result;
  }

  assignWorker(state: GameState, role: 'gather' | 'tend' | 'dig' | 'guard'): GameState {
    const assigned = state.workersAssigned;
    const totalAssigned = assigned.gather + assigned.tend + assigned.dig + assigned.guard;
    if (totalAssigned >= state.resources.workers) return state;

    const result: GameState = {
      ...state,
      workersAssigned: { ...assigned, [role]: assigned[role] + 1 },
    };

    this.bus.emit('workers_assigned', { role, assigned: result.workersAssigned });
    return result;
  }

  unassignWorker(state: GameState, role: 'gather' | 'tend' | 'dig' | 'guard'): GameState {
    const assigned = state.workersAssigned;
    if (assigned[role] <= 0) return state;

    const result: GameState = {
      ...state,
      workersAssigned: { ...assigned, [role]: assigned[role] - 1 },
    };

    this.bus.emit('workers_assigned', { role, assigned: result.workersAssigned });
    return result;
  }

  getEffectiveNestCapacity(state: GameState): number {
    const base = state.resources.nestCapacity;
    const effects = getEffects('warehouse', state.buildings.warehouse.level);
    return base + (effects.nestCapacity ?? 0);
  }
}
