/**
 * Scene tuning (Story 8.5, Story 8.6; AR14, D11): how often the nest scene
 * reads the colony, when a chamber turns its creatures into a dot cloud, and
 * how the individual ants move. Read by the scene's view hook,
 * `ui/scenes/nestLayout.ts` and `ui/scenes/antMotion.ts`. Tests import these;
 * they never restate the numbers.
 *
 * The exact counts are always HTML text (chamber labels), so neither the
 * cloud nor its dot cap ever hides a number. Story 8.7 adds the camera steps.
 */
export const sceneBalance = {
  /** The scene reads its view at most this often (4 times a second). */
  viewRefreshMs: 250,
  /**
   * A chamber turns its extras into a dot cloud once its creatures, all drawn,
   * would cover more than this share of its area (DESIGN.md: about 15 %).
   */
  cloudCoverage: 0.15,
  /** Individual ants kept moving on top of a cloud, at least (DESIGN.md: 30–50). */
  cloudAntsMin: 30,
  /** Individually animated ants in the whole scene, at most (AR14: ≤ 50). */
  animatedAntsMax: 50,
  /** Dots drawn in one chamber's cloud, at most: past this the cloud is as dense as it gets. */
  cloudDotsMax: 1500,
  /** Every this-many-th individual ant walks a tunnel; the others sway in their chamber. */
  tunnelWalkerEvery: 6,
  /** A tunnel walker goes from one end of its tunnel to the other in this time, and back in the same. */
  tunnelWalkMs: 9000,
  /** A chamber ant sways forward and back once in this time. */
  antSwayMs: 2600,
} as const;
