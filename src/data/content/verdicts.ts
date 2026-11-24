/**
 * The resource sheet's verdict line (Story 9.11, UX-DR50): the worst current
 * state, first match wins, in this order. `systems/Verdict.ts` checks them;
 * the text is here.
 */
export type VerdictKind = 'starving' | 'food' | 'nest' | 'growing';
/** Story 9.16 puts starving first: food at zero and use outrunning production. */
export const VERDICT_ORDER: readonly VerdictKind[] = ['starving', 'food', 'nest', 'growing'];

export const VERDICT_COPY = {
  /** `FOOD LASTS 4M 10S`; at zero, the store is already empty. */
  foodLasts: (time: string) => `FOOD LASTS ${time}`,
  foodGone: 'FOOD IS GONE',
  /** `STARVING · AN ANT DIES EVERY 5S` (Story 9.16). */
  starving: (time: string) => `STARVING · AN ANT DIES EVERY ${time}`,
  nestFull: (larvae: string) => `NEST FULL · ${larvae} LARVAE WAIT`,
  growing: 'EVERYTHING IS GROWING',
} as const;
