import type { GameState } from '../state/GameState';
import { buildingUpgradeCost, softCapEffectiveness } from '../engine/ProgressionCurve';
import { buildingBalance as B } from '../data/balance/buildings';
import { recruitmentBalance } from '../data/balance/recruitment';
import { BUILDING_UNLOCK_PHASE } from '../data/content/buildings';
import { FIRST_PRODUCED_IN, type ProducedResource } from '../data/content/producers';
import { isUnlocked } from '../data/content/tabs';
import type { Phase } from '../phases/phases';

export type BuildingType = 'barracks' | 'walls' | 'warehouse' | 'silk_weaving' | 'chitin_armory' | 'venom_lab';

interface Cost {
  food: number;
  wood: number;
  stone: number;
  nectar: number;
  chitin: number;
  silk: number;
  venom: number;
}

const BUILDING_BASE_COSTS: Readonly<Record<BuildingType, Readonly<Cost>>> = B.baseCosts;

export function getBuildCost(building: BuildingType, level: number): Cost {
  const base = BUILDING_BASE_COSTS[building];
  const cost: Cost = {
    food: buildingUpgradeCost(base.food, level),
    wood: buildingUpgradeCost(base.wood, level),
    stone: buildingUpgradeCost(base.stone, level),
    nectar: buildingUpgradeCost(base.nectar, level),
    chitin: buildingUpgradeCost(base.chitin, level),
    silk: buildingUpgradeCost(base.silk, level),
    venom: buildingUpgradeCost(base.venom, level),
  };

  // Advanced building costs (Lv.5+): combat resources as resource sink
  if (level >= B.advancedFromLevel) {
    if (building === 'barracks') {
      cost.chitin += buildingUpgradeCost(B.advancedBaseCost, level);
    } else if (building === 'walls') {
      cost.silk += buildingUpgradeCost(B.advancedBaseCost, level);
    } else if (building === 'warehouse') {
      cost.silk += buildingUpgradeCost(B.advancedBaseCost, level);
      cost.chitin += buildingUpgradeCost(B.advancedBaseCost, level);
    }
  }

  return cost;
}

/** Whether BUILD sells the building in this phase (Story 3.5, `data/content/buildings.ts`). */
export function isBuildingUnlocked(building: BuildingType, phase: Phase): boolean {
  return isUnlocked(BUILDING_UNLOCK_PHASE[building], phase);
}

/**
 * Whether every resource the level's price names has a producer by this phase
 * (Story 3.5, FR7: no catch-22). The Lv.5+ surcharge asks the colony's own
 * buildings for combat loot, so those levels wait for the battles.
 */
export function isLevelPayableIn(building: BuildingType, level: number, phase: Phase): boolean {
  const cost = getBuildCost(building, level);
  return (Object.keys(cost) as ProducedResource[]).every((k) => cost[k] <= 0 || isUnlocked(FIRST_PRODUCED_IN[k], phase));
}

/** Whether the building's next level can be bought in the state's phase, at any price. */
export function isBuildingOpen(building: BuildingType, state: GameState): boolean {
  const phase = state.phase as Phase;
  return isBuildingUnlocked(building, phase) && isLevelPayableIn(building, state.buildings[building].level + 1, phase);
}

/** Whether the stocks cover the building's next level (affordability only; see `isBuildingOpen`). */
export function canAffordBuild(building: BuildingType, state: GameState): boolean {
  const cost = getBuildCost(building, state.buildings[building].level + 1);
  return (
    state.resources.food >= cost.food &&
    state.resources.wood >= cost.wood &&
    state.resources.stone >= cost.stone &&
    state.resources.nectar >= cost.nectar &&
    state.combatResources.chitin >= cost.chitin &&
    state.combatResources.silk >= cost.silk &&
    state.combatResources.venom >= cost.venom
  );
}

/** Whether the player can buy the building's next level now: open in this phase and affordable. */
export function canBuild(building: BuildingType, state: GameState): boolean {
  return isBuildingOpen(building, state) && canAffordBuild(building, state);
}

export function build(building: BuildingType, state: GameState): GameState {
  if (!canBuild(building, state)) return state;
  const nextLevel = state.buildings[building].level + 1;
  const cost = getBuildCost(building, nextLevel);

  return {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food - cost.food,
      wood: state.resources.wood - cost.wood,
      stone: state.resources.stone - cost.stone,
      nectar: state.resources.nectar - cost.nectar,
    },
    combatResources: {
      ...state.combatResources,
      chitin: state.combatResources.chitin - cost.chitin,
      silk: state.combatResources.silk - cost.silk,
      venom: state.combatResources.venom - cost.venom,
    },
    buildings: {
      ...state.buildings,
      [building]: {
        ...state.buildings[building],
        level: nextLevel,
      },
    },
  };
}

/**
 * Effects that count things (nest rooms, recruits): whole numbers, so the
 * soft cap is floored for them (Story 3.3, FR34). A fractional capacity would
 * let a fraction of an ant mature.
 */
const COUNT_EFFECTS: ReadonlySet<string> = new Set(['nestCapacity', 'scoutsCap', 'warriorsCap']);

export function getEffects(
  building: BuildingType,
  level: number,
): Record<string, number> {
  const raw = getRawEffects(building, level);
  // Apply soft-cap diminishing returns after level 5
  const capped: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const effective = softCapEffectiveness(value, level);
    capped[key] = COUNT_EFFECTS.has(key) ? Math.floor(effective) : effective;
  }
  return capped;
}

/** Raw building effects before soft-cap. */
function getRawEffects(
  building: BuildingType,
  level: number,
): Record<string, number> {
  switch (building) {
    case 'barracks':
      if (level >= recruitmentBalance.warriorBarracksLevel) return { ...B.barracksCaps.warriors };
      if (level >= recruitmentBalance.scoutBarracksLevel) return { ...B.barracksCaps.scouts };
      return { scoutsCap: 0, warriorsCap: 0 };
    case 'walls':
      return { defenseBonus: level * B.wallsDefensePerLevel };
    case 'warehouse':
      return { nestCapacity: level * B.warehouseNestCapacityPerLevel };
    case 'silk_weaving':
      return { armorUnlocked: level >= 1 ? 1 : 0 };
    case 'chitin_armory':
      return { weaponUnlocked: level >= 1 ? 1 : 0 };
    case 'venom_lab':
      return { venomLabLevel: level };
  }
}
