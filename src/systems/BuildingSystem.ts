import type { GameState } from '../state/GameState';
import { buildingUpgradeCost, softCapEffectiveness } from '../engine/ProgressionCurve';

export type BuildingType = 'barracks' | 'walls' | 'warehouse';

interface Cost {
  food: number;
  wood: number;
  stone: number;
  nectar: number;
}

const BUILDING_BASE_COSTS: Record<BuildingType, Cost> = {
  barracks: { food: 100, wood: 50, stone: 0, nectar: 0 },
  walls: { food: 0, wood: 0, stone: 200, nectar: 0 },
  warehouse: { food: 0, wood: 150, stone: 100, nectar: 0 },
};

export function getBuildCost(building: BuildingType, level: number): Cost {
  const base = BUILDING_BASE_COSTS[building];
  return {
    food: buildingUpgradeCost(base.food, level),
    wood: buildingUpgradeCost(base.wood, level),
    stone: buildingUpgradeCost(base.stone, level),
    nectar: buildingUpgradeCost(base.nectar, level),
  };
}

export function canBuild(building: BuildingType, state: GameState): boolean {
  const cost = getBuildCost(building, state.buildings[building].level + 1);
  return (
    state.resources.food >= cost.food &&
    state.resources.wood >= cost.wood &&
    state.resources.stone >= cost.stone &&
    state.resources.nectar >= cost.nectar
  );
}

export function build(building: BuildingType, state: GameState): GameState {
  const nextLevel = state.buildings[building].level + 1;
  const cost = getBuildCost(building, nextLevel);

  if (
    state.resources.food < cost.food ||
    state.resources.wood < cost.wood ||
    state.resources.stone < cost.stone ||
    state.resources.nectar < cost.nectar
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
      if (level >= 2) return { scoutsCap: 3, warriorsCap: 2 };
      if (level >= 1) return { scoutsCap: 2, warriorsCap: 0 };
      return { scoutsCap: 0, warriorsCap: 0 };
    case 'walls':
      return { defenseBonus: level * 0.05 };
    case 'warehouse':
      return { nestCapacity: level * 25 };
  }
}
