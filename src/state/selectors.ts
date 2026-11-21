import { computed, type ReadonlySignal } from '@preact/signals-core';
import { gameState } from './gameSignal';
import type { GameState, PhaseGoal } from './GameState';
import { getEffects } from '../systems/BuildingSystem';
import { computeResourceRates } from '../systems/ResourceSystem';
import { affordableKeys } from './affordances';
import { getBuildAction, getNextAction, type NextAction } from '../systems/NextAction';
import { assignedTotal, freeWorkers, getReallocation, workforceTotal, type Reallocation } from '../systems/Workforce';
import { TerritorySystem } from '../systems/TerritorySystem';
import { getSoldierDefense, getSoldierMaxHp, getSoldierSpeed, getSoldierStrength } from '../systems/SoldierSystem';
import { canChoose } from '../systems/DecisionSystem';
import { getDecision } from '../data/content/decisions';
import { canPurchaseMutation, isMutationUnlocked } from '../systems/MutationSystem';
import {
  canBuildAuto,
  canResearch,
  getAutoEggRate,
  type AutomationBuildingType,
  type ResearchType,
} from '../systems/AutomationSystem';
import {
  getConversionDefs,
  getConversionRate,
  isConversionUnlocked,
  type ConversionId,
} from '../systems/ResourceConversionSystem';
import { canBuild, type BuildingType } from '../systems/BuildingSystem';
import { canStartProject, getAssignedResearchers, getProjectStatus } from '../systems/ResearchSystem';
import { isPrestigeAvailable } from '../systems/PrestigeSystem';
import type { ResearchProjectId, ResearchProjectStatus } from './GameState';
import { conditionMet, goalFor, goalPercent, type GoalCondition, type Transition } from '../phases/transitions';

export type { GoalCondition, Transition } from '../phases/transitions';
export type { MoveSource, Reallocation } from '../systems/Workforce';
export type { ActionIntent, NextAction, NextActionRule, NoAction, SuggestedAction } from '../systems/NextAction';

/**
 * Slice selectors over the single game-state signal (ADR 0001, arch D5, #186).
 *
 * `gameState` is one signal: an effect that reads `gameState.value.x` re-runs on every write, 20 times a
 * second. A `computed` slice notifies its dependents only when the value it returns changes (`===`), so
 * an effect that reads `selectBuildings.value` stays quiet on a tick that only changes food.
 *
 * Rules:
 * - UI code reads state only through these selectors, never `gameState.value`.
 * - Slices return the state's own references; never build a fresh object or array here, or the
 *   selector notifies on every write. Derive primitives (numbers, booleans, strings) instead.
 * - Ticks write one new state with spreads; untouched slices keep their reference, which is what
 *   keeps their selectors quiet. Recycling or mutating state objects would break this.
 */

function slice<K extends keyof GameState>(key: K): ReadonlySignal<GameState[K]> {
  return computed(() => gameState.value[key]);
}

// --- Top-level slices -------------------------------------------------------------------------

export const selectPhase = slice('phase');
export const selectPaused = slice('paused');
export const selectResources = slice('resources');
export const selectEggPipeline = slice('eggPipeline');
export const selectLarvaPipeline = slice('larvaPipeline');
export const selectSoldierPipeline = slice('soldierPipeline');
export const selectWorkersAssigned = slice('workersAssigned');
export const selectSoldiers = slice('soldiers');
export const selectBuildings = slice('buildings');
export const selectTerritory = slice('territory');
export const selectMapTiles = slice('mapTiles');
export const selectExpeditions = slice('expeditions');
export const selectSpaceExplorations = slice('spaceExplorations');
export const selectDiscoveredPlanets = slice('discoveredPlanets');
export const selectSpaceships = slice('spaceships');
export const selectStats = slice('stats');
export const selectCombatSoldiers = slice('combatSoldiers');
export const selectSoldierStats = slice('soldierStats');
export const selectEquipment = slice('equipment');
export const selectLastBattle = slice('lastBattle');
export const selectCombatResources = slice('combatResources');
export const selectBattlesWon = slice('battlesWon');
export const selectBattlesLost = slice('battlesLost');
export const selectVictoryAchieved = slice('victoryAchieved');
export const selectPhaseGoal = slice('phaseGoal');
export const selectDecision = slice('decision');
/** The open decision event (Story 1.28), or null. */
export const selectOpenDecision = computed(() => selectDecision.value.open);
/** The id of the open decision event: changes only when an event opens or closes. */
export const selectOpenDecisionId = computed(() => selectDecision.value.open?.id ?? null);
export const selectLifetime = slice('lifetime');
export const selectSpaceship = slice('spaceship');
export const selectSpaceProbes = slice('spaceProbes');
export const selectDiscoveries = slice('discoveries');
export const selectPrestige = slice('prestige');
export const selectAutoProduction = slice('autoProduction');
export const selectOfflineEfficiency = slice('offlineEfficiency');
export const selectResearch = slice('research');
export const selectConversions = slice('conversions');
export const selectPrestigeTree = slice('prestigeTree');
export const selectMutations = slice('mutations');
export const selectUpgrades = slice('upgrades');

