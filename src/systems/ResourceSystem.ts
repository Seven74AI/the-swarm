import type { EventBus } from '../engine/EventBus';
import type { EventSink } from '../engine/events';
import type { GameState, ResourceRemainder } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { creditWhole, upgradeCost } from '../utils/math';
import { chainedShare, completedShare } from '../utils/decay';
import { TICK_MS } from '../data/constants';
import { getEffects } from './BuildingSystem';
import { productionMultiplier, workerEfficiency } from '../engine/ProgressionCurve';
import { getPrestigeBonuses } from './PrestigeBonusSystem';
import { getMutationEffects } from './MutationSystem';

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
  const mutationEffects = getMutationEffects(state);
  const workers = state.resources.workers;
  const assigned = state.workersAssigned;
  const gatherCount = assigned.gather;
  const unassignedCount = workers - gatherCount - assigned.tend - assigned.dig - assigned.guard;

  const prodMult = productionMultiplier(state.phase, state.prestige.legacyPoints);
  const workerEff = workerEfficiency(workers);

  const foodProducedPerSec = (
    (gatherCount * 2 + Math.max(0, unassignedCount) * 1)
    * prodMult * workerEff * prestigeBonuses.food * prestigeBonuses.workerEfficiency
    * (1 + mutationEffects.gatherRate)
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

/** Food cost of an egg-chamber upgrade at its current level, or null for an unknown upgrade. */
export function getUpgradeCost(upgradeId: string, level: number): number | null {
  const def = UPGRADES[upgradeId];
  return def ? upgradeCost(def.baseCost, def.costMultiplier, level) : null;
}

/** A worker job the player can assign. */
export type WorkerRole = 'gather' | 'tend' | 'dig' | 'guard';

/** Workers on a job (researchers are tracked apart; see ResearchSystem). */
export function getAssignedWorkers(state: GameState): number {
  const a = state.workersAssigned;
  return a.gather + a.tend + a.dig + a.guard;
}

export const EGG_HATCH_TIME = 50; // ticks (at 1s per tick equivalent, 5x pacing nerf)
export const LARVA_MATURE_TIME = 50; // ticks (5x pacing nerf)
const FOOD_PER_WORKER = 1;
const FOOD_PER_GATHER = 2;
const TEND_MULTIPLIER = 0.25; // each tend worker gives +25% hatch rate
const DIG_TICKS_PER_ROOM = 20; // dig-worker ticks per +1 nestCapacity

/**
 * ResourceSystem handles all resource mutations: clicking, ticking, buying.
 * Uses rate-based pipelines instead of per-item timer arrays.
 *
 * #25 Two-phase tick: Phase 1 computes all rates from current state (read-only),
 * Phase 2 applies all deltas (write-only), Phase 3 clamps all resources >= 0.
 * This prevents ordering bugs where production/consumption order matters.
 */
/** Eggs one tap lays at a Click Power level (FR1: 1 per tap plus 1 per level). */
export function eggsPerTap(clickPowerLevel: number): number {
  return 1 + clickPowerLevel;
}

export class ResourceSystem {
  constructor(private bus: EventBus) {}

  /**
   * Lay eggs. Adds eggs and pushes them into the hatching pipeline.
   */
  clickEgg(state: GameState): GameState {
    const eggsPerClick = eggsPerTap(state.upgrades.click_power ?? 0);

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
  tick(
    state: GameState,
    territoryBonuses?: TerritoryBonuses,
    dtSec: number = 0.05,
    skipDeterministicResources: boolean = false,
    /** Where tick events go: the game loop passes the tick's queue (AR18). */
    events: EventSink = this.bus,
  ): GameState {
    // ─── Phase 1: Compute all rates from current state (read-only) ───

    const rates = computeResourceRates(state, territoryBonuses);

    // Prestige tree production bonuses
    const prestigeBonuses = getPrestigeBonuses(state);
    const mutationEffects = getMutationEffects(state);

    // Pipeline rate constants (per second): a pipeline completes `count × k` items a second.
    const tendCount = state.workersAssigned.tend;
    const hatchK = (1 / EGG_HATCH_TIME) * (1 + tendCount * TEND_MULTIPLIER)
      * prestigeBonuses.eggLaying * (1 + mutationEffects.hatchRate);
    const matureK = (1 / LARVA_MATURE_TIME) * prestigeBonuses.hatching;
    const eggPipe = state.eggPipeline;
    const larvaPipe = state.larvaPipeline;

    // ─── Phase 2: Apply all deltas (write-only) ───

    // Exact flow over the step (Story 2.5): one long step moves what many short ones do.
    // An egg can hatch and mature within one long step, so larvae also gain the chained share.
    const hatchDelta = eggPipe.count * completedShare(hatchK, dtSec);
    const matureDelta = larvaPipe.count * completedShare(matureK, dtSec)
      + eggPipe.count * chainedShare(hatchK, matureK, dtSec);

    let eggs = state.resources.eggs;
    let larvae = state.resources.larvae;
    let newWorkers = state.resources.workers;
    let food = state.resources.food;
    let wood = state.resources.wood;
    let stone = state.resources.stone;
    let nectar = state.resources.nectar;
    let remainder = state.resourceRemainder;

    let eggsChanged = false;
    let larvaeChanged = false;
    let workersChanged = false;
    let foodChanged = false;
    let woodChanged = false;
    let stoneChanged = false;
    let nectarChanged = false;

    // Integer-only nest capacity: each dig worker adds one per tick of game time
    // (TICK_MS, so any step length); 20 make +1 nestCapacity (1 capacity/sec/dig worker).
    const digCount = state.workersAssigned.dig;
    let capacityAccumulator = state.capacityAccumulator;
    let nestCapacity = state.resources.nestCapacity;
    if (digCount > 0) {
      capacityAccumulator += digCount * (Math.round(dtSec * 1000) / TICK_MS);
      const rooms = Math.floor(capacityAccumulator / DIG_TICKS_PER_ROOM);
      capacityAccumulator -= rooms * DIG_TICKS_PER_ROOM;
      nestCapacity += rooms;
    }
    const effectiveNestCapacity = nestCapacity + (getEffects('warehouse', state.buildings.warehouse.level).nestCapacity ?? 0);

    // Egg pipeline progress
    let newEggCount = eggPipe.count;
    let newEggProgress = eggPipe.progress + hatchDelta;
    let hatched = Math.floor(newEggProgress);
    newEggProgress -= hatched;
    // Never more than the pipeline holds (every hatched egg leaves it).
    hatched = Math.min(hatched, eggs, newEggCount);

    if (hatched > 0) {
      eggs -= hatched;
      larvae += hatched;
      newEggCount -= hatched;
      eggsChanged = true;
      larvaeChanged = true;
    }

    // Larva pipeline progress: every hatched egg enters it.
    let newLarvaCount = larvaPipe.count + hatched;
    let newLarvaProgress = larvaPipe.progress + matureDelta;
    const matured = Math.floor(newLarvaProgress);
    newLarvaProgress -= matured;

    if (matured > 0) {
      const raw = Math.min(matured, larvae, newLarvaCount);
      // Cap enforcement: clamp to available nest capacity
      const capacityRemaining = Math.max(0, effectiveNestCapacity - newWorkers);
      const actual = Math.min(raw, capacityRemaining);
      larvae -= actual;
      newWorkers += actual;
      newLarvaCount -= actual;
      if (actual > 0) {
        larvaeChanged = true;
        workersChanged = true;
      }
    }

    // Deterministic resource production (skipped during closed-form offline catch-up).
    // Credited in whole units; the fraction carries in resourceRemainder (Story 2.5).
    if (!skipDeterministicResources) {
      const credit = (key: keyof ResourceRemainder, amount: number, delta: number): number => {
        const r = creditWhole(amount, remainder[key], delta);
        remainder = { ...remainder, [key]: r.remainder };
        return r.amount;
      };
      const workers = state.resources.workers;
      if (workers > 0) {
        const netFood = (rates.foodProducedPerSec - rates.foodConsumedPerSec) * dtSec;
        const before = food;
        food = credit('food', food, netFood);
        if (food !== before) foodChanged = true;
      }
      if (rates.woodPerSec > 0) {
        wood = credit('wood', wood, rates.woodPerSec * dtSec);
        woodChanged = true;
      }
      if (rates.stonePerSec > 0) {
        stone = credit('stone', stone, rates.stonePerSec * dtSec);
        stoneChanged = true;
      }
      if (rates.nectarPerSec > 0) {
        nectar = credit('nectar', nectar, rates.nectarPerSec * dtSec);
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
        nestCapacity,
      },
      eggPipeline: { count: newEggCount, progress: newEggProgress },
      larvaPipeline: { count: newLarvaCount, progress: newLarvaProgress },
      capacityAccumulator,
      resourceRemainder: remainder,
    };

    if (eggsChanged) events.emit('eggs_changed', { eggs: result.resources.eggs });
    if (larvaeChanged) events.emit('larvae_changed', { larvae: result.resources.larvae });
    if (foodChanged) events.emit('food_changed', { food: result.resources.food });
    if (woodChanged) events.emit('wood_changed', { wood: result.resources.wood });
    if (stoneChanged) events.emit('stone_changed', { stone: result.resources.stone });
    if (nectarChanged) events.emit('nectar_changed', { nectar: result.resources.nectar });
    if (workersChanged) events.emit('workers_changed', { workers: result.resources.workers });

    return result;
  }

  buyUpgrade(state: GameState, upgradeId: string): GameState {
    const currentLevel = state.upgrades[upgradeId] ?? 0;
    const cost = getUpgradeCost(upgradeId, currentLevel);
    if (cost === null) return state;
    if (state.resources.food < cost) return state;

    const result: GameState = {
      ...state,
      resources: { ...state.resources, food: state.resources.food - cost },
      upgrades: { ...state.upgrades, [upgradeId]: currentLevel + 1 },
    };

    this.bus.emit('upgrade_purchased', { upgradeId, level: currentLevel + 1 });
    return result;
  }

  assignWorker(state: GameState, role: WorkerRole): GameState {
    const assigned = state.workersAssigned;
    if (getAssignedWorkers(state) >= state.resources.workers) return state;

    const result: GameState = {
      ...state,
      workersAssigned: { ...assigned, [role]: assigned[role] + 1 },
    };

    this.bus.emit('workers_assigned', { role, assigned: result.workersAssigned });
    return result;
  }

  unassignWorker(state: GameState, role: WorkerRole): GameState {
    const assigned = state.workersAssigned;
    if (assigned[role] <= 0) return state;

    const result: GameState = {
      ...state,
      workersAssigned: { ...assigned, [role]: assigned[role] - 1 },
    };

    this.bus.emit('workers_assigned', { role, assigned: result.workersAssigned });
    return result;
  }

}
