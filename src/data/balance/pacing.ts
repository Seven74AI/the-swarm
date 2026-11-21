import { Phase } from '../../phases/phases';
import { HOUR_MS } from '../constants';

const MIN_MS = 60_000;

/** When a phase should be done in real time: within the first `within` check-ins, or on a day from `fromDay` to `toDay` (day 1 = the first). */
export type FinishTarget =
  | { readonly kind: 'checkIns'; readonly within: number; readonly label: string }
  | { readonly kind: 'days'; readonly fromDay: number; readonly toDay: number; readonly label: string };

export interface PhaseTarget {
  readonly phase: Phase;
  readonly label: string;
  /** Active play the phase should take; null where the GDD has no target yet. */
  readonly activeMs: { readonly min: number; readonly max: number } | null;
  readonly finish: FinishTarget;
}

export interface PacingTargets {
  readonly phases: readonly PhaseTarget[];
  readonly tapWindowMs: number;
  readonly tapShareFirstMinPercent: number;
  readonly tapShareAfterColonyMaxPercent: number;
  readonly idleCheckInMaxMs: number;
}

/**
 * The GDD's pacing targets (Difficulty Curve and Pillar 3), for a player who
 * checks in about 6 times a day. Only the pacing report (`pnpm sim`, Story
 * 3.9) reads them: tests never assert them, and Story 3.11 tunes the game
 * towards them, not these numbers.
 */
export const pacingTargets: PacingTargets = {
  /** The MVP phases (GDD: Phases 1–3), in phase order. */
  phases: [
    { phase: Phase.EGG_LAYING, label: '1 Egg Laying', activeMs: { min: 3 * MIN_MS, max: 5 * MIN_MS }, finish: { kind: 'checkIns', within: 1, label: 'First session' } },
    { phase: Phase.COLONY, label: '2 Colony', activeMs: { min: 20 * MIN_MS, max: 40 * MIN_MS }, finish: { kind: 'days', fromDay: 1, toDay: 1, label: 'Day 1' } },
    // Active-play target TBD from E3 telemetry (GDD [ASSUMPTION]).
    { phase: Phase.COMBAT, label: '3 Combat', activeMs: null, finish: { kind: 'days', fromDay: 2, toDay: 3, label: 'Days 2–3' } },
  ],
  /** Pillar 3: tapping supplies at least this share (%) of the eggs in the first `tapWindowMs` of play … */
  tapWindowMs: 2 * MIN_MS,
  tapShareFirstMinPercent: 80,
  /** … and under this share (%) once the player reaches Colony. */
  tapShareAfterColonyMaxPercent: 10,
  /** A check-in where nothing can be done for longer than this (one check-in interval) is a pacing defect. */
  idleCheckInMaxMs: 4 * HOUR_MS,
};

/** How `pnpm sim` plays by default: a fresh game, one seed, a week of check-ins. */
export const pacingReportDefaults = {
  seed: 1,
  days: 7,
} as const;