// --- Derived slices (primitives, so they notify only when the number changes) ---------------

export const selectTotalClicks = computed(() => selectStats.value.totalClicks);
export const selectWorkers = computed(() => selectResources.value.workers);
export const selectNestCapacity = computed(() => selectResources.value.nestCapacity);
export const selectLarvae = computed(() => selectResources.value.larvae);
export const selectResearchers = computed(() => selectWorkersAssigned.value.researchers);

/** Base nest capacity plus the warehouse bonus (there is no `getEffectiveNestCapacity()`). */
export const selectEffectiveNestCapacity = computed(
  () =>
    selectResources.value.nestCapacity +
    (getEffects('warehouse', selectBuildings.value.warehouse.level).nestCapacity ?? 0),
);

/** Net food per second (unfloored, for rate display). Notifies only when the number changes. */
export const selectFoodRatePerSec = computed(() => {
  const rates = computeResourceRates(gameState.value);
  return rates.foodProducedPerSec - rates.foodConsumedPerSec;
});

/** Net food per second, floored (WRKR summary). Recomputes on every write, notifies only on change. */
export const selectNetFoodPerSec = computed(() => {
  return Math.floor(selectFoodRatePerSec.value);
});

// --- BUILD's rules, per item (Story 1.24): primitives, so a card re-renders only when its answer changes ---

function memo<K, V>(cache: Map<K, ReadonlySignal<V>>, key: K, make: () => V): ReadonlySignal<V> {
  let sel = cache.get(key);
  if (!sel) {
    sel = computed(make);
    cache.set(key, sel);
  }
  return sel;
}

const canBuilds = new Map<BuildingType, ReadonlySignal<boolean>>();
const canChooses = new Map<string, ReadonlySignal<boolean>>();

/** Whether a choice of the open decision event can be taken now (Story 1.28; false when none is open). */
export function selectCanChoose(choiceId: string): ReadonlySignal<boolean> {
  return memo(canChooses, choiceId, () => {
    const open = gameState.value.decision.open;
    return open !== null && canChoose(gameState.value, getDecision(open.id), choiceId);
  });
}
const researchStatuses = new Map<ResearchProjectId, ReadonlySignal<ResearchProjectStatus>>();
const canStarts = new Map<ResearchProjectId, ReadonlySignal<boolean>>();
const conversionUnlocks = new Map<ConversionId, ReadonlySignal<boolean>>();

/** Whether the next level of a building is affordable now (BuildingSystem's own check). */
export function selectCanBuild(id: BuildingType): ReadonlySignal<boolean> {
  return memo(canBuilds, id, () => canBuild(id, gameState.value));
}

/** A research project's status: locked, available, in_progress or completed. */
export function selectResearchStatus(id: ResearchProjectId): ReadonlySignal<ResearchProjectStatus> {
  return memo(researchStatuses, id, () => getProjectStatus(gameState.value, id));
}

/** Whether a research project can be started now (status, researchers and price). */
export function selectCanStartResearch(id: ResearchProjectId): ReadonlySignal<boolean> {
  return memo(canStarts, id, () => canStartProject(gameState.value, id));
}

/** Researchers assigned (the research pool). */
export const selectAssignedResearchers = computed(() => getAssignedResearchers(gameState.value));

/** Whether a conversion step can run (researched and ready). */
export function selectConversionUnlocked(id: ConversionId): ReadonlySignal<boolean> {
  return memo(conversionUnlocks, id, () => isConversionUnlocked(gameState.value, id));
}

// --- Parameterised slices ---------------------------------------------------------------------

const byPath = new Map<string, ReadonlySignal<unknown>>();

/**
 * A slice at a dot-notation path (for example `resources.food`). Cached per path, so every caller
 * shares one computed.
 */
export function selectByPath(path: string): ReadonlySignal<unknown> {
  let sel = byPath.get(path);
  if (!sel) {
    const keys = path.split('.');
    sel = computed(() => {
      let cur: unknown = gameState.value;
      for (const k of keys) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[k];
      }
      return cur;
    });
    byPath.set(path, sel);
  }
  return sel;
}

const conversionRates = new Map<ConversionId, ReadonlySignal<number>>();
const conversionCaps = new Map<ConversionId, ReadonlySignal<number>>();

/** Current rate of one conversion chain, per tick. */
export function selectConversionRate(id: ConversionId): ReadonlySignal<number> {
  let sel = conversionRates.get(id);
  if (!sel) {
    sel = computed(() => getConversionRate(gameState.value, id));
    conversionRates.set(id, sel);
  }
  return sel;
}

