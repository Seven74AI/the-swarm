/**
 * Scene tuning (Story 8.5, Story 8.6; AR14, D11): how often the nest scene
 * reads the colony, when a chamber turns its creatures into a dot cloud, and
 * how the individual ants move. Read by the scene's view hook,
 * `ui/scenes/nestLayout.ts` and `ui/scenes/antMotion.ts`. Tests import these;
 * they never restate the numbers.
 *
 * The exact counts are always HTML text (chamber labels), so neither the
 * cloud nor its dot cap ever hides a number.
 *
 * Story 8.7 (UX-DR34) adds the camera steps, wandering and the starving
 * colony's thinning (`ui/scenes/nestCamera.ts`, `antMotion.ts`). How long the
 * camera eases and a creature arrives is game feel (`feelBalance`, Story 8.9).
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
  /**
   * The camera's steps (UX-DR34): 2× for a young colony, 1.5× from about 50
   * workers, 1× from about 150. Ordered by `workers`, each step's zoom below the last.
   */
  cameraSteps: [
    { workers: 0, zoom: 2 },
    { workers: 50, zoom: 1.5 },
    { workers: 150, zoom: 1 },
  ],
  /**
   * Once pulled back, the camera comes in again only when the colony falls
   * under this share of the step's threshold, so a colony hovering at it does
   * not pump the camera.
   */
  cameraZoomInShare: 0.9,
  /** An individually drawn worker is never smaller than this on screen, in CSS px (DESIGN.md). */
  antMinPx: 12,
  /** A chamber ant wanders up to this far from where it rests, along each axis (viewBox units). */
  wanderReach: 7,
  /** A chamber ant goes once round its wander in about this time (each ant a little slower or faster). */
  wanderMs: 11000,
  /** The first this-many workers settle closer to the chamber's door, so a young colony gathers in view. */
  doorFillAnts: 50,
  /**
   * A starving colony draws this share of its workers (individual ants and
   * cloud dots), so it visibly thins; the labels keep the exact count.
   */
  starvingShown: 0.5,
} as const;
