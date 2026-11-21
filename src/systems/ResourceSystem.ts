import type { EventBus } from '../engine/EventBus';
import type { EventSink } from '../engine/events';
import type { GameState, ResourceRemainder } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { creditWhole, upgradeCost } from '../utils/math';
import { chainedShare, completedShare } from '../utils/decay';
import { MS_PER_SEC, TICK_MS } from '../data/constants';
import { resourceBalance } from '../data/balance/resources';
import { combatBalance } from '../data/balance/combat';
import { roleBalance } from '../data/balance/roles';
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
  /** Food consumed per second: workers × their upkeep, plus the army's upkeep (Story 4.4). */
  foodConsumedPerSec: number;
  /** Wood produced per second: gatherers plus forest territory. */
  woodPerSec: number;
  /** Stone produced per second: diggers plus mountain territory. */
  stonePerSec: number;
  /** Nectar produced per second: foragers plus meadow territory. */
  nectarPerSec: number;
}

/**
 * Soldiers alive (Story 4.4): trained and in training. Training never changes
 * the total (every soldier who leaves the pipeline joins the army), so the
 * army's upkeep stays the same across any step, and offline catch-up's
 * closed-form food matches the live ticks.
 */
export function armySize(state: GameState): number {
  return state.combatSoldiers + state.soldierPipeline.count;
}

/** Food the army eats per second (`combatBalance.army.upkeepFoodPerSec` a soldier, Story 4.4). */
export function armyUpkeepPerSec(state: GameState): number {
  return armySize(state) * combatBalance.army.upkeepFoodPerSec;
}

/**
 * Starving (Story 1.32, Story 4.4): the food store is empty and the colony
 * eats more than it makes. A starving colony trains no new soldiers.
 */
export function isStarving(state: GameState, territoryBonuses?: TerritoryBonuses): boolean {
  if (state.resources.food > 0) return false;
  const r = computeResourceRates(state, territoryBonuses);
  return r.foodProducedPerSec - r.foodConsumedPerSec < 0;
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
  const unassignedCount = workers - getAssignedWorkers(state);

  const prodMult = productionMultiplier(state.phase, state.prestige.legacyPoints);
  const workerEff = workerEfficiency(workers);

  const foodProducedPerSec = (
    (gatherCount * roleBalance.gatherFoodPerSec + Math.max(0, unassignedCount) * roleBalance.idleFoodPerSec)
    * prodMult * workerEff * prestigeBonuses.food * prestigeBonuses.workerEfficiency
    * (1 + mutationEffects.gatherRate)
  );
  const foodConsumedPerSec = workers * resourceBalance.upkeepFoodPerSec + armyUpkeepPerSec(state);

  // Basic resources from the roles (Story 3.4, FR36): no territory needed.
  const roleMult = prodMult * workerEff * prestigeBonuses.workerEfficiency;
  const roleWoodRate = gatherCount * roleBalance.gatherWoodPerSec * roleMult;
  const roleStoneRate = assigned.dig * roleBalance.digStonePerSec * roleMult;
  const roleNectarRate = assigned.forage * roleBalance.forageNectarPerSec * roleMult;

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
    woodPerSec: roleWoodRate + territoryWoodRate,
    stonePerSec: roleStoneRate + territoryStoneRate,
    nectarPerSec: roleNectarRate + territoryNectarRate,
  };
}

/**
 * Upgrade definitions: base food cost and cost multiplier (`data/balance/resources.ts`).
 */
interface UpgradeDef {
  baseCost: number;
  costMultiplier: number;
}

const UPGRADES: Record<string, UpgradeDef> = {
  click_power: resourceBalance.clickPower,
};

/** Food cost of an egg-chamber upgrade at its current level, or null for an unknown upgrade. */
export function getUpgradeCost(upgradeId: string, level: number): number | null {
  const def = UPGRADES[upgradeId];
  return def ? upgradeCost(def.baseCost, def.costMultiplier, level) : null;
}

/** A worker job the player can assign. */
export type WorkerRole = 'gather' | 'forage' | 'tend' | 'dig' | 'guard';

/** Workers on a job (researchers are tracked apart; see ResearchSystem). */
export function getAssignedWorkers(state: GameState): number {
  const a = state.workersAssigned;
  return a.gather + a.forage + a.tend + a.dig + a.guard;
}


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
  return resourceBalance.eggsPerTap + clickPowerLevel * resourceBalance.eggsPerTapPerLevel;
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
    dtSec: number = TICK_MS / MS_PER_SEC,
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
    const hatchK = (MS_PER_SEC / resourceBalance.hatchMs) * (1 + tendCount * roleBalance.tendHatchBonusPerWorker)
      * prestigeBonuses.eggLaying * (1 + mutationEffects.hatchRate);
    const matureK = (MS_PER_SEC / resourceBalance.matureMs) * prestigeBonuses.hatching;
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

    // Integer-only nest capacity: the accumulator counts dig-worker time in
    // units of TICK_MS (the saved unit, kept so saves need no migration); every
    // `digMsPerRoom` of one dig worker adds +1 nestCapacity, at any step length.
    const digCount = state.workersAssigned.dig;
    const stepsPerRoom = roleBalance.digMsPerRoom / TICK_MS;
    let capacityAccumulator = state.capacityAccumulator;
    let nestCapacity = state.resources.nestCapacity;
    if (digCount > 0) {
      capacityAccumulator += digCount * (Math.round(dtSec * MS_PER_SEC) / TICK_MS);
      const rooms = Math.floor(capacityAccumulator / stepsPerRoom);
      capacityAccumulator -= rooms * stepsPerRoom;
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
      // Workers and soldiers eat (Story 4.4): an army with no worker left still eats.
      if (state.resources.workers > 0 || armySize(state) > 0) {
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
