/**
 * The resource sheet's verdict line (Story 9.11, UX-DR50): the worst current
 * state, first match wins, in this order. `systems/Verdict.ts` checks them;
 * the text is here.
 */
export type VerdictKind = 'starving' | 'food' | 'limit' | 'nest' | 'growing';
/**
 * The screen a hunger verdict opens (Story 9.17, FR27): WRKR's Gather row, or
 * NEST's room jobs when a room job is what helps (a Larder for a full store; a
 * Pantry once more gatherers can no longer stop the fall).
 */
export type VerdictFix = 'gather' | 'room_jobs';
/**
 * Story 9.16 puts starving first: food at zero and use outrunning production.
 * Story 9.17 adds the full food store (Story 9.15) after food falling.
 */
export const VERDICT_ORDER: readonly VerdictKind[] = ['starving', 'food', 'limit', 'nest', 'growing'];

export const VERDICT_COPY = {
  /** `FOOD LASTS 4M 10S`; at zero, the store is already empty. */
  foodLasts: (time: string) => `FOOD LASTS ${time}`,
  foodGone: 'FOOD IS GONE',
  /** `STARVING · AN ANT DIES EVERY 5S` (Story 9.16). */
  starving: (time: string) => `STARVING · AN ANT DIES EVERY ${time}`,
  /** The store is at the limit (Story 9.17): new food is lost until it is spent or a Larder holds more. */
  atLimit: 'FOOD AT THE LIMIT · NEW FOOD IS LOST',
  /** Under a starving or falling verdict (Story 9.17): where the colony settles from `getSettlesAt`. */
  settles: (workers: string) => `IF NOTHING CHANGES: SETTLES AT ${workers} WORKERS.`,
  nestFull: (larvae: string) => `NEST FULL · ${larvae} LARVAE WAIT`,
  growing: 'EVERYTHING IS GROWING',
} as const;