/** Rate cap of one conversion chain, per tick. */
export function selectConversionCap(id: ConversionId): ReadonlySignal<number> {
  let sel = conversionCaps.get(id);
  if (!sel) {
    const def = getConversionDefs().find((d) => d.id === id);
    sel = computed(() => (def ? def.getRateCap(gameState.value) : 0));
    conversionCaps.set(id, sel);
  }
  return sel;
}

/**
 * What the player can afford now, as `<panelId>:<item>` keys joined by `|` (Story 1.15, the tab dot).
 * A string, so a tick that changes nothing affordable leaves the value equal and stays quiet.
 */
export const selectAffordableKeys = computed(() => affordableKeys(gameState.value).join('|'));

// --- The phase goal (Story 1.18, AR5) -----------------------------------------------------------

/**
 * The current phase's goal: its outgoing transition from `phases/transitions.ts` (a module constant, so
 * the reference only changes with the phase), or `null` after the last phase. The UI reads conditions'
 * `id`, `label` and `one` from it, and their numbers through the selectors below, never a threshold.
 */
export const selectGoal = computed<Transition | null>(() => goalFor(selectPhase.value));

/**
 * The latch (Story 1.19, D3): `state.phaseGoal` when it is latched on the current phase's goal, else
 * null. It survives dips, so the meter keeps reading GOAL MET until CONTINUE.
 */
export const selectLatchedGoal = computed<PhaseGoal | null>(() => {
  const latch = selectPhaseGoal.value;
  const goal = selectGoal.value;
  return latch?.latched === true && goal !== null && latch.phase === goal.to ? latch : null;
});

/** The phase goal has latched: GOAL MET, and NEST shows CONTINUE (Story 1.19). */
export const selectGoalMet = computed(() => selectLatchedGoal.value !== null);

/** How close the goal is, 0..100 (100 only when every condition is met, or the goal latched); 0 without a goal. */
export const selectGoalPercent = computed(() => {
  const goal = selectGoal.value;
  if (!goal) return 0;
  return selectGoalMet.value ? 100 : goalPercent(goal, gameState.value);
});

const conditionCurrents = new Map<GoalCondition, ReadonlySignal<number>>();
const conditionTargets = new Map<GoalCondition, ReadonlySignal<number>>();
const conditionMets = new Map<GoalCondition, ReadonlySignal<boolean>>();

function cached<T>(map: Map<GoalCondition, ReadonlySignal<T>>, c: GoalCondition, read: () => T): ReadonlySignal<T> {
  let sel = map.get(c);
  if (!sel) {
    sel = computed(read);
    map.set(c, sel);
  }
  return sel;
}

/** A condition's current value, floored (whole numbers only). */
export function selectConditionCurrent(c: GoalCondition): ReadonlySignal<number> {
  return cached(conditionCurrents, c, () => Math.floor(c.current(gameState.value)));
}

/** A condition's target. */
export function selectConditionTarget(c: GoalCondition): ReadonlySignal<number> {
  return cached(conditionTargets, c, () => Math.floor(c.target(gameState.value)));
}

/** Whether a condition is met, decided by the phase layer (never by comparing numbers in the UI). */
export function selectConditionMet(c: GoalCondition): ReadonlySignal<boolean> {
  return cached(conditionMets, c, () => conditionMet(c, gameState.value));
}

// --- The next action (Story 1.21, UX-DR12) ------------------------------------------------------

function sameNextAction(a: NextAction, b: NextAction): boolean {
  if (a.kind === 'none' || b.kind === 'none') return a.kind === b.kind && a.key === b.key;
  return a.key === b.key && a.rule === b.rule && a.verb === b.verb && a.target === b.target;
}

let lastNextAction: NextAction | null = null;

/**
 * The one most useful next action (`systems/NextAction.ts`), for NEST, WRKR and the offline summary.
 * Evaluated on every write, but it hands back the previous object while the suggestion is the same
 * (same target, rule and label; for none, the same item and whole seconds), so it notifies only when
 * the button would change, at most about once a second while counting down.
 */
export const selectNextAction = computed<NextAction>(() => {
  const next = getNextAction(gameState.value);
  if (lastNextAction !== null && sameNextAction(lastNextAction, next)) return lastNextAction;
  lastNextAction = next;
  return next;
});

const territory = new TerritorySystem();
const territoryBonuses = (s: GameState) => territory.getBonuses(s);

// --- WRKR: the workforce (Story 1.23) ---------------------------------------------------------

/** Workers on no role. */
export const selectFreeWorkers = computed(() => freeWorkers(gameState.value));
/** Every worker, researchers included. */
export const selectWorkforceTotal = computed(() => workforceTotal(gameState.value));
/** Workers on a role, Research included. */
export const selectAssignedTotal = computed(() => assignedTotal(gameState.value));

