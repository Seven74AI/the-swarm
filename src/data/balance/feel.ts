/**
 * Game-feel timing (Story 8.9, FR41, UX-DR37; EXPERIENCE.md → Game Feel & Juice).
 *
 * UI feel, never game balance: these change how a moment looks, not what it
 * does. Read by `ui/primitives/floats.ts`, `ui/primitives/TypeIn.tsx` and the
 * nest scene. Tests import these; they never restate the numbers.
 */
export const feelBalance = {
  /** A floating `+N` appears at most this many times in any second (UX-DR37). */
  floatMaxPerSec: 8,
  /** The window `floatMaxPerSec` is counted over. */
  floatWindowMs: 1000,
  /** How long a `+N` lives (its CSS float animation is shorter). */
  floatLifeMs: 1000,
  /** A headline types in at one character every this long… */
  typeInCharMs: 45,
  /** …and is whole after this long at most, however long it is. */
  typeInMaxMs: 900,
  /** A creature that arrives in the nest scene (an egg by the queen, a larva, a worker walking in) takes this long. */
  arriveMs: 700,
  /** A room that opens in the nest scene (dirt falls, its wall appears) takes this long (Story 9.6; at most about 1 s). */
  roomOpenMs: 900,
} as const;
