/**
 * DIG (Story 9.2, FR55, FR3, FR5): the nest grows one room at a time. A DIG
 * press adds a chunk of dig points to the current room, diggers add to every
 * press and dig slowly on their own; once the room's points are in, it opens
 * and the nest holds `roomSize` more ants. Read by `systems/Dig.ts`. Tests
 * import these; they never restate the numbers. Story 9.9 tunes them against
 * the `pnpm sim` gates.
 */
export const digBalance = {
  /** Nest capacity one room adds (more than 1). */
  roomSize: 5,
  /** Dig points the first room costs. */
  firstRoomPoints: 25000,
  /** Each room dug adds this share of the first room's cost to every later room (linear, so a big nest stays diggable). */
  roomGrowthPerRoom: 0.25,
  /** Dig points a press adds on its own. */
  pressPoints: 10,
  /** Dig points every worker on the DIG role adds to each press (the sum floored to whole points). */
  pressPointsPerDigger: 0.25,
  /** Dig points one digger digs a second on its own (Tunnels multiply it). */
  diggerPointsPerSec: 0.05,
  /** Dig points of dirt per stone a press brings in. */
  pointsPerStone: 200,
} as const;
