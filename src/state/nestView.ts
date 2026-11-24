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
  /** Rooms dug (Story 9.6, `state.dig.roomsDug`): the scene draws them and frames the whole dug nest. 0 when absent. */
  readonly roomsDug?: number;
  /** Creatures past the room space (Story 9.13, `getCrowding`): the scene spills them into the tunnels. 0 when absent. */
  readonly overfill?: number;
}

const whole = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** The view of a state's resources (the strip's eggs, larvae and workers, floored), whether it starves, its rooms and its overfill. */
export function nestViewOf(r: GameState['resources'], starving = false, roomsDug = 0, overfill = 0): NestView {
  return { workers: whole(r.workers), eggs: whole(r.eggs), larvae: whole(r.larvae), starving, roomsDug: whole(roomsDug), overfill: whole(overfill) };
}

export function sameNestView(a: NestView, b: NestView): boolean {
  return a.workers === b.workers && a.eggs === b.eggs && a.larvae === b.larvae && a.starving === b.starving && (a.roomsDug ?? 0) === (b.roomsDug ?? 0) && (a.overfill ?? 0) === (b.overfill ?? 0);
}
