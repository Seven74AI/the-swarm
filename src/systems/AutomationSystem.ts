import type { GameState } from '../state/GameState';

/**
 * Research types for the automation tree (GM-3).
 * Paperclip-style: each tier unlocks progressively, with prerequisites.
 */
export type ResearchType =
  | 'basic_incubation'
  | 'queens_pheromones'
  | 'thermal_regulation'
  | 'genetic_optimization'
  | 'cloning_vats';

/**
 * Automation building types.
 */
export type AutomationBuildingType =
  | 'nursery'
  | 'hatchery'
  | 'queens_chamber';

/** Cost for research — subset of GameState resources that may be consumed. */
interface ResearchCost {
  food?: number;
  workers?: number;
  wood?: number;
  stone?: number;
  nectar?: number;
  voidCrystals?: number;
  antimatter?: number;
  researchers?: number;
}

/** Effect of completing a research. */
interface ResearchEffect {
  autoEggRate?: number;      // Flat eggs/s addition
  hatchBonus?: number;       // % bonus to hatch rate
  multiplier?: number;       // Multiplicative bonus to auto-production
  unlocksBuilding?: AutomationBuildingType;
}

/** Research definition. */
interface ResearchDef {
  id: ResearchType;
  name: string;
  cost: ResearchCost;
  effect: ResearchEffect;
  prerequisites: ResearchType[];
}

/** Automation building definition. */
interface AutomationBuildingDef {
  id: AutomationBuildingType;
  name: string;
  maxLevel: number;
  baseCost: ResearchCost;
}

/** All research definitions in unlock order. */
export const RESEARCHES: Record<ResearchType, ResearchDef> = {
  basic_incubation: {
    id: 'basic_incubation',
    name: 'Basic Incubation',
    cost: { food: 100, workers: 50 },
    effect: { autoEggRate: 0.5 },
    prerequisites: [],
  },
  queens_pheromones: {
    id: 'queens_pheromones',
    name: "Queen's Pheromones",
    cost: { food: 500, workers: 200 },
    effect: { autoEggRate: 2, hatchBonus: 10 },
    prerequisites: ['basic_incubation'],
  },
  thermal_regulation: {
    id: 'thermal_regulation',
    name: 'Thermal Regulation',
    cost: { stone: 200, food: 1000 },
    effect: { autoEggRate: 5, unlocksBuilding: 'nursery' },
    prerequisites: ['queens_pheromones'],
  },
  genetic_optimization: {
    id: 'genetic_optimization',
    name: 'Genetic Optimization',
    cost: { voidCrystals: 5, researchers: 50 },
    effect: { multiplier: 1.5 },
    prerequisites: ['thermal_regulation'],
  },
  cloning_vats: {
    id: 'cloning_vats',
    name: 'Cloning Vats',
    cost: { antimatter: 2, researchers: 100 },
    effect: { multiplier: 2, unlocksBuilding: 'hatchery' },
    prerequisites: ['genetic_optimization'],
  },
};

/** All automation building definitions. */
export const AUTOMATION_BUILDINGS: Record<AutomationBuildingType, AutomationBuildingDef> = {
  nursery: {
    id: 'nursery',
    name: 'Nursery',
    maxLevel: 10,
    baseCost: { wood: 20, food: 50 },
  },
  hatchery: {
    id: 'hatchery',
    name: 'Hatchery',
    maxLevel: 5,
    baseCost: { stone: 100, voidCrystals: 2 },
  },
  queens_chamber: {
    id: 'queens_chamber',
    name: "Queen's Chamber",
    maxLevel: 1,
    baseCost: { nectar: 50, stone: 200 },
  },
};

/**
 * Get the resource cost for a research (flat, does not scale with level).
 */
export function getResearchCost(research: ResearchType): ResearchCost {
  return RESEARCHES[research].cost;
}

/**
 * Check if a research can be purchased.
 * Requirements: enough resources, prerequisites met, not already researched.
 */
export function canResearch(research: ResearchType, state: GameState): boolean {
  const def = RESEARCHES[research];
  if (!def) return false;

  // Already researched
  if (state.autoProduction.researches[research]) return false;

  // Check prerequisites
  for (const prereq of def.prerequisites) {
    if (!state.autoProduction.researches[prereq]) return false;
  }

  // Check resources
  const cost = def.cost;
  if ((cost.food ?? 0) > state.resources.food) return false;
  if ((cost.workers ?? 0) > state.resources.workers) return false;
  if ((cost.stone ?? 0) > state.resources.stone) return false;
  if ((cost.voidCrystals ?? 0) > state.resources.voidCrystals) return false;
  if ((cost.antimatter ?? 0) > state.resources.antimatter) return false;
  if ((cost.researchers ?? 0) > state.resources.workers) return false;

  return true;
}

/**
 * Purchase a research. Deducts resources, unlocks the research,
 * and may unlock an automation building.
 */
export function research(
  researchType: ResearchType,
  state: GameState,
): GameState {
  if (!canResearch(researchType, state)) return state;

  const def = RESEARCHES[researchType];
  const cost = def.cost;

  const result: GameState = {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food - (cost.food ?? 0),
      workers: state.resources.workers - (cost.workers ?? 0),
      stone: state.resources.stone - (cost.stone ?? 0),
      voidCrystals: state.resources.voidCrystals - (cost.voidCrystals ?? 0),
      antimatter: state.resources.antimatter - (cost.antimatter ?? 0),
    },
    autoProduction: {
      ...state.autoProduction,
      researches: {
        ...state.autoProduction.researches,
        [researchType]: true,
      },
      // Enable auto-production when first research is bought
      enabled: true,
    },
  };

  return result;
}

