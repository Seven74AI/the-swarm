import { Phase } from '../../phases/phases';
import type { BuildingType } from '../../systems/BuildingSystem';

/**
 * The phase from which BUILD sells each building (Story 3.5, FR7). Barracks,
 * Walls and Warehouse are the colony's own and open in Colony; the combat
 * workshops (Silk Weaving, Chitin Armory, Venom Lab) cost combat loot and
 * open with the battles in Combat. The building panel opens with the first
 * of these (`tabs.ts`); a level whose price needs a resource nothing makes
 * yet stays closed (`FIRST_PRODUCED_IN`, `BuildingSystem.isBuildingOpen`).
 */
export const BUILDING_UNLOCK_PHASE: Readonly<Record<BuildingType, Phase>> = {
  barracks: Phase.COLONY,
  walls: Phase.COLONY,
  warehouse: Phase.COLONY,
  silk_weaving: Phase.COMBAT,
  chitin_armory: Phase.COMBAT,
  venom_lab: Phase.COMBAT,
};
