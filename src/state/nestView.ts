import type { GameState } from './GameState';

/**
 * What the nest scene draws (Story 8.5, AR14, N1): whole counts only. The
 * scene gets this as a prop and never reads the state itself; the chamber
 * labels print these numbers, never a count of drawn ants.
 *
 * The dot cloud (Story 8.6) and the camera step (Story 8.7) are worked out
 * in `ui/scenes/` from these counts.
 */
export interface NestView {
  readonly workers: number;
  readonly eggs: number;
  readonly larvae: number;
  /** The colony is starving (`isStarving`, Story 8.7): the scene draws it thinner; the labels keep the counts. */
  readonly starving: boolean;
}

const whole = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** The view of a state's resources (the strip's eggs, larvae and workers, floored) and whether it starves. */
export function nestViewOf(r: GameState['resources'], starving = false): NestView {
  return { workers: whole(r.workers), eggs: whole(r.eggs), larvae: whole(r.larvae), starving };
}

export function sameNestView(a: NestView, b: NestView): boolean {
  return a.workers === b.workers && a.eggs === b.eggs && a.larvae === b.larvae && a.starving === b.starving;
}
