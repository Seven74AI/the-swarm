/**
 * The resource sheet (Story 9.10, UX-DR8): when its rows group by tier, and
 * the history its sparklines draw. Tests import these; they never restate them.
 */
export const sheetBalance = {
  /** Past this many rows, the sheet groups them by tier (`COLONY`, `BATTLE DROPS`, `SPACE`). */
  groupAfterRows: 8,
  /** The sparkline covers this much game time… */
  sparkWindowMs: 10 * 60_000,
  /** …in this many cells, one sample each (a fixed-size history, outside the save). */
  sparkCells: 10,
} as const;