const foodRates = computed(() => computeResourceRates(gameState.value, territoryBonuses(gameState.value)));
/** Gross food per second (unfloored; the UI floors it). Notifies only when the number changes. */
export const selectFoodProductionPerSec = computed(() => foodRates.value.foodProducedPerSec);
/** Food upkeep per second (unfloored; the UI floors it). */
export const selectFoodUpkeepPerSec = computed(() => foodRates.value.foodConsumedPerSec);

let lastReallocation: Reallocation | null = null;
/**
 * The WRKR primary action (`> MOVE 4 TO GATHER`), or null. The same object
 * while the suggestion is unchanged, so it notifies only when it changes.
 */
export const selectReallocation = computed<Reallocation | null>(() => {
  const next = getReallocation(gameState.value);
  const last = lastReallocation;
  if (next && last && next.rule === last.rule && next.from === last.from && next.to === last.to && next.count === last.count) {
    return last;
  }
  lastReallocation = next;
  return next;
});

// --- WRKR: automation (Story 1.23, replaces AutoProductionPanel) ------------------------------

/** Eggs per second from automation research and buildings (0 while auto-production is off). */
export const selectAutoEggRate = computed(() =>
  selectAutoProduction.value.enabled ? getAutoEggRate(gameState.value) : 0,
);

const canResearchBy = new Map<ResearchType, ReadonlySignal<boolean>>();
/** Whether one automation research can be bought now. */
export function selectCanResearch(id: ResearchType): ReadonlySignal<boolean> {
  let sel = canResearchBy.get(id);
  if (!sel) {
    sel = computed(() => canResearch(id, gameState.value));
    canResearchBy.set(id, sel);
  }
  return sel;
}

const canBuildAutoBy = new Map<AutomationBuildingType, ReadonlySignal<boolean>>();
/** Whether the next level of one automation building can be bought now. */
export function selectCanBuildAuto(id: AutomationBuildingType): ReadonlySignal<boolean> {
  let sel = canBuildAutoBy.get(id);
  if (!sel) {
    sel = computed(() => canBuildAuto(id, gameState.value));
    canBuildAutoBy.set(id, sel);
  }
  return sel;
}
let lastBuildAction: NextAction | null = null;

/**
 * BUILD's highlighted card (`getBuildAction`, Story 1.24): the card whose action is BUILD's pinned
 * `> BUY`, or none with the header's `NEXT: <item> IN ~<time>`. Quiet like `selectNextAction`.
 */
export const selectBuildAction = computed<NextAction>(() => {
  const next = getBuildAction(gameState.value);
  if (lastBuildAction !== null && sameNextAction(lastBuildAction, next)) return lastBuildAction;
  lastBuildAction = next;
  return next;
});

// --- FRONT → WAR: soldiers and mutations (Story 1.25) -----------------------------------------

/** A soldier's strength, defense, speed and health with equipment and mutations. */
export const selectSoldierStrength = computed(() => getSoldierStrength(gameState.value));
export const selectSoldierDefense = computed(() => getSoldierDefense(gameState.value));
export const selectSoldierSpeed = computed(() => getSoldierSpeed(gameState.value));
export const selectSoldierMaxHp = computed(() => getSoldierMaxHp(gameState.value));

/** Where a mutation stands: bought, behind its prerequisite, buyable now, or short of drops. */
export type MutationStatus = 'owned' | 'locked' | 'affordable' | 'short';

const mutationStatuses = new Map<string, ReadonlySignal<MutationStatus>>();

/** One mutation's status (cached per id). */
export function selectMutationStatus(id: string): ReadonlySignal<MutationStatus> {
  let sel = mutationStatuses.get(id);
  if (!sel) {
    sel = computed<MutationStatus>(() => {
      const s = gameState.value;
      if (s.mutations.find((m) => m.id === id)?.purchased) return 'owned';
      if (!isMutationUnlocked(s, id)) return 'locked';
      return canPurchaseMutation(s, id) ? 'affordable' : 'short';
    });
    mutationStatuses.set(id, sel);
  }
  return sel;
}
// --- LOG: the LEGACY section (Story 1.26, UX-DR31) --------------------------------------------

/**
 * LOG shows LEGACY once the GDD's prestige unlock condition is met (`isPrestigeAvailable`), and keeps
 * it for the runs after: once the player has prestiged (the Legacy tree spends LP) or won (the ending
 * leads to LEGACY, EXPERIENCE.md).
 */
export const selectLegacyUnlocked = computed(() => {
  const s = gameState.value;
  return s.prestige.count > 0 || s.victoryAchieved || isPrestigeAvailable(s);
});
