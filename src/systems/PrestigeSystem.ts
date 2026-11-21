import { createInitialState, type GameState } from '../state/GameState';
import { Phase } from '../phases/phases';
import { peekEnemy } from './EnemySystem';
import { getPhaseNumber } from '../engine/ProgressionCurve';
import { calculateEntropyPrestigeBonus } from './EntropySystem';
import { getPrestigeBonuses } from './PrestigeBonusSystem';
import { PRESTIGE_UPGRADES, type PrestigeUpgradeId } from '../data/prestigeTree';
import { prestigeBalance } from '../data/balance/prestige';

/**
 * Get the phase score — sum of all reached phase numbers (each phase's
 * position in `PHASE_ORDER`, from 1; an unknown phase counts as the first).
 * For example, if current phase is 'space' (5), phaseScore = 1+2+3+4+5 = 15.
 */
export function getPhaseScore(currentPhase: string): number {
  const n = getPhaseNumber(currentPhase);
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
 * Legacy Points from lifetime food and the phase reached.
 * Formula: floor(log10(totalFoodProduced) × phaseScore / divisor), none below
 * the minimum food (numbers in `prestigeBalance.lp`).
 */
export function calculateLegacyPoints(
  totalFoodProduced: number,
  phaseScore: number,
): number {
  const { minFood, phaseScoreDivisor } = prestigeBalance.lp;
  if (totalFoodProduced < minFood) return 0;
  return Math.floor(Math.log10(totalFoodProduced) * phaseScore / phaseScoreDivisor);
}

/**
 * The Legacy Points a prestige from this state awards (Story 5.2): the food
 * formula plus the entropy bonus. `prestige()` adds it to the LP held and to
 * `lifetimeLpEarned`; the prestige card previews it.
 */
export function legacyPointsAward(state: GameState): number {
  return (
    calculateLegacyPoints(state.prestige.totalFoodProduced, getPhaseScore(state.phase)) +
    calculateEntropyPrestigeBonus(state)
  );
}

/**
 * What survives a prestige (Story 5.3, FR30), by top-level field. Everything
 * else is back at its `createInitialState()` value, except what an owned
 * Legacy upgrade grants. Kept: the generator and the seed (Story 3.1), LP,
 * lifetime LP and the lifetime totals (`prestige`, updated by the prestige),
 * the bought Legacy upgrades, the lifetime statistics (`stats`, `lifetime`,
 * and the kills tally in `soldiers.totalKilled`), the victory record, the
 * verbs the player has learned (`automation`, ADR 0039), and bookkeeping that
 * isn't part of a run (`nextIds` stay monotonic, the save clock).
 */
export const PRESTIGE_KEEPS = [
  'seed',
  'rng',
  'prestige',
  'prestigeTree',
  'stats',
  'lifetime',
  'victoryAchieved',
  'automation',
  'nextIds',
  'lastSaveTimestamp',
] as const satisfies readonly (keyof GameState)[];

/**
 * Execute the prestige reset (Story 5.3, FR30): a new run from a fresh state.
 *
 * Every resource (space resources included), building, research project,
 * mutation, piece of equipment, territory, expedition, ship, exploration, the
 * goal latch and any open decision event go back to their initial values.
 * `PRESTIGE_KEEPS` survive, with LP and lifetime LP raised by the award.
 * Legacy upgrades grant the rest: the royal cache's eggs (in the pipeline, so
 * they hatch, Story 2.5) and food, and Phase Skip's start in Colony. The next
 * enemy is the first the kept generator draws for a run with no battles won.
 */
export function prestige(state: GameState): GameState {
  const award = legacyPointsAward(state);
  const fresh = createInitialState();
  const cache = prestigeBalance.royalCache;
  const bonuses = getPrestigeBonuses(state);
  const kept = Object.fromEntries(PRESTIGE_KEEPS.map((k) => [k, state[k]])) as Pick<GameState, (typeof PRESTIGE_KEEPS)[number]>;
  const eggs = bonuses.startingResources ? cache.eggs : fresh.resources.eggs;

  return {
    ...fresh,
    ...kept,
    phase: bonuses.phaseSkip ? Phase.COLONY : Phase.EGG_LAYING,
    resources: {
      ...fresh.resources,
      eggs,
      food: bonuses.startingResources ? cache.food : fresh.resources.food,
    },
    eggPipeline: { ...fresh.eggPipeline, count: eggs },
    soldiers: { ...fresh.soldiers, totalKilled: state.soldiers.totalKilled },
    nextEnemy: peekEnemy(state.rng, 0).type as GameState['nextEnemy'],
    prestige: {
      ...state.prestige,
      count: state.prestige.count + 1,
      legacyPoints: state.prestige.legacyPoints + award,
      lifetimeLpEarned: state.prestige.lifetimeLpEarned + award,
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
 * deducted. `lifetimeLpEarned` is untouched, so the production bonus stays
 * (Story 5.2). Returns null if requirements are not met.
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
