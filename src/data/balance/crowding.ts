/**
 * Crowding (Story 9.13, FR60): a nest packed past its rooms works slower.
 * Read by `systems/Crowding.ts`. Tests import these; they never restate them.
 * Story 9.18 tunes them against the `pnpm sim` gates.
 */
export const crowdingBalance = {
  /** The least work a crowded nest does, as a share of normal work (50%). */
  floor: 0.5,
  /**
   * Work lost per unit of overfill share: at an overfill share `o` (creatures
   * past the room space, over the room space) work runs at `1 − perOverfill × o`,
   * never below `floor`. At 1, a nest holding half again its rooms is at the floor.
   */
  perOverfill: 0.02,
} as const;
