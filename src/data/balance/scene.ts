/**
 * Scene tuning (Story 8.5, AR14, D11): how often the nest scene reads the
 * colony and how many creatures it draws one by one. Read by the scene's view
 * hook and `ui/scenes/nestLayout.ts`. Tests import these; they never restate
 * the numbers.
 *
 * The exact counts are always HTML text (chamber labels), so a capped drawing
 * never hides a number. Story 8.6 replaces the caps with a dot cloud past a
 * chamber's coverage threshold; Story 8.7 adds the camera steps.
 */
export const sceneBalance = {
  /** The scene reads its view at most this often (4 times a second). */
  viewRefreshMs: 250,
  /** Eggs drawn one by one in the brood chamber, at most. */
  drawnEggsMax: 24,
  /** Larvae drawn one by one in the brood chamber, at most. */
  drawnLarvaeMax: 16,
  /** Workers drawn one by one in the worker chamber, at most (AR14: ≤ 50 individual ants). */
  drawnWorkersMax: 50,
} as const;
