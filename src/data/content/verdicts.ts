/**
 * The resource sheet's verdict line (Story 9.11, UX-DR50): the worst current
 * state, first match wins, in this order. `systems/Verdict.ts` checks them;
 * the text is here.
 */
export type VerdictKind = 'food' | 'nest' | 'growing';
export const VERDICT_ORDER: readonly VerdictKind[] = ['food', 'nest', 'growing'];

export const VERDICT_COPY = {
  /** `FOOD LASTS 4M 10S`; at zero, the store is already empty. */
  foodLasts: (time: string) => `FOOD LASTS ${time}`,
  foodGone: 'FOOD IS GONE',
  nestFull: (larvae: string) => `NEST FULL · ${larvae} LARVAE WAIT`,
  growing: 'EVERYTHING IS GROWING',
} as const;
