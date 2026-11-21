import { createEmptyMap, type GameState } from '../state/GameState';
import { resetEntropy, calculateEntropyPrestigeBonus } from './EntropySystem';
import { getPrestigeBonuses } from './PrestigeBonusSystem';
import { PRESTIGE_UPGRADES, type PrestigeUpgradeId } from '../data/prestigeTree';
import { OFFLINE_RESEARCH_ID } from './ResearchSystem';
import { prestigeBalance } from '../data/balance/prestige';

/**
 * Map phase names to their numeric position.
 * egg_laying=1, colony=2, combat=3, expansion=4, space=5, transcendence=6
 */
const PHASE_NUMBER: Record<string, number> = {
  egg_laying: 1,
  colony: 2,
  combat: 3,
  expansion: 4,
  space: 5,
  transcendence: 6,
};

/**
 * Get the phase score — sum of all reached phase numbers.
 * For example, if current phase is 'space' (5), phaseScore = 1+2+3+4+5 = 15.
 */
export function getPhaseScore(currentPhase: string): number {
  const n = PHASE_NUMBER[currentPhase] ?? 1;
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    sum += i;
  }
  return sum;
}

type UnlockBuilding = keyof typeof prestigeBalance.unlock.buildingLevels;
type UnlockProduced = keyof typeof prestigeBalance.unlock.lifetimeProduced;

/** One requirement of the prestige condition: a building level or a lifetime total. */
export type PrestigeRequirementId = UnlockBuilding | UnlockProduced;

export interface PrestigeRequirement {
  readonly id: PrestigeRequirementId;
  readonly kind: 'building' | 'produced';
  /** The whole current value: the building's level, or the lifetime total (floored). */
  readonly current: (state: GameState) => number;
  /** The value to reach, from `data/balance/prestige.ts`. */
  readonly target: number;
}

/** A requirement still short: what it is, where it stands and what it needs. */
export interface UnmetRequirement {
  readonly id: PrestigeRequirementId;
  readonly kind: PrestigeRequirement['kind'];
  readonly current: number;
  readonly target: number;
}

const LIFETIME_TOTAL: Readonly<Record<UnlockProduced, keyof GameState['prestige']>> = {
  food: 'totalFoodProduced',
  wood: 'totalWoodProduced',
  stone: 'totalStoneProduced',
  nectar: 'totalNectarProduced',
};

/**
 * The prestige condition (Story 5.1, FR28), one entry per value in
 * `prestigeBalance.unlock`: buildings first, then lifetime production.
 */
export const PRESTIGE_REQUIREMENTS: readonly PrestigeRequirement[] = [
  ...(Object.entries(prestigeBalance.unlock.buildingLevels) as [UnlockBuilding, number][]).map(
    ([id, target]): PrestigeRequirement => ({ id, kind: 'building', target, current: (s) => s.buildings[id].level }),
  ),
  ...(Object.entries(prestigeBalance.unlock.lifetimeProduced) as [UnlockProduced, number][]).map(
    ([id, target]): PrestigeRequirement => ({
      id,
      kind: 'produced',
      target,
      current: (s) => Math.floor(s.prestige[LIFETIME_TOTAL[id]]),
    }),
  ),
];

/** Whether one requirement is met: its current value has reached its target. */
export function isRequirementMet(r: PrestigeRequirement, state: GameState): boolean {
  return r.current(state) >= r.target;
}

/** Whether prestige is available: every requirement in `PRESTIGE_REQUIREMENTS` is met. */
export function isPrestigeAvailable(state: GameState): boolean {
  return PRESTIGE_REQUIREMENTS.every((r) => isRequirementMet(r, state));
}

/** The requirements still short, in table order; empty exactly when prestige is available. */
export function getUnmetRequirements(state: GameState): UnmetRequirement[] {
  return PRESTIGE_REQUIREMENTS.filter((r) => !isRequirementMet(r, state)).map((r) => ({
    id: r.id,
    kind: r.kind,
    current: r.current(state),
    target: r.target,
  }));
}

/**
 * LOG → LEGACY shows from the moment the prestige condition is first met, and
 * stays (Story 5.1). Within a run nothing the condition reads goes down
 * (building levels only rise, lifetime totals never reset), so a met condition
 * stays met until a prestige; after one, `prestige.count` keeps the section,
 * and the ending (which leads to LEGACY) keeps it too.
 */
export function isLegacyRevealed(state: GameState): boolean {
  return state.prestige.count > 0 || state.victoryAchieved || isPrestigeAvailable(state);
}

/**
 * Calculate Legacy Points gained from a prestige reset.
 * Formula: floor(log10(totalFoodProduced) * phaseScore / 10)
 */
export function calculateLegacyPoints(
  totalFoodProduced: number,
  phaseScore: number,
): number {
  if (totalFoodProduced < 10) return 0;
  return Math.floor(Math.log10(totalFoodProduced) * phaseScore / 10);
}

/**
 * Execute the prestige reset.
 *
 * Returns a new GameState with:
 *   - All Phase 1-4 resources set to starting values
 *   - Phase 5+ resources preserved (voidCrystals, antimatter, darkMatter)
 *   - Buildings, upgrades, workers, soldiers reset to zero
 *   - Prestige count incremented
 *   - Legacy Points added based on formula
 *   - totalFoodProduced preserved (never resets)
 *   - Phase set to egg_laying
 *   - The run's offline research wiped; Legacy nodes (prestigeTree) kept
 */
