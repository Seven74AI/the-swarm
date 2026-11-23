import { computed, type ReadonlySignal } from '@preact/signals-core';
import { gameState } from './gameSignal';
import type { GameState, PhaseGoal } from './GameState';
import type { Phase } from '../phases/phases';
import { getEffects } from '../systems/BuildingSystem';
import { armyUpkeepPerSec, computeResourceRates, isStarving } from '../systems/ResourceSystem';
import { affordableKeys } from './affordances';
import { getBuildAction, getNextAction, type NextAction } from '../systems/NextAction';
import { assignedTotal, freeWorkers, getReallocation, workforceTotal, type Reallocation } from '../systems/Workforce';
import { TerritorySystem } from '../systems/TerritorySystem';
import { getSoldierDefense, getSoldierMaxHp, getSoldierSpeed, getSoldierStrength } from '../systems/SoldierSystem';
import { canChoose } from '../systems/DecisionSystem';
import { getEnemyDef, scaleEnemy } from '../systems/EnemySystem';
import { assessMatchup, type Matchup } from '../systems/CombatRounds';
import { getDecision } from '../data/content/decisions';
import { narrativeBalance } from '../data/balance/narrative';
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
  canBuildParticleLab,
  isConversionUnlocked,
  type ConversionId,
} from '../systems/ResourceConversionSystem';
import { canBuild, isBuildingOpen, isBuildingUnlocked, type BuildingType } from '../systems/BuildingSystem';
import { canStartProject, getAssignedResearchers, getProjectStatus } from '../systems/ResearchSystem';
import {
  canPurchasePrestigeUpgrade,
  isLegacyRevealed,
  legacyPointsAward,
  isPrestigeAvailable,
  isRequirementMet,
  PRESTIGE_REQUIREMENTS,
  type PrestigeRequirementId,
} from '../systems/PrestigeSystem';
import { getOfflineCapMs, getOfflineEfficiency } from '../systems/OfflineProgression';
import { entropyMeter } from '../systems/EntropySystem';
import {
  automationBlock,
  automationCount,
  automationStatus,
  isAutomationShown,
  type AutomationStatus,
} from '../systems/AutomationTargets';
import type { AutomationBlock, AutomationVerb } from '../data/content/automation';
import type { PrestigeUpgradeId } from '../data/prestigeTree';
import { progressionBalance } from '../data/balance/progression';
import { PERCENT } from '../data/constants';
import { canBuyAutoDig, isAutoDigOpen, nextRoom, pressChunk, type NextRoom } from '../systems/Dig';
import { digBalance } from '../data/balance/dig';
import { feedRefusal } from '../systems/Brood';
import { Phase as PhaseId } from '../phases/phases';
import type { ResearchProjectId, ResearchProjectStatus } from './GameState';
import { nestViewOf, sameNestView, type NestView } from './nestView';
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
/** The seeded generator's state (Story 3.1): the enemy card peeks the next enemy from it. */
export const selectRng = slice('rng');
export const selectBattlesLost = slice('battlesLost');
/** The enemy type the next battle fights (Story 4.1). */
export const selectNextEnemy = slice('nextEnemy');
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

/**
 * Starving (Story 1.32): the food store is empty and upkeep (workers and the
 * army, Story 4.4) exceeds production; the same rule refuses training
 * (`isStarving`). A primitive: notifies on its edges only.
 */
export const selectStarving = computed(() => isStarving(gameState.value, territoryBonuses(gameState.value)));

let lastNestView: NestView | null = null;
/**
 * The nest scene's view (Story 8.5, AR14): whole workers, eggs and larvae,
 * and whether the colony starves (Story 8.7, `selectStarving`). Keeps its
 * reference while none of them changes, so a tick that only moves food
 * notifies nobody. The scene reads it through a 4 Hz throttle
 * (`ui/primitives/throttledSignal.ts`, `sceneBalance.viewRefreshMs`).
 */
export const selectNestView = computed<NestView>(() => {
  const next = nestViewOf(selectResources.value, selectStarving.value, gameState.value.dig.roomsDug);
  if (lastNestView && sameNestView(lastNestView, next)) return lastNestView;
  lastNestView = next;
  return next;
});

let lastNextRoom: NextRoom | null = null;
const sameNextRoom = (a: NextRoom, b: NextRoom): boolean =>
  a.auto === b.auto && a.size === b.size && a.progress === b.progress && a.cost === b.cost && a.percent === b.percent && a.presses === b.presses && a.timeLeftMs === b.timeLeftMs;

/**
 * The NEXT ROOM strip (Story 9.3, FR56): how close the next room is, from
 * Colony on (null in Egg Laying, where there is no DIG). Recomputes on every
 * write; keeps its last value while nothing it shows changed, so the strip
 * (behind a 4 Hz throttle) re-renders only on a change.
 */
export const selectNextRoom = computed<NextRoom | null>(() => {
  const s = gameState.value;
  if (s.phase === PhaseId.EGG_LAYING) return null;
  const next = nextRoom(s);
  if (lastNextRoom && sameNextRoom(lastNextRoom, next)) return lastNextRoom;
  lastNextRoom = next;
  return next;
});

