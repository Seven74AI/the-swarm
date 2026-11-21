import { Phase } from '../../phases/phases';
import type { BuildingType } from '../../systems/BuildingSystem';

/**
 * The phase from which BUILD sells each building (Story 3.5, FR7). Barracks,
 * Walls, Warehouse, Fungus Garden and Tunnels (Story 4.7) are the colony's own and open in Colony; the combat
 * workshops (Silk Weaving, Chitin Armory, Venom Lab) cost combat loot and
 * open with the battles in Combat, and so does the Midden (Story 4.8), where
 * the fallen leave chitin. The building panel opens with the first
 * of these (`tabs.ts`); a level whose price needs a resource nothing makes
 * yet stays closed (`FIRST_PRODUCED_IN`, `BuildingSystem.isBuildingOpen`).
 */
export const BUILDING_UNLOCK_PHASE: Readonly<Record<BuildingType, Phase>> = {
  barracks: Phase.COLONY,
  walls: Phase.COLONY,
  warehouse: Phase.COLONY,
  fungus_garden: Phase.COLONY,
  tunnels: Phase.COLONY,
  silk_weaving: Phase.COMBAT,
  chitin_armory: Phase.COMBAT,
  venom_lab: Phase.COMBAT,
  midden: Phase.COMBAT,
};

/**
 * The last level BUILD sells (Story 4.8): Silk Weaving and the Chitin Armory
 * only open their equipment, so a level past that would change nothing.
 * Buildings not listed have no last level.
 */
export const BUILDING_MAX_LEVEL: Readonly<Partial<Record<BuildingType, number>>> = {
  silk_weaving: 1,
  chitin_armory: 1,
};
