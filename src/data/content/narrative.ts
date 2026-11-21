import { Phase } from '../../phases/phases';
import type { ColonyLine } from './colonyLines';

/**
 * The story beats of the MVP phases (Story 4.9, FR19; GDD Pillar 2 "each phase
 * changes the game", Phases table "Narrative beat").
 *
 * Each phase has two colony lines:
 * - `entry`: typed in by the phase reveal (`data/content/phaseReveal.ts`) and
 *   written to the log when the phase is committed. The first phase is never
 *   committed: its entry beat opens a new chronicle (`COLONY_LINES.opening`).
 * - `nearGoal`: written to the log once per run, the first time the goal's
 *   progress reaches `narrativeBalance.nearGoalPercent` (`data/balance/narrative.ts`).
 *
 * Both are chronicle milestones (`entryBeatMilestone`, `nearGoalMilestone`), so a
 * reload never repeats them and a prestige (a new chronicle) brings them back.
 * Colony voice (UX-DR42): upper case, present tense, a full stop, no `!`, and no
 * line names a phase after its own (`tests/arch/voice.test.ts`).
 */
export const MVP_PHASES = [Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT] as const;
export type MvpPhase = (typeof MVP_PHASES)[number];

export interface PhaseBeats {
  readonly entry: ColonyLine;
  readonly nearGoal: ColonyLine;
}

export const NARRATIVE_BEATS: Readonly<Record<MvpPhase, PhaseBeats>> = {
  // The queen alone.
  [Phase.EGG_LAYING]: {
    entry: { text: 'A QUEEN WAKES ALONE IN THE DARK.', from: Phase.EGG_LAYING },
    nearGoal: { text: 'THE BROOD CHAMBER FILLS. THE QUEEN IS NO LONGER ALONE.', from: Phase.EGG_LAYING },
  },
  // A colony forms; growth draws attention.
  [Phase.COLONY]: {
    entry: { text: 'MANY LEGS, ONE MIND. THE COLONY BREATHES.', from: Phase.COLONY },
    nearGoal: { text: 'THE NEST GROWS LOUD. SOMETHING OUTSIDE IS LISTENING.', from: Phase.COLONY },
  },
  // The first enemy; the tunnels open up.
  [Phase.COMBAT]: {
    entry: { text: 'SOMETHING MOVES IN THE TUNNELS. IT IS NOT OURS.', from: Phase.COMBAT },
    nearGoal: { text: 'THE ENEMY THINS. ABOVE THE NEST, LIGHT LEAKS IN.', from: Phase.COMBAT },
  },
};

const isMvpPhase = (phase: string): phase is MvpPhase => (MVP_PHASES as readonly string[]).includes(phase);

/** The beats of `phase`, or undefined for a phase without them (after the MVP). */
export function beatsFor(phase: string): PhaseBeats | undefined {
  return isMvpPhase(phase) ? NARRATIVE_BEATS[phase] : undefined;
}

/** The chronicle milestone of a phase's entry beat (the one-time phase line since Story 1.26). */
export const entryBeatMilestone = (phase: string): string => `phase_${phase}`;
/** The chronicle milestone of a phase's near-goal beat. */
export const nearGoalMilestone = (phase: string): string => `near_goal_${phase}`;