/**
 * FEED on the brood (Story 9.4, FR57): null in Egg Laying (the brood opens its
 * peek there); from Colony on, why a tap can't feed (`NEST FULL`, `NO LARVAE`)
 * or null when it can. A string, so it notifies only when the answer changes.
 */
export type FeedBlock = 'NEST FULL' | 'NO LARVAE';
export const selectFeed = computed<{ readonly blocked: FeedBlock | null } | null>(() => {
  const why = selectFeedReason.value;
  return why === 'phase' ? null : why === 'ok' ? FEED_OPEN : why === 'NEST FULL' ? FEED_FULL : FEED_EMPTY;
});
const FEED_OPEN = { blocked: null } as const;
const FEED_FULL = { blocked: 'NEST FULL' } as const;
const FEED_EMPTY = { blocked: 'NO LARVAE' } as const;
const selectFeedReason = computed<'phase' | 'ok' | FeedBlock>(() => {
  const why = feedRefusal(gameState.value);
  return why === 'locked' ? 'phase' : why === 'at_capacity' ? 'NEST FULL' : why === 'unavailable' ? 'NO LARVAE' : 'ok';
});

/**
 * DIG's hint line (Story 9.7, UX-DR48): what a press digs and the stone it
 * brings (`chunk +12 · 1 stone/17 digs`, or `· 2 stone` once a press brings
 * whole stone); while a room is free and larvae wait, the FEED tip in place
 * of the stone (`chunk +12 · tap the brood`). Short enough for one line on
 * the full grid; below it the line drops (nest.css), it never clips.
 * Read from the balance, never restated; a string, so it notifies on change.
 */
export const selectDigHint = computed<string>(() => {
  const s = gameState.value;
  const chunk = pressChunk(s);
  const perPress = chunk / digBalance.pointsPerStone;
  if (feedRefusal(s) === null) return `chunk +${chunk} · tap the brood`;
  const stone = perPress >= 1 ? `${Math.floor(perPress)} stone` : `1 stone/${Math.ceil(1 / perPress)} digs`;
  return `chunk +${chunk} · ${stone}`;
});

