/**
 * Read-only game rules the UI needs to draw itself: costs, caps, effects,
 * rates and content definitions. Each takes the state (or a level) as an
 * argument and returns a value; none changes anything.
 *
 * Architecture rule 2 (AR21, Story 1.6): `ui/` never imports `systems/`.
 * It changes state only through `actions/` and reads it through `state/`:
 * selectors for the live signal, and this module for the pure rules over a
 * state. Add a re-export here when a panel needs another rule; never
 * re-export a function that returns a new state.
 */
export { canBuild, getBuildCost, getEffects, type BuildingType } from '../systems/BuildingSystem';
export {
  computeResourceRates,
  eggsPerTap,
  getAssignedWorkers,
  getUpgradeCost,
  type WorkerRole,
} from '../systems/ResourceSystem';
export {
  getEquipmentUpgradeCost,
  getSoldierDefense,
  getSoldierMaxHp,
  getSoldierSpeed,
  getSoldierStrength,
} from '../systems/SoldierSystem';
export type { BattleOutcome, BattleResult } from '../systems/BattleSystem';
export { getEnemyDef, getEnemyDefs, getRandomEnemy, peekEnemy, scaleEnemy, type EnemyDef } from '../systems/EnemySystem';
export { assessMatchup, type Matchup } from '../systems/CombatRounds';
export { causeLine } from '../systems/BattleCauses';
export {
  battleAdvice,
  counterFor,
  marksOf,
  upgradeOf,
  type BattleCause,
  type BattleCauseKind,
  type BattleAdvice,
  type CounterCard,
  type CounterShortfall,
  type CounterMarks,
  type Upgrade,
} from '../systems/Counters';
export { displayRemainingMs, isTimed, type DecisionTimerMode } from '../systems/DecisionSystem';
export {
  canStartProject,
  getAssignedResearchers,
  getProjectStatus,
  getProjects,
  getProjectsFor,
  type ResearchProjectDef,
} from '../systems/ResearchSystem';
export {
  canPurchasePrestigeUpgrade,
  calculateLegacyPoints,
  getPhaseScore,
  getUnmetRequirements,
  isLegacyRevealed,
  isPrestigeAvailable,
  isPrestigeUpgradePurchased,
  legacyPointsAward,
  PRESTIGE_REQUIREMENTS,
  type PrestigeRequirement,
  type PrestigeRequirementId,
  type UnmetRequirement,
} from '../systems/PrestigeSystem';
export { MAX_PROBES, PROBE_SWARM_THRESHOLD } from '../systems/ExplorationSystem';
export { entropyMeter } from '../systems/EntropySystem';
export { MAX_ACTIVE_EXPEDITIONS } from '../systems/ExpeditionSystem';
export {
  canPurchaseMutation,
  isMutationUnlocked,
  MUTATIONS,
  type MutationCost,
  type MutationDef,
} from '../systems/MutationSystem';
export {
  getConversionDefs,
  getConversionRate,
  getParticleLabCost,
  isConversionUnlocked,
  type ConversionDef,
  type ConversionId,
} from '../systems/ResourceConversionSystem';
export {
  AUTOMATION_BUILDINGS,
  canBuildAuto,
  canResearch,
  getAutoBuildCost,
  getAutoEggRate,
  getBuildingEffect,
  RESEARCHES,
  type AutomationBuildingType,
  type ResearchType,
} from '../systems/AutomationSystem';
export { canAffordShipCost, getShipCost, MAX_SHIP_LEVEL } from '../systems/SpaceshipSystem';
export { getAutoDigCost } from '../systems/Dig';
// BUILD's cards match the highlighted item by its key (Story 1.24).
export { itemKey, itemPanel } from '../systems/NextAction';
/** The phase goals (Story 1.18), read-only: the simulated player reads its goal here (Story 3.7). */
export { conditionMet, goalFor, type GoalCondition } from '../phases/transitions';
