import type { EventBus } from '../engine/EventBus';
import type { EventSink } from '../engine/events';
import type { GameState, ResourceRemainder } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { creditWhole, upgradeCost } from '../utils/math';
import { chainedShare, completedShare } from '../utils/decay';
import { MS_PER_SEC, PERCENT, TICK_MS } from '../data/constants';
import { resourceBalance } from '../data/balance/resources';
import { NEST_UPGRADE_IDS, upgradeBalance, type UpgradeEffects, type UpgradeId } from '../data/balance/upgrades';
import { Phase } from '../phases/phases';
import { combatBalance } from '../data/balance/combat';
import { roleBalance } from '../data/balance/roles';
import { getEffects } from './BuildingSystem';
import { addDigPoints, digRate } from './Dig';
import { productionMultiplierFor } from '../engine/ProgressionCurve';
import { getCrowding } from './Crowding';
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
/**
 * Where the food comes from and where it goes (Story 9.12, the resource
 * sheet's food block): the parts `computeResourceRates` adds up, so IN −
 * EATEN is always the net rate WRKR shows. Counts are the colony's, and
 * `oneGathererFeeds` is how many eaters one gatherer's food keeps fed, at the
 * current multipliers (at least 1 while a gatherer brings in anything).
 */
export interface FoodParts {
  readonly in: { readonly gatherers: number; readonly idle: number; readonly territory: number; readonly total: number };
  readonly eaten: { readonly workers: number; readonly soldiers: number; readonly total: number };
  readonly counts: { readonly gatherers: number; readonly idle: number; readonly workers: number; readonly soldiers: number };
  /** What one more worker eats a second, and one more soldier (Story 9.12: the cost of an eater). */
  readonly perWorkerEats: number;
  readonly perSoldierEats: number;
  readonly oneGathererFeeds: number;
}

function foodFlow(state: GameState, territoryBonuses?: TerritoryBonuses): FoodParts {
  const prestigeBonuses = getPrestigeBonuses(state);
  const mutationEffects = getMutationEffects(state);
  const workers = state.resources.workers;
  const gatherCount = state.workersAssigned.gather;
  const idleCount = Math.max(0, workers - getAssignedWorkers(state));
  const prodMult = productionMultiplierFor(state);
  // Crowding (Story 9.13) slows the work; upkeep is never cut.
  const workerEff = getCrowding(state).multiplier;
  // The Fungus Garden feeds gatherers only (Story 4.7).
  const gardenBonus = getEffects('fungus_garden', state.buildings.fungus_garden?.level ?? 0).gatherFoodBonus ?? 0;
  const mult = prodMult * workerEff * prestigeBonuses.food * prestigeBonuses.workerEfficiency * (1 + mutationEffects.gatherRate);
  const perGatherer = roleBalance.gatherFoodPerSec * (1 + gardenBonus) * mult;
  const gatherers = gatherCount * perGatherer;
  const idle = idleCount * roleBalance.idleFoodPerSec * mult;
  const territory = workers > 0 && territoryBonuses && territoryBonuses.food > 0 ? workers * territoryBonuses.food * prodMult * workerEff : 0;
  const upkeepShare = 1 - upgradeTotal(state, 'lean_rations', 'upkeepCutPercent') / PERCENT;
  const perWorkerEats = resourceBalance.upkeepFoodPerSec * upkeepShare;
  const workersEat = workers * perWorkerEats;
  const soldiersEat = armyUpkeepPerSec(state);
  return {
    in: { gatherers, idle, territory, total: gatherers + idle + territory },
    eaten: { workers: workersEat, soldiers: soldiersEat, total: workersEat + soldiersEat },
    counts: { gatherers: gatherCount, idle: idleCount, workers, soldiers: armySize(state) },
    perWorkerEats,
    perSoldierEats: combatBalance.army.upkeepFoodPerSec,
    oneGathererFeeds: perWorkerEats > 0 && perGatherer > 0 ? Math.max(1, Math.floor(perGatherer / perWorkerEats)) : 0,
  };
}

/** The food block's parts (Story 9.12). Pass the territory bonuses as `netFoodPerSec` does. */
export function foodParts(state: GameState, territoryBonuses?: TerritoryBonuses): FoodParts {
  return foodFlow(state, territoryBonuses);
}

