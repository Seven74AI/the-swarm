import type { CameraPullBack } from '../scenes/nestCamera';

/**
 * The nest camera's pull-back, as a UI event (Story 8.7; UX-DR34, EXPERIENCE.md
 * → Game Feel & Juice, "Camera pull-back"). The scene reports each pull-back
 * to a wider step (`NestScene`'s `onCameraPullBack`) and `NestSceneArea`
 * forwards it here, so a feel layer (Story 8.9) can hook it without reaching
 * into the scene:
 *
 *   const stop = onCameraPullBack(({ from, to }) => …); // zooms, e.g. 2 → 1.5
 *
 * It fires once per step, after the render that starts the ease (or the jump,
 * under reduced motion), never on mount and never when the camera moves back
 * in. A UI event only: it is not in the game state, the save or the EventBus.
 */

type Listener = (pull: CameraPullBack) => void;
const listeners = new Set<Listener>();

/** Listen to every nest camera pull-back; returns the way to stop. */
export function onCameraPullBack(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tell every listener that the nest camera pulled back (called by `NestSceneArea`). */
export function cameraPulledBack(pull: CameraPullBack): void {
  for (const listener of listeners) listener(pull);
}
