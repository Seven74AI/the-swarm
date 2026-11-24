import type { GameState } from '../state/GameState';
import { crowdingBalance } from '../data/balance/crowding';
import { getEffects } from './BuildingSystem';
import { PERCENT } from '../data/constants';

/**
 * Crowding (Story 9.13, FR60): every creature that takes up room against the
 * room space. Work runs at full rate while they fit, then slows with the
 * overfill share, never below `crowdingBalance.floor`. Pure; no DOM.
 *
 * It replaces the old worker-count scale penalty: what slows a big colony is
 * a nest too small for it, so digging more room is what fixes it.
 */
export interface Crowding {
  /** Creatures that take up room: workers (researchers included), soldiers (trained and training), scouts and warriors at home, eggs and larvae. Never the queen. */
  readonly creatures: number;
  /** The room space: the effective nest capacity (`roomSpace`). */
  readonly space: number;
  /** Creatures past the room space (0 while they fit). */
  readonly overfill: number;
  /** The work multiplier: exactly 1 while they fit, in [floor, 1) once they don't. */
  readonly multiplier: number;
}

/** The room space: rooms dug × room size + the starting chambers (`nestCapacity`), plus the Warehouse. */
export function roomSpace(s: GameState): number {
  return s.resources.nestCapacity + (getEffects('warehouse', s.buildings.warehouse.level).nestCapacity ?? 0);
}

/** Every creature that takes up room (see `Crowding.creatures`). Scouts and warriors away on an expedition are out of the nest. */
export function roomTakers(s: GameState): number {
  return (
    s.resources.workers +
    (s.workersAssigned.researchers ?? 0) +
    s.combatSoldiers +
    s.soldierPipeline.count +
    s.soldiers.scouts +
    s.soldiers.warriors +
    s.resources.eggs +
    s.resources.larvae
  );
}

/** The work multiplier for `creatures` in `space` (see `Crowding.multiplier`). */
export function crowdingMultiplier(creatures: number, space: number): number {
  if (creatures <= space) return 1;
  if (space <= 0) return crowdingBalance.floor;
  const share = (creatures - space) / space;
  return Math.max(crowdingBalance.floor, 1 - crowdingBalance.perOverfill * share);
}

export function getCrowding(s: GameState): Crowding {
  const creatures = roomTakers(s);
  const space = roomSpace(s);
  return { creatures, space, overfill: Math.max(0, creatures - space), multiplier: crowdingMultiplier(creatures, space) };
}

/** Crowding bites: the nest works slower than normal. */
export function crowdingBites(s: GameState): boolean {
  return getCrowding(s).multiplier < 1;
}

/** The work crowding costs, as a whole percent (at least 1 while it bites), or null while the creatures fit (UX-DR47's `CROWDED · −<n>% WORK`). */
export function crowdedPercent(s: GameState): number | null {
  const m = getCrowding(s).multiplier;
  if (m >= 1) return null;
  return Math.max(1, Math.round((1 - m) * PERCENT));
}