export function computeResourceRates(
  state: GameState,
  territoryBonuses?: TerritoryBonuses,
): ResourceRates {
  const prestigeBonuses = getPrestigeBonuses(state);
  const workers = state.resources.workers;
  const assigned = state.workersAssigned;
  const gatherCount = assigned.gather;

  const prodMult = productionMultiplierFor(state);
  const workerEff = getCrowding(state).multiplier;

  const food = foodFlow(state, territoryBonuses);
  const foodProducedPerSec = food.in.gatherers + food.in.idle;
  const foodConsumedPerSec = food.eaten.total;

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
    territoryFoodRate = food.in.territory;
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

const isKnownUpgrade = (id: string): id is UpgradeId => id in upgradeBalance;
const isNestUpgrade = (id: UpgradeId): boolean => (NEST_UPGRADE_IDS as readonly string[]).includes(id);

/** Food cost of a food upgrade (`data/balance/upgrades.ts`) at its current level, or null for an unknown upgrade. */
export function getUpgradeCost(upgradeId: string, level: number): number | null {
  if (!isKnownUpgrade(upgradeId)) return null;
  const def = upgradeBalance[upgradeId];
  return upgradeCost(def.baseCost, def.costMultiplier, level);
}

/** The level owned of a food upgrade (0 when never bought). */
export function upgradeLevel(state: GameState, upgradeId: string): number {
  return state.upgrades[upgradeId] ?? 0;
}

/** One effect of an upgrade at the level owned: its per-level amount × the level. */
function upgradeTotal(state: GameState, upgradeId: UpgradeId, effect: keyof UpgradeEffects): number {
  return upgradeLevel(state, upgradeId) * (upgradeBalance[upgradeId].perLevel[effect] ?? 0);
}

/**
 * Whether a food upgrade is on sale now, price aside (Story 4.6): known, below
 * its last level, and for the egg-chamber upgrades, only in Egg Laying.
 * Click Power is sold in every phase (NEST in Phase 1, BUILD after).
 */
export function isUpgradeOpen(state: GameState, upgradeId: string): boolean {
  return upgradeRefusal(state, upgradeId) === null;
}

/** Why a food upgrade is not on sale now, price aside, or null when it is. */
export function upgradeRefusal(state: GameState, upgradeId: string): 'unknown_id' | 'locked' | 'max_level' | null {
  if (!isKnownUpgrade(upgradeId)) return 'unknown_id';
  if (isNestUpgrade(upgradeId) && state.phase !== Phase.EGG_LAYING) return 'locked';
  const max = upgradeBalance[upgradeId].maxLevel;
  if (max !== undefined && upgradeLevel(state, upgradeId) >= max) return 'max_level';
  return null;
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
      * prestigeBonuses.eggLaying * (1 + mutationEffects.hatchRate)
      * (1 + upgradeTotal(state, 'warm_brood', 'hatchPercent') / PERCENT);
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

    // DIG (Story 9.2): diggers dig on their own at a slow rate, whole points
    // only (the fraction carries), so any step length digs the same rooms.
    const digRateNow = digRate(state);
    let dug: GameState = state;
    if (digRateNow > 0) {
      const exact = state.dig.carry + digRateNow * (Math.round(dtSec * MS_PER_SEC) / MS_PER_SEC);
      const whole = Math.floor(exact);
      dug = addDigPoints({ ...state, dig: { ...state.dig, carry: exact - whole } }, whole);
    }
    const nestCapacity = dug.resources.nestCapacity;
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
      dig: dug.dig,
      roomJobs: dug.roomJobs,
      resourceRemainder: remainder,
    };

    if (result.dig.roomsDug > state.dig.roomsDug) events.emit('room_opened', { roomsDug: result.dig.roomsDug });
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
    if (!isUpgradeOpen(state, upgradeId) || !isKnownUpgrade(upgradeId)) return state;
    const currentLevel = upgradeLevel(state, upgradeId);
    const cost = getUpgradeCost(upgradeId, currentLevel);
    if (cost === null) return state;
    if (state.resources.food < cost) return state;
    // Rooms are bought once, at purchase (Story 4.6), like the rooms DIG adds.
    const rooms = upgradeBalance[upgradeId].perLevel.nestCapacity ?? 0;

    const result: GameState = {
      ...state,
      resources: { ...state.resources, food: state.resources.food - cost, nestCapacity: state.resources.nestCapacity + rooms },
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
