/**
 * Room jobs (Story 9.14, FR59, FR63): what each job does, and what changing a
 * room's job costs. Read by `systems/RoomJobs.ts`; the copy is in
 * `data/content/roomJobs.ts`. Later stories add jobs here (Larder, Pantry)
 * without touching the choice UI. Tests import these; they never restate them.
 */
export const roomJobBalance = {
  jobs: {
    /** A Gallery holds twice as many ants: one more room's worth of nest capacity (`digBalance.roomSize`). */
    gallery: { extraRooms: 1, foodLimit: 0 },
    /** A Pantry (Story 9.16): starvation warns sooner and bites slower (`starvationBalance.perPantry` a room); it never stops it. */
    pantry: { extraRooms: 0, foodLimit: 0 },
    /** A Larder (Story 9.15) holds food: it raises the food limit by this, far more than a plain room's share. */
    larder: { extraRooms: 0, foodLimit: 2_000 },
  },
  /**
   * Stone to change a room's job, unless it is the first job of a room never
   * assigned (free). Stone comes from digging, so it is always there to earn first.
   */
  changeCostStone: 2_000,
} as const;
