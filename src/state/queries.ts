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
  EGG_HATCH_TIME,
  LARVA_MATURE_TIME,
  computeResourceRates,
  eggsPerTap,
  getAssignedWorkers,
  getUpgradeCost,
  type WorkerRole,
} from '../systems/ResourceSystem';
export {
  MAX_EQUIPMENT_LEVEL,
  SOLDIER_COST_FOOD,
  SOLDIER_TRAIN_TIME,
  getEquipmentUpgradeCost,
  getSoldierDefense,
  getSoldierMaxHp,
  getSoldierSpeed,
  getSoldierStrength,
} from '../systems/SoldierSystem';
export type { BattleResult } from '../systems/BattleSystem';
export { getRandomEnemy, scaleEnemy, type EnemyDef } from '../systems/EnemySystem';
export type { DecisionEvent } from '../systems/DecisionSystem';
export {
  canStartProject,
  getAssignedResearchers,
  getProjectStatus,
  getProjects,
  type ResearchProjectDef,
} from '../systems/ResearchSystem';
export {
  canPurchasePrestigeUpgrade,
  calculateLegacyPoints,
  canBuyChronoSynchronization,
  canBuyTemporalResonance,
  CHRONO_SYNCHRONIZATION_COST,
  getPhaseScore,
  getUnmetRequirements,
  isPrestigeAvailable,
  isPrestigeUpgradePurchased,
  TEMPORAL_RESONANCE_COST,
} from '../systems/PrestigeSystem';
export { MAX_PROBES, PROBE_SWARM_THRESHOLD } from '../systems/ExplorationSystem';
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
// BUILD's cards match the highlighted item by its key (Story 1.24).
export { itemKey } from '../systems/NextAction';
