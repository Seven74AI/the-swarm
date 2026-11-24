import { Phase } from '../../phases/phases';
import { HOUR_MS } from '../constants';

const MIN_MS = 60_000;

/**
 * When a phase should be done in real time: within the first `within`
 * check-ins, or on a day from `fromDay` to `toDay` (day 1 = the first), and
 * then not in the first `afterCheckIns` check-ins (ending earlier is fast).
 */
export type FinishTarget =
  | { readonly kind: 'checkIns'; readonly within: number; readonly label: string }
  | { readonly kind: 'days'; readonly fromDay: number; readonly toDay: number; readonly afterCheckIns?: number; readonly label: string };

/**
 * The three first-week gates (Story 9.1, FR65, GDD *Success Metrics*). The
 * report marks each pass or fail; CI never asserts one on a real run.
 */
export interface FirstWeekGates {
  /** Gate 1: no stretch of play longer than `maxMs` without a payoff in the first `windowMs` of session 1. */
  readonly idleGap: { readonly windowMs: number; readonly maxMs: number };
  /** Gate 2: `phase` (Combat) ends on a day from `fromDay` to `toDay`. */
  readonly phaseEnd: { readonly phase: Phase; readonly fromDay: number; readonly toDay: number };
  /** Gate 3: check-ins starting after day `afterDay`: their median length in `medianMs`, and at least `decisionSharePercent` % offering a decision. */
  readonly postWeek: { readonly afterDay: number; readonly medianMs: { readonly min: number; readonly max: number }; readonly decisionSharePercent: number };
}

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
  readonly criticalMoments: { readonly phase: Phase; readonly min: number };
  readonly gates: FirstWeekGates;
  /**
   * Starvation's bounds (Story 9.16): at most `session1MaxDeaths` deaths in
   * session 1, and no starving stretch (consecutive check-ins that starved)
   * in days `fromDay`–`toDay` longer than `maxStretchCheckIns`.
   */
  readonly starvation: { readonly session1MaxDeaths: number; readonly fromDay: number; readonly toDay: number; readonly maxStretchCheckIns: number };
}

/**
 * The GDD's pacing targets (Difficulty Curve, Session Shape, Success Metrics
 * and Pillar 3), for the first-week player (Story 9.1). Only the pacing report (`pnpm sim`, Story
 * 3.9) reads them: tests never assert them, and Story 3.11 tunes the game
 * towards them, not these numbers.
 */
export const pacingTargets: PacingTargets = {
  /** The MVP phases (GDD: Phases 1–3), in phase order. */
  phases: [
    // The first minutes of session 1.
    { phase: Phase.EGG_LAYING, label: '1 Egg Laying', activeMs: { min: 3 * MIN_MS, max: 5 * MIN_MS }, finish: { kind: 'checkIns', within: 1, label: 'Session 1' } },
    // The rest of session 1 plus a short later session; ends later on day 1, after session 1 (GDD [ASSUMPTION: derived]).
    { phase: Phase.COLONY, label: '2 Colony', activeMs: { min: 45 * MIN_MS, max: 70 * MIN_MS }, finish: { kind: 'days', fromDay: 1, toDay: 1, afterCheckIns: 1, label: 'Day 1, after session 1' } },
    // Days 2–7 of sessions; no active-play target (it shrinks with the sessions).
    { phase: Phase.COMBAT, label: '3 Combat', activeMs: null, finish: { kind: 'days', fromDay: 2, toDay: 7, label: 'Days 2–7' } },
  ],
  /** Pillar 3: tapping supplies at least this share (%) of the eggs in the first `tapWindowMs` of play … */
  tapWindowMs: 2 * MIN_MS,
  tapShareFirstMinPercent: 80,
  /** … and under this share (%) once the player reaches Colony. */
  tapShareAfterColonyMaxPercent: 10,
  /** A check-in where nothing can be done for longer than this (one check-in interval) is a pacing defect. */
  idleCheckInMaxMs: 4 * HOUR_MS,
  /** Story 3.11: upkeep and capacity still bite. At least `min` check-ins of `phase` where food, and where capacity, is critical. */
  criticalMoments: { phase: Phase.COLONY, min: 1 },
  starvation: { session1MaxDeaths: 0, fromDay: 2, toDay: 7, maxStretchCheckIns: 1 },
  gates: {
    idleGap: { windowMs: 30 * MIN_MS, maxMs: 2 * MIN_MS },
    // "Phase 3 lasts to about day 7".
    phaseEnd: { phase: Phase.COMBAT, fromDay: 6, toDay: 8 },
    postWeek: { afterDay: 7, medianMs: { min: 90_000, max: 120_000 }, decisionSharePercent: 100 },
  },
};

/** How `pnpm sim` plays by default: a fresh game, one seed, the first-week schedule over 10 days (Story 9.1). */
export const pacingReportDefaults = {
  seed: 1,
  days: 10,
} as const;
