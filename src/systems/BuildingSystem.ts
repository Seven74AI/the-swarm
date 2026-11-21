import type { GameState } from '../state/GameState';
import { buildingUpgradeCost, softCapEffectiveness } from '../engine/ProgressionCurve';
import { buildingBalance as B } from '../data/balance/buildings';
import { recruitmentBalance } from '../data/balance/recruitment';

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

export function canBuild(building: BuildingType, state: GameState): boolean {
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

export function build(building: BuildingType, state: GameState): GameState {
  const nextLevel = state.buildings[building].level + 1;
  const cost = getBuildCost(building, nextLevel);

  if (
    state.resources.food < cost.food ||
    state.resources.wood < cost.wood ||
    state.resources.stone < cost.stone ||
    state.resources.nectar < cost.nectar ||
    state.combatResources.chitin < cost.chitin ||
    state.combatResources.silk < cost.silk ||
    state.combatResources.venom < cost.venom
  ) {
    return state;
  }

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

export function getEffects(
  building: BuildingType,
  level: number,
): Record<string, number> {
  const raw = getRawEffects(building, level);
  // Apply soft-cap diminishing returns after level 5
  const capped: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    capped[key] = softCapEffectiveness(value, level);
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
