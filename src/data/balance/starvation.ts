/**
 * Starvation (Story 9.16, FR61, FR24): once food is at zero and the colony
 * eats more than it makes, the first eater dies after `graceMs`, then one
 * every `deathIntervalMs`, until production covers use. Each Pantry room
 * stretches both by `perPantry`, up to `pantryMaxFactor` times. Read by
 * `systems/Starvation.ts`. Tests import these; they never restate them.
 */
export const starvationBalance = {
  /** Time at zero food before the first death. */
  graceMs: 20_000,
  /** One eater dies this often while starving (tuned between 2 and 10 s; a bigger deficit never kills faster). */
  deathIntervalMs: 5_000,
  /** Each Pantry room lengthens the grace and the interval by this share. */
  perPantry: 0.25,
  /** The grace and the interval never stretch past this many times their base. */
  pantryMaxFactor: 2,
} as const;
