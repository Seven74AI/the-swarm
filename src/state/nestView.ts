import type { GameState } from './GameState';

/**
 * What the nest scene draws (Story 8.5, AR14, N1): whole counts only. The
 * scene gets this as a prop and never reads the state itself; the chamber
 * labels print these numbers, never a count of drawn ants.
 *
 * Later stories extend it (Story 8.7: camera, starving). The dot cloud (Story 8.6) is worked out by `nestLayout` from these counts.
 */
export interface NestView {
  readonly workers: number;
  readonly eggs: number;
  readonly larvae: number;
}

const whole = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** The view of a state's resources: the strip's eggs, larvae and workers, floored. */
export function nestViewOf(r: GameState['resources']): NestView {
  return { workers: whole(r.workers), eggs: whole(r.eggs), larvae: whole(r.larvae) };
}

export function sameNestView(a: NestView, b: NestView): boolean {
  return a.workers === b.workers && a.eggs === b.eggs && a.larvae === b.larvae;
}
