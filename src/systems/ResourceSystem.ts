import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { upgradeCost } from '../utils/math';
import { getEffects } from './BuildingSystem';
import { productionMultiplier, workerEfficiency } from '../engine/ProgressionCurve';

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

export const EGG_HATCH_TIME = 10; // ticks (at 1s per tick equivalent)
export const LARVA_MATURE_TIME = 10; // ticks
const FOOD_PER_WORKER = 1;
const FOOD_PER_GATHER = 2;
const TEND_MULTIPLIER = 0.25; // each tend worker gives +25% hatch rate

/**
 * ResourceSystem handles all resource mutations: clicking, ticking, buying.
 * Uses rate-based pipelines instead of per-item timer arrays.
 *
 * #25 Two-phase tick: Phase 1 computes all rates from current state (read-only),
 * Phase 2 applies all deltas (write-only), Phase 3 clamps all resources >= 0.
 * This prevents ordering bugs where production/consumption order matters.
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
   * Process a single game tick with fixed 50ms timestep.
   * dtSec is the delta in seconds (0.05 for 50ms tick).
   *
   * Rate-based pipelines replace per-item timer iteration → O(1).
   * Two-phase: compute all rates first, then apply all deltas.
   */
  tick(state: GameState, territoryBonuses?: TerritoryBonuses, dtSec: number = 1): GameState {
    // ─── Phase 1: Compute all rates from current state (read-only) ───

    // Egg pipeline rate
    const eggPipe = state.eggPipeline;
    const tendCount = state.workersAssigned.tend;
    const hatchRate = eggPipe.count > 0
      ? (eggPipe.count / EGG_HATCH_TIME) * (1 + tendCount * TEND_MULTIPLIER)
      : 0;

    // Larva pipeline rate
    const larvaPipe = state.larvaPipeline;
    const matureRate = larvaPipe.count > 0
      ? larvaPipe.count / LARVA_MATURE_TIME
      : 0;

    // Food rates
    const workers = state.resources.workers;
    const assigned = state.workersAssigned;
    const gatherCount = assigned.gather;
    const unassignedCount = workers - gatherCount - assigned.tend - assigned.dig - assigned.guard;

    // Progression curve: production multiplier from phase + legacy points
    const prodMult = productionMultiplier(state.phase, state.prestige.legacyPoints);
    // Worker efficiency soft cap (diminishing returns above 500 workers)
    const workerEff = workerEfficiency(workers);

    const foodProduced = Math.floor(
      (gatherCount * FOOD_PER_GATHER + Math.max(0, unassignedCount) * FOOD_PER_WORKER)
      * prodMult * workerEff,
    );
    const foodConsumed = Math.floor(workers / 2);

    // Territory bonus rates
    let territoryFoodRate = 0;
    let territoryStoneRate = 0;
    let territoryNectarRate = 0;
    if (workers > 0 && territoryBonuses) {
      if (territoryBonuses.food > 0) territoryFoodRate = Math.floor(workers * territoryBonuses.food * prodMult * workerEff);
      if (territoryBonuses.stone > 0) territoryStoneRate = Math.floor(workers * territoryBonuses.stone * prodMult);
      if (territoryBonuses.nectar > 0) territoryNectarRate = Math.floor(workers * territoryBonuses.nectar * prodMult);
    }

    // ─── Phase 2: Apply all deltas (write-only) ───

    // Scale by dtSec (e.g., 0.05 for 50ms)
    const hatchDelta = hatchRate * dtSec;
    const matureDelta = matureRate * dtSec;
    const foodDelta = (foodProduced - foodConsumed) * dtSec;
    const territoryFoodDelta = territoryFoodRate * dtSec;
    const territoryStoneDelta = territoryStoneRate * dtSec;
    const territoryNectarDelta = territoryNectarRate * dtSec;

    let eggs = state.resources.eggs;
    let larvae = state.resources.larvae;
    let newWorkers = workers;
    let food = state.resources.food;
    let wood = state.resources.wood;
    let stone = state.resources.stone;
    let nectar = state.resources.nectar;

    let eggsChanged = false;
    let larvaeChanged = false;
    let workersChanged = false;
    let foodChanged = false;
    let woodChanged = false;
    let stoneChanged = false;
    let nectarChanged = false;

    // Egg pipeline progress
    let newEggCount = eggPipe.count;
    let newEggProgress = eggPipe.progress + hatchDelta;
    const hatched = Math.floor(newEggProgress);
    newEggProgress -= hatched;

    if (hatched > 0) {
      const actual = Math.min(hatched, eggs);
      eggs -= actual;
      larvae += actual;
      newEggCount = Math.max(0, newEggCount - actual);
      eggsChanged = true;
      larvaeChanged = true;
    }

    // Larva pipeline progress
    let newLarvaCount = larvaPipe.count + (hatched > 0 ? hatched : 0);
    let newLarvaProgress = larvaPipe.progress + matureDelta;
    const matured = Math.floor(newLarvaProgress);
    newLarvaProgress -= matured;

    if (matured > 0) {
      const actual = Math.min(matured, larvae);
      larvae -= actual;
      newWorkers += actual;
      newLarvaCount = Math.max(0, newLarvaCount - actual);
      larvaeChanged = true;
      workersChanged = true;
    }

    // Food
    if (workers > 0) {
      food += foodDelta;
      foodChanged = true;
    }

    // Territory bonuses
    if (territoryFoodDelta > 0) {
      food += territoryFoodDelta;
      foodChanged = true;
    }
    if (territoryStoneDelta > 0) {
      stone += territoryStoneDelta;
      stoneChanged = true;
    }
    if (territoryNectarDelta > 0) {
      nectar += territoryNectarDelta;
      nectarChanged = true;
    }

    // ─── Phase 3: Clamp all resources >= 0 ───
    eggs = Math.max(0, eggs);
    larvae = Math.max(0, larvae);
    newWorkers = Math.max(0, newWorkers);
    food = Math.max(0, food);
    wood = Math.max(0, wood);
    stone = Math.max(0, stone);
    nectar = Math.max(0, nectar);

    const result: GameState = {
      ...state,
      resources: {
        ...state.resources,
        eggs,
        larvae,
        workers: newWorkers,
        food,
        wood,
        stone,
        nectar,
      },
      eggPipeline: { count: newEggCount, progress: newEggProgress },
      larvaPipeline: { count: newLarvaCount, progress: newLarvaProgress },
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
