import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { upgradeCost } from '../utils/math';
import { getEffects } from './BuildingSystem';
import { productionMultiplier, workerEfficiency } from '../engine/ProgressionCurve';
import { getPrestigeBonuses } from './PrestigeBonusSystem';

/**
 * Per-second deterministic resource rates computed from game state.
 * These are the "closed-form" inputs for offline progression.
 */
export interface ResourceRates {
  /** Gross food produced per second (before consumption). */
  foodProducedPerSec: number;
  /** Food consumed per second (workers / 2). */
  foodConsumedPerSec: number;
  /** Wood produced per second from territory bonuses. */
  woodPerSec: number;
  /** Stone produced per second from territory bonuses. */
  stonePerSec: number;
  /** Nectar produced per second from territory bonuses. */
  nectarPerSec: number;
}

/**
 * Compute deterministic resource production rates from the current game state.
 * Pure function — no side-effects, no mutation.
 *
 * These rates are used both for per-tick simulation and for closed-form
 * offline resource computation (rate × time).
 */
export function computeResourceRates(
  state: GameState,
  territoryBonuses?: TerritoryBonuses,
): ResourceRates {
  const prestigeBonuses = getPrestigeBonuses(state);
  const workers = state.resources.workers;
  const assigned = state.workersAssigned;
  const gatherCount = assigned.gather;
  const unassignedCount = workers - gatherCount - assigned.tend - assigned.dig - assigned.guard;

  const prodMult = productionMultiplier(state.phase, state.prestige.legacyPoints);
  const workerEff = workerEfficiency(workers);

  const foodProducedPerSec = (
    (gatherCount * 2 + Math.max(0, unassignedCount) * 1)
    * prodMult * workerEff * prestigeBonuses.food * prestigeBonuses.workerEfficiency
  );
  const foodConsumedPerSec = workers / 2;

  let territoryFoodRate = 0;
  let territoryStoneRate = 0;
  let territoryWoodRate = 0;
  let territoryNectarRate = 0;
  if (workers > 0 && territoryBonuses) {
    if (territoryBonuses.food > 0) territoryFoodRate = workers * territoryBonuses.food * prodMult * workerEff;
    if (territoryBonuses.stone > 0) territoryStoneRate = workers * territoryBonuses.stone * prodMult;
    if (territoryBonuses.wood > 0) territoryWoodRate = workers * territoryBonuses.wood * prodMult;
    if (territoryBonuses.nectar > 0) territoryNectarRate = workers * territoryBonuses.nectar * prodMult;
  }

  return {
    foodProducedPerSec: foodProducedPerSec + territoryFoodRate,
    foodConsumedPerSec,
    woodPerSec: territoryWoodRate,
    stonePerSec: territoryStoneRate,
    nectarPerSec: territoryNectarRate,
  };
}

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
  tick(state: GameState, territoryBonuses?: TerritoryBonuses, dtSec: number = 0.05, skipDeterministicResources: boolean = false): GameState {
    // ─── Phase 1: Compute all rates from current state (read-only) ───

    const rates = computeResourceRates(state, territoryBonuses);

    // Prestige tree production bonuses
    const prestigeBonuses = getPrestigeBonuses(state);

    // Egg pipeline rate
    const eggPipe = state.eggPipeline;
    const tendCount = state.workersAssigned.tend;
    const hatchRate = eggPipe.count > 0
      ? (eggPipe.count / EGG_HATCH_TIME) * (1 + tendCount * TEND_MULTIPLIER) * prestigeBonuses.eggLaying
      : 0;

    // Larva pipeline rate
    const larvaPipe = state.larvaPipeline;
    const matureRate = larvaPipe.count > 0
      ? (larvaPipe.count / LARVA_MATURE_TIME) * prestigeBonuses.hatching
      : 0;

    // ─── Phase 2: Apply all deltas (write-only) ───

    // Scale by dtSec (e.g., 0.05 for 50ms)
    const hatchDelta = hatchRate * dtSec;
    const matureDelta = matureRate * dtSec;

    let eggs = state.resources.eggs;
    let larvae = state.resources.larvae;
    let newWorkers = state.resources.workers;
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

    // Integer-only nest capacity accumulation: accumulate digCount each tick.
    // When accumulator >= 20, gain +1 nestCapacity (1 capacity/sec/dig worker).
    const digCount = state.workersAssigned.dig;
    let capacityAccumulator = state.capacityAccumulator;
    if (digCount > 0) {
      capacityAccumulator += digCount;
      while (capacityAccumulator >= 20) {
        capacityAccumulator -= 20;
        state = {
          ...state,
          resources: { ...state.resources, nestCapacity: state.resources.nestCapacity + 1 },
        };
      }
    }
    const effectiveNestCapacity = this.getEffectiveNestCapacity(state);

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
      const raw = Math.min(matured, larvae);
      // Cap enforcement: clamp to available nest capacity
      const capacityRemaining = Math.max(0, effectiveNestCapacity - newWorkers);
      const actual = Math.min(raw, capacityRemaining);
      larvae -= actual;
      newWorkers += actual;
      newLarvaCount = Math.max(0, newLarvaCount - actual);
      if (actual > 0) {
        larvaeChanged = true;
        workersChanged = true;
      }
    }

    // Deterministic resource production (skipped during closed-form offline catch-up)
    if (!skipDeterministicResources) {
      const workers = state.resources.workers;
      if (workers > 0) {
        const netFood = (rates.foodProducedPerSec - rates.foodConsumedPerSec) * dtSec;
        food += netFood;
        if (netFood !== 0) foodChanged = true;
      }
      if (rates.woodPerSec > 0) {
        wood += rates.woodPerSec * dtSec;
        woodChanged = true;
      }
      if (rates.stonePerSec > 0) {
        stone += rates.stonePerSec * dtSec;
        stoneChanged = true;
      }
      if (rates.nectarPerSec > 0) {
        nectar += rates.nectarPerSec * dtSec;
        nectarChanged = true;
      }
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
        nestCapacity: state.resources.nestCapacity,
      },
      eggPipeline: { count: newEggCount, progress: newEggProgress },
      larvaPipeline: { count: newLarvaCount, progress: newLarvaProgress },
      capacityAccumulator,
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
