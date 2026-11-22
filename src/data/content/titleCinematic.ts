/**
 * The title cinematic (Story 8.10, UX-DR28; EXPERIENCE.md → Flow 1,
 * `mockups/title-cinematic.html`): its words and its beats.
 *
 * About 11 s, Phase 1 only: a queen lands on the grass, tunnels down, the
 * first chamber opens (`ONE EGG.`), the colony swarms through new chambers
 * (`ONE QUEEN.`), the soil clears and the ants march up into THE SWARM
 * (`ONE EGG. ONE QUEEN. ONE SWARM.`). It ends on `[ TAP TO WAKE THE QUEEN ]`;
 * the tap shows `A QUEEN, ALONE.`, then the brood chamber, where a coach mark
 * points at LAY EGG.
 *
 * No line names a later phase, and nothing later is drawn (DESIGN.md rule 1).
 * Colony voice (UX-DR42): upper case, a full stop (tests/arch/voice.test.ts).
 */

export const TITLE_COPY = {
  /** The first chamber opens. */
  egg: 'ONE EGG.',
  /** The colony swarms. */
  queen: 'ONE QUEEN.',
  /** Under the logo, on the title frame. */
  tagline: 'ONE EGG. ONE QUEEN. ONE SWARM.',
  /** The logo's words, as a screen reader hears them (the block letters are a drawing). */
  logo: 'THE SWARM',
  /** The button the cinematic ends on (drawn in brackets, `[ … ]`). */
  wake: 'TAP TO WAKE THE QUEEN',
  /** The line after the wake tap, before the brood chamber. */
  alone: 'A QUEEN, ALONE.',
  /** The skip control while the cinematic plays. */
  skip: 'SKIP INTRO',
  /** The coach mark on LAY EGG once the queen wakes (concept `lay-egg`). */
  layEggCoach: 'Tap LAY EGG to lay your first egg.',
} as const;

/** The coach mark's concept id: coached once, ever (settings `coachMarksSeen`). */
export const LAY_EGG_CONCEPT = 'lay-egg';

/**
 * The beats, in ms from the start. Each `…Ms` is when a beat starts; a pair
 * (`…StartMs`, `…EndMs`) is a span the scene eases through.
 */
export const TITLE_BEATS = {
  /** The queen drops onto the grass… */
  landStartMs: 500,
  landEndMs: 1200,
  /** …then tunnels down. */
  tunnelStartMs: 2000,
  tunnelEndMs: 4200,
  /** The first chamber opens around her. */
  chamberStartMs: 3700,
  chamberOpenMs: 600,
  /** `ONE EGG.` and the first egg. */
  eggMs: 4500,
  /** The colony swarms through new chambers, one after another. */
  swarmStartMs: 5600,
  chamberStaggerMs: 260,
  /** `ONE QUEEN.` */
  queenMs: 6700,
  /** The soil clears and the ants march up into the logo. */
  marchStartMs: 8600,
  /** The title frame: the logo, the tagline and the wake button. */
  titleMs: 11000,
  /** How long `A QUEEN, ALONE.` holds before the brood chamber. */
  aloneMs: 1800,
} as const;