/** The workforce fills the effective nest capacity (the strip's capped workers cell). */
export const selectCapacityReached = computed(() => {
  const cap = Math.floor(selectEffectiveNestCapacity.value);
  return cap > 0 && selectWorkers.value >= cap;
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
const buildingsUnlocked = new Map<BuildingType, ReadonlySignal<boolean>>();
const buildingsOpen = new Map<BuildingType, ReadonlySignal<boolean>>();
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

/** Whether the Particle Lab's next level is on sale and affordable now (Story 3.6). */
export const selectCanBuildParticleLab = computed(() => canBuildParticleLab(gameState.value));
/** Auto-dig (Story 9.5): its card is on sale, it can be bought now, it is on. */
export const selectAutoDigOpen = computed(() => isAutoDigOpen(gameState.value));
export const selectCanBuyAutoDig = computed(() => canBuyAutoDig(gameState.value));
export const selectAutoDigOn = computed(() => gameState.value.dig.auto);

/** Whether BUILD lists the building in this phase (Story 3.5). */
export function selectBuildingUnlocked(id: BuildingType): ReadonlySignal<boolean> {
  return memo(buildingsUnlocked, id, () => isBuildingUnlocked(id, selectPhase.value as Phase));
}

/** Whether the building's next level can be bought in this phase at any price (Story 3.5). */
export function selectBuildingOpen(id: BuildingType): ReadonlySignal<boolean> {
  return memo(buildingsOpen, id, () => isBuildingOpen(id, gameState.value));
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

/**
 * The phase whose near-goal story beat is due (Story 4.9): the current phase once its goal's
 * progress reaches `narrativeBalance.nearGoalPercent`, else null (and null without a goal).
 */
export const selectNearGoalPhase = computed<string | null>(() =>
  selectGoal.value !== null && selectGoalPercent.value >= narrativeBalance.nearGoalPercent ? selectPhase.value : null,
);

const conditionCurrents = new Map<GoalCondition, ReadonlySignal<number>>();
const conditionTargets = new Map<GoalCondition, ReadonlySignal<number>>();
const conditionMets = new Map<GoalCondition, ReadonlySignal<boolean>>();

function cached<K, T>(map: Map<K, ReadonlySignal<T>>, c: K, read: () => T): ReadonlySignal<T> {
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

/** Food the army eats per second, trainees included (Story 4.4; unfloored, the UI floors it). A primitive. */
export const selectArmyUpkeepPerSec = computed(() => armyUpkeepPerSec(gameState.value));

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
/** The enemy card's read of the next battle, trait included (Story 4.1). */
export const selectMatchup = computed((): Matchup => {
  const s = gameState.value;
  return assessMatchup(s, scaleEnemy(getEnemyDef(s.nextEnemy), s.battlesWon));
});
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
 * LOG shows LEGACY from the moment the GDD's prestige unlock condition is first met, and keeps it
 * (`isLegacyRevealed`, Story 5.1): for the rest of the run, after a prestige and after the ending
 * (the victory record, read only here and by the screens, Story 5.5).
 */
export const selectLegacyUnlocked = computed(() => gameState.value.victoryAchieved || isLegacyRevealed(gameState.value));

// --- LOG → LEGACY: the prestige card and the Legacy tree (Story 1.36) --------------------------------

/** The GDD's prestige condition is met: PRESTIGE can be held. */
export const selectPrestigeAvailable = computed(() => isPrestigeAvailable(gameState.value));

const prestigeRequirementCurrents = new Map<PrestigeRequirementId, ReadonlySignal<number>>();
const prestigeRequirementMets = new Map<PrestigeRequirementId, ReadonlySignal<boolean>>();
const requirementOf = (id: PrestigeRequirementId) => PRESTIGE_REQUIREMENTS.find((r) => r.id === id)!;

/** Where one prestige requirement stands now: a building level or a lifetime total (whole). */
export function selectPrestigeRequirementCurrent(id: PrestigeRequirementId): ReadonlySignal<number> {
  return cached(prestigeRequirementCurrents, id, () => requirementOf(id).current(gameState.value));
}

/** Whether one prestige requirement is met, decided by PrestigeSystem (never by comparing in the UI). */
export function selectPrestigeRequirementMet(id: PrestigeRequirementId): ReadonlySignal<boolean> {
  return cached(prestigeRequirementMets, id, () => isRequirementMet(requirementOf(id), gameState.value));
}

/** Legacy points the next prestige awards: the same scoring `prestige()` uses (#188). */
export const selectProjectedLegacyPoints = computed(() => legacyPointsAward(gameState.value));

/**
 * The Legacy production bonus in whole percent (Story 5.2, FR29): every LP
 * ever earned, spent or not, times the per-LP share. Buying a Legacy upgrade
 * never lowers it.
 */
export const selectLegacyProductionBonusPercent = computed(() =>
  Math.round(gameState.value.prestige.lifetimeLpEarned * progressionBalance.productionPerLegacyPoint * PERCENT),
);

/** Offline efficiency as a fraction (Story 2.8): base + run research + Legacy node, at most 1. */
export const selectOfflineEfficiency = computed(() => getOfflineEfficiency(gameState.value));
/** The offline cap in ms (Story 2.4), raised by the Legacy cap nodes (Story 2.8). */
export const selectOfflineAwayLimitMs = computed(() => getOfflineCapMs(gameState.value));

/** Entropy as shown (Story 3.3): a whole percent, 0–100. A meter, not a resource. */
export const selectEntropyMeter = computed(() => entropyMeter(gameState.value));

const canPurchaseUpgrades = new Map<PrestigeUpgradeId, ReadonlySignal<boolean>>();
/** Whether a Legacy-tree upgrade can be bought now. */
export function selectCanPurchasePrestigeUpgrade(id: PrestigeUpgradeId): ReadonlySignal<boolean> {
  return memo(canPurchaseUpgrades, id, () => canPurchasePrestigeUpgrade(gameState.value, id));
}

// --- Automation targets (Story 4.10, UX-DR16) --------------------------------------------------

const automationSelectors = new Map<string, ReadonlySignal<unknown>>();
function automationMemo<T>(verb: AutomationVerb, part: string, read: (s: GameState) => T): ReadonlySignal<T> {
  return memo(automationSelectors as Map<string, ReadonlySignal<T>>, `${verb}:${part}`, () => read(gameState.value));
}

/** The verb's target row shows (learned by hand, or the phase after its own; its screen open). */
export function selectAutomationShown(verb: AutomationVerb): ReadonlySignal<boolean> {
  return automationMemo(verb, 'shown', (s) => isAutomationShown(s, verb));
}
/** The row's `KEEP N`. */
export function selectAutomationTarget(verb: AutomationVerb): ReadonlySignal<number> {
  return automationMemo(verb, 'target', (s) => s.automation.targets[verb].target);
}
/** The row's `[AUTO]`. */
export function selectAutomationOn(verb: AutomationVerb): ReadonlySignal<boolean> {
  return automationMemo(verb, 'on', (s) => s.automation.targets[verb].on);
}
/** What the target counts now (the brood, the army, the scouts or warriors). */
export function selectAutomationCount(verb: AutomationVerb): ReadonlySignal<number> {
  return automationMemo(verb, 'count', (s) => automationCount(s, verb));
}
/** off, holding (at or over target), working (under, nothing in the way) or blocked. */
export function selectAutomationState(verb: AutomationVerb): ReadonlySignal<AutomationStatus['kind']> {
  return automationMemo(verb, 'state', (s) => automationStatus(s, verb, territoryBonuses(s)).kind);
}
/** Why a blocked row can't reach its target (`food_short`, …), or null. */
export function selectAutomationBlock(verb: AutomationVerb): ReadonlySignal<AutomationBlock | null> {
  return automationMemo(verb, 'block', (s) => automationBlock(s, verb, territoryBonuses(s)));
}
