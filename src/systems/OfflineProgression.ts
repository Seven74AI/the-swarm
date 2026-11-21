import type { GameState } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { computeResourceRates } from './ResourceSystem';
import {
  OFFLINE_CAP_BASE_MS,
  OFFLINE_CAP_MAX_MS,
  OFFLINE_EFFICIENCY_BASE_POINTS,
  OFFLINE_EFFICIENCY_MAX_POINTS,
} from '../data/constants';
import { PRESTIGE_UPGRADES, type PrestigeUpgrade } from '../data/prestigeTree';
import { getProjects } from './ResearchSystem';

/**
 * Offline Progression — calculates how many game ticks to simulate
 * when the player returns after being away.
 *
 * - Offline progress is capped by `getOfflineCapMs(state)` (Story 2.4)
 * - Offline efficiency is `getOfflineEfficiency(state)` (Story 2.8): 50%, plus
 *   the run's offline research, plus the Legacy efficiency node, at most 100%
 *
 * Closed-form resource computation (rate × time) for deterministic
 * resources (food, wood, stone). Tick-based catch-up remains for
 * non-linear events (pipelines, battles, expeditions).
 */

/** How much of an absence is simulated (Story 2.4). */
export interface OfflinePlan {
  /** Wall-clock ms away (negative gaps read as 0). */
  elapsedMs: number;
  /** Ms simulated: `elapsedMs`, at most `capMs`. */
  effectiveMs: number;
  /** Game ticks to simulate for the non-linear parts (efficiency-reduced). */
  offlineTicks: number;
  /** The cap that applied: `getOfflineCapMs(state)`. */
  capMs: number;
  /** True when the absence was longer than the cap. */
  capped: boolean;
}

/** The simulated tick length. */
const TICK_MS = 50;

/**
 * Closed-form resource deltas for the full offline period.
 * Computed once from initial state rates × total offline time.
 */
export interface OfflineResourceDeltas {
  /** Net food change (production - consumption) over the offline period. */
  foodDelta: number;
  /** Wood produced from territory bonuses over the offline period. */
  woodDelta: number;
  /** Stone produced from territory bonuses over the offline period. */
  stoneDelta: number;
  /** Nectar produced from territory bonuses over the offline period. */
  nectarDelta: number;
  /** Gross food produced (before consumption) — for prestige tracking. */
  grossFoodProduced: number;
}

/**
 * Compute closed-form resource deltas for the offline period.
 *
 * Uses the production rates from the initial game state and multiplies
 * by the total offline time. This is an approximation — worker count
 * may change during catch-up, affecting actual rates — but it provides
 * a correct order-of-magnitude result and is consistent with idle game
 * conventions (Cookie Clicker, AdVenture Capitalist, etc.).
 *
 * @param state - Initial game state at the moment of save
 * @param totalDtSec - Total offline time in seconds (effectiveMs / 1000)
 * @param territoryBonuses - Territory bonuses from the initial state
 * @returns Total resource deltas for the full offline period
 */
export function computeOfflineResourceDeltas(
  state: GameState,
  totalDtSec: number,
  territoryBonuses?: TerritoryBonuses,
): OfflineResourceDeltas {
  if (totalDtSec <= 0) {
    return { foodDelta: 0, woodDelta: 0, stoneDelta: 0, nectarDelta: 0, grossFoodProduced: 0 };
  }

  const rates = computeResourceRates(state, territoryBonuses);

  // Gross food produced (for prestige tracking — totalFoodProduced)
  const grossFoodProduced = rates.foodProducedPerSec * totalDtSec;

  // Net food = production - consumption
  const netFoodRate = rates.foodProducedPerSec - rates.foodConsumedPerSec;
  const foodDelta = netFoodRate * totalDtSec;

  return {
    foodDelta,
    woodDelta: rates.woodPerSec * totalDtSec,
    stoneDelta: rates.stonePerSec * totalDtSec,
    nectarDelta: rates.nectarPerSec * totalDtSec,
    grossFoodProduced,
  };
}

/**
 * The offline cap (Story 2.4, FR20): the most resumed time that is simulated.
 * The baseline from data/constants.ts plus the `offlineCapRaiseMs` of every
 * owned Legacy upgrade, never above `OFFLINE_CAP_MAX_MS`. Every offline path
 * reads the cap here and nowhere else (tests/arch/offlineCap.test.ts).
 *
 * @param upgrades - the upgrade table (tests pass one with cap-raise nodes)
 */
export function getOfflineCapMs(state: GameState, upgrades: readonly PrestigeUpgrade[] = PRESTIGE_UPGRADES): number {
  const owned = new Set(state.prestigeTree?.purchased ?? []);
  let raise = 0;
  for (const u of upgrades) {
    if (owned.has(u.id)) raise += u.offlineCapRaiseMs ?? 0;
  }
  return Math.min(OFFLINE_CAP_BASE_MS + raise, OFFLINE_CAP_MAX_MS);
}

/**
 * Offline efficiency (Story 2.8, FR21) as a fraction (0.5 = 50%): the base
 * points, plus `offlineEfficiencyPoints` of every research project this run
 * has done, plus those of every owned Legacy upgrade, never above the max.
 * Additive, so the research and the Legacy node can come in either order.
 *
 * @param upgrades - the upgrade table (tests pass one with extra nodes)
 */
export function getOfflineEfficiency(state: GameState, upgrades: readonly PrestigeUpgrade[] = PRESTIGE_UPGRADES): number {
  let points: number = OFFLINE_EFFICIENCY_BASE_POINTS;
  const projects = state.research?.projects;
  for (const p of getProjects()) {
    if (projects?.[p.id]?.status === 'done') points += p.offlineEfficiencyPoints ?? 0;
  }
  const owned = new Set(state.prestigeTree?.purchased ?? []);
  for (const u of upgrades) {
    if (owned.has(u.id)) points += u.offlineEfficiencyPoints ?? 0;
  }
  return Math.min(points, OFFLINE_EFFICIENCY_MAX_POINTS) / 100;
}

/** `ms` of absence, cut to the offline cap (negative and non-finite gaps read as 0). */
export function capOfflineMs(state: GameState, ms: number, upgrades?: readonly PrestigeUpgrade[]): number {
  if (!(ms > 0)) return 0;
  return Math.min(ms, getOfflineCapMs(state, upgrades));
}

/**
 * Plan the catch-up for an absence of `elapsedMs`: at most the cap is
 * simulated, at `efficiency` (0.5 = 50%) of its ticks.
 */
export function planOffline(
  state: GameState,
  elapsedMs: number,
  efficiency: number,
  upgrades?: readonly PrestigeUpgrade[],
): OfflinePlan {
  const away = elapsedMs > 0 ? elapsedMs : 0;
  const capMs = getOfflineCapMs(state, upgrades);
  const effectiveMs = capOfflineMs(state, away, upgrades);
  const offlineTicks = Math.floor(Math.floor(effectiveMs / TICK_MS) * efficiency);
  return { elapsedMs: away, effectiveMs, offlineTicks, capMs, capped: away > capMs };
}