/**
 * Get the resource cost for the next level of an automation building.
 * Cost scales linearly with level.
 */
export function getAutoBuildCost(
  building: AutomationBuildingType,
  level: number,
): ResearchCost {
  const def = AUTOMATION_BUILDINGS[building];
  const base = def.baseCost;
  return {
    food: (base.food ?? 0) * level,
    wood: (base.wood ?? 0) * level,
    stone: (base.stone ?? 0) * level,
    nectar: (base.nectar ?? 0) * level,
    voidCrystals: (base.voidCrystals ?? 0) * level,
    antimatter: (base.antimatter ?? 0) * level,
  };
}

/**
 * Check if an automation building can be built.
 */
export function canBuildAuto(
  building: AutomationBuildingType,
  state: GameState,
): boolean {
  const def = AUTOMATION_BUILDINGS[building];
  if (!def) return false;

  const currentLevel = state.autoProduction.buildings[building] ?? 0;
  if (currentLevel >= def.maxLevel) return false;

  const cost = getAutoBuildCost(building, currentLevel + 1);

  if ((cost.food ?? 0) > state.resources.food) return false;
  if ((cost.wood ?? 0) > state.resources.wood) return false;
  if ((cost.stone ?? 0) > state.resources.stone) return false;
  if ((cost.nectar ?? 0) > state.resources.nectar) return false;
  if ((cost.voidCrystals ?? 0) > state.resources.voidCrystals) return false;
  if ((cost.antimatter ?? 0) > state.resources.antimatter) return false;

  return true;
}

/**
 * Build (level up) an automation building.
 */
export function buildAuto(
  building: AutomationBuildingType,
  state: GameState,
): GameState {
  if (!canBuildAuto(building, state)) return state;

  const currentLevel = state.autoProduction.buildings[building] ?? 0;
  const nextLevel = currentLevel + 1;
  const cost = getAutoBuildCost(building, nextLevel);

  return {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food - (cost.food ?? 0),
      wood: state.resources.wood - (cost.wood ?? 0),
      stone: state.resources.stone - (cost.stone ?? 0),
      nectar: state.resources.nectar - (cost.nectar ?? 0),
      voidCrystals: state.resources.voidCrystals - (cost.voidCrystals ?? 0),
      antimatter: state.resources.antimatter - (cost.antimatter ?? 0),
    },
    autoProduction: {
      ...state.autoProduction,
      buildings: {
        ...state.autoProduction.buildings,
        [building]: nextLevel,
      },
    },
  };
}

/**
 * Calculate the effect of an automation building at a given level.
 */
export function getBuildingEffect(
  building: AutomationBuildingType,
  level: number,
): { autoEggRate?: number; multiplier?: number; efficiency?: number } {
  switch (building) {
    case 'nursery':
      return { autoEggRate: level * 1 }; // +1 egg/s per level
    case 'hatchery':
      return { multiplier: 1 + level * 0.2 }; // ×1.2 per level
    case 'queens_chamber':
      return { efficiency: level * 0.1 }; // +10% efficiency
  }
}

/**
 * Calculate the total auto-production rate in eggs/second.
 *
 * Formula:
 *   1. Flat base rate = sum of research autoEggRate values
 *   2. Add building flat bonuses (Nursery: +1/level)
 *   3. Apply multiplicative bonuses from researches (Genetic Optimization ×1.5, Cloning Vats ×2)
 *   4. Apply multiplicative bonuses from buildings (Hatchery: ×1.2/level)
 *   5. Apply efficiency bonuses (Queen's Chamber: +10%/level)
 */
export function getAutoEggRate(state: GameState): number {
  // ── Flat rate from researches ──
  let flatRate = 0;
  for (const [researchId, unlocked] of Object.entries(
    state.autoProduction.researches,
  )) {
    if (!unlocked) continue;
    const def = RESEARCHES[researchId as ResearchType];
    if (def && def.effect.autoEggRate) {
      flatRate += def.effect.autoEggRate;
    }
  }

  // ── Flat rate from buildings (Nursery) ──
  const nurseryLevel = state.autoProduction.buildings['nursery'] ?? 0;
  if (nurseryLevel > 0) {
    flatRate += nurseryLevel * 1;
  }

  // ── Multiplicative bonuses from researches ──
  let researchMult = 1;
  for (const [researchId, unlocked] of Object.entries(
    state.autoProduction.researches,
  )) {
    if (!unlocked) continue;
    const def = RESEARCHES[researchId as ResearchType];
    if (def && def.effect.multiplier) {
      researchMult *= def.effect.multiplier;
    }
  }

  // ── Multiplicative bonuses from buildings (Hatchery) ──
  const hatcheryLevel = state.autoProduction.buildings['hatchery'] ?? 0;
  let buildingMult = 1;
  if (hatcheryLevel > 0) {
    buildingMult = 1 + hatcheryLevel * 0.2;
  }

  // ── Efficiency bonus (Queen's Chamber) ──
  const queenLevel = state.autoProduction.buildings['queens_chamber'] ?? 0;
  let efficiencyMult = 1;
  if (queenLevel > 0) {
    efficiencyMult = 1 + queenLevel * 0.1;
  }

  const totalMult = researchMult * buildingMult * efficiencyMult;
  return flatRate * totalMult;
}