export function prestige(state: GameState): GameState {
  const phaseScore = getPhaseScore(state.phase);
  const newLegacyPoints = calculateLegacyPoints(
    state.prestige.totalFoodProduced,
    phaseScore,
  );
  const entropyBonus = calculateEntropyPrestigeBonus(state);
  const totalNewLegacyPoints = newLegacyPoints + entropyBonus;

  // Reset entropy after calculating bonus
  const afterEntropyReset = resetEntropy(state);

  // Unlock bonuses from prestige tree
  const bonuses = getPrestigeBonuses(state);

  const basePhase = bonuses.phaseSkip ? 'colony' : 'egg_laying';

  return {
    ...afterEntropyReset,
    phase: basePhase,
    // A new run starts with no met goal (Story 1.19).
    phaseGoal: null,
    resources: {
      // The royal cache's eggs are real eggs in the pipeline, so they hatch (Story 2.5).
      eggs: bonuses.startingResources ? 50 : 0,
      larvae: 0,
      workers: 0,
      food: bonuses.startingResources ? 25 : 0,
      nestCapacity: 25,
      wood: 0,
      stone: 0,
      nectar: 0,
      voidCrystals: state.resources.voidCrystals,
      antimatter: state.resources.antimatter,
      darkMatter: state.resources.darkMatter,
      surveyData: state.resources.surveyData,
    },
    eggPipeline: {
      count: bonuses.startingResources ? 50 : 0,
      progress: 0,
    },
    larvaPipeline: { count: 0, progress: 0 },
    soldierPipeline: { count: 0, progress: 0 },
    // The reset stocks carry no fractions (Story 2.5).
    resourceRemainder: { food: 0, wood: 0, stone: 0, nectar: 0 },
    workersAssigned: {
      gather: 0,
      forage: 0,
      tend: 0,
      dig: 0,
      guard: 0,
      researchers: 0,
    },
    soldiers: {
      scouts: 0,
      warriors: 0,
      totalKilled: state.soldiers.totalKilled,
    },
    buildings: {
      barracks: { level: 0, count: 0 },
      walls: { level: 0 },
      warehouse: { level: 0 },
      silk_weaving: { level: 0 },
      chitin_armory: { level: 0 },
      venom_lab: { level: 0 },
    },
    territory: {
      ownedTiles: 0,
      bonuses: {},
    },
    mapTiles: createEmptyMap(),
    expeditions: [],
    spaceExplorations: [],
    discoveredPlanets: [],
    spaceships: [],
    upgrades: {},
    combatSoldiers: 0,
    lastBattle: { status: 'idle' },
    combatResources: {
      chitin: 0,
      silk: 0,
      venom: 0,
    },
    spaceship: {
      level: 0,
      fuel: 0,
      maxFuel: 100,
    },
    prestige: {
      count: state.prestige.count + 1,
      legacyPoints: state.prestige.legacyPoints + totalNewLegacyPoints,
      totalFoodProduced: state.prestige.totalFoodProduced,
      totalWoodProduced: state.prestige.totalWoodProduced,
      totalStoneProduced: state.prestige.totalStoneProduced,
      totalNectarProduced: state.prestige.totalNectarProduced,
    },
    // The run's offline research is wiped (Story 2.8); the Legacy nodes in prestigeTree stay.
    research: {
      ...state.research,
      projects: { ...state.research.projects, [OFFLINE_RESEARCH_ID]: { status: 'idle' } },
    },
    prestigeTree: state.prestigeTree,
    mutations: state.mutations,
    equipment: {
      weapon: 0,
      armor: 0,
    },
  };
}

/**
 * Check if a prestige tree upgrade can be purchased.
 *
 * Requirements:
 *   - Not already purchased
 *   - Player has enough Legacy Points
 *   - Phase requirement met (for unlock-type upgrades)
 */
export function canPurchasePrestigeUpgrade(
  state: GameState,
  upgradeId: PrestigeUpgradeId,
): boolean {
  // Already purchased?
  if (state.prestigeTree.purchased.includes(upgradeId)) return false;

  const upgrade = PRESTIGE_UPGRADES.find((u) => u.id === upgradeId);
  if (!upgrade) return false;

  // Cost check
  if (state.prestige.legacyPoints < upgrade.cost) return false;

  // Phase requirement check (unlock-type only)
  if (upgrade.phaseRequired && state.phase !== upgrade.phaseRequired) {
    // Allow purchase during transcendence and egg_laying (post-prestige reset)
    if (state.phase !== 'transcendence' && state.phase !== 'egg_laying') {
      return false;
    }
  }

  return true;
}

/**
 * Purchase a prestige tree upgrade.
 *
 * Returns a new GameState with the upgrade marked as purchased and Legacy Points
 * deducted. Returns null if requirements are not met.
 */
export function purchasePrestigeUpgrade(
  state: GameState,
  upgradeId: PrestigeUpgradeId,
): GameState | null {
  if (!canPurchasePrestigeUpgrade(state, upgradeId)) return null;

  const upgrade = PRESTIGE_UPGRADES.find((u) => u.id === upgradeId);
  if (!upgrade) return null;

  return {
    ...state,
    prestige: {
      ...state.prestige,
      legacyPoints: state.prestige.legacyPoints - upgrade.cost,
    },
    prestigeTree: {
      purchased: [...state.prestigeTree.purchased, upgradeId],
    },
  };
}

/**
 * Check if a specific prestige tree upgrade is already purchased.
 */
export function isPrestigeUpgradePurchased(
  state: GameState,
  upgradeId: PrestigeUpgradeId,
): boolean {
  return state.prestigeTree.purchased.includes(upgradeId);
}
