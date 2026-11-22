import { sceneBalance } from '../../data/balance/scene';
import { ANT_LENGTH, SCENE_WIDTH, type ChamberGeometry, type NestLayout } from './nestLayout';

/**
 * The nest's camera (Story 8.7; UX-DR34): pure geometry, no state.
 *
 * The colony's size picks a step (`sceneBalance.cameraSteps`: 2× for a young
 * colony, 1.5× from about 50 workers, 1× from about 150). The container hands
 * the scene that step as its `zoom` prop (Story 8.9's contract: 1 = close,
 * below 1 pulled back), and the scene scales its drawing by
 * `zoom × CAMERA_CLOSE` about `layout.cameraOrigin`, easing there in CSS over
 * `feelBalance.cameraPullBackMs` (instant under reduced motion).
 *
 * Chamber labels stay anchored at their chambers through the camera, and are
 * clamped into the stage, so a chamber outside the frame still shows its
 * exact counts at the stage's edge.
 */

/** A part of the drawing, in viewBox units. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A camera pull-back, in the scene's `zoom` terms (1 = close): the zoom it left and the one it reached. */
export interface CameraPullBack {
  readonly from: number;
  readonly to: number;
}

const steps = sceneBalance.cameraSteps;
/** The closest step's scale: the drawing's scale at `zoom` 1. */
export const CAMERA_CLOSE = Math.max(...steps.map((s) => s.zoom));
const FARTHEST = Math.min(...steps.map((s) => s.zoom));

/**
 * The narrowest the stage is ever drawn, in CSS px: there, a worker at the
 * farthest step is still `antMinPx` long (DESIGN.md: never under 12 px).
 */
export const MIN_STAGE_PX = Math.ceil((sceneBalance.antMinPx * SCENE_WIDTH) / (ANT_LENGTH * FARTHEST));

/**
 * The camera step (an index into `cameraSteps`) for a colony of `workers`.
 * Out to the widest step the colony has reached; back in only once it falls
 * under `cameraZoomInShare` of the threshold it had passed (`previous`).
 */
export function cameraStep(workers: number, previous: number | null): number {
  let step = 0;
  for (let i = 0; i < steps.length; i++) if (workers >= steps[i].workers) step = i;
  if (previous === null || previous <= step) return step;
  for (let held = Math.min(previous, steps.length - 1); held > step; held--) {
    if (workers >= Math.floor(steps[held].workers * sceneBalance.cameraZoomInShare)) return held;
  }
  return step;
}

/** A step as the scene's `zoom` prop: 1 for the closest step, below 1 for each step back. */
export const cameraZoom = (step: number): number => steps[step].zoom / CAMERA_CLOSE;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * What the camera frames with the drawing scaled by `scale` (1 = the whole
 * drawing) about `layout.cameraOrigin`: always inside the drawing.
 */
export function cameraRect(layout: Pick<NestLayout, 'width' | 'height' | 'cameraOrigin'>, scale: number): Rect {
  const s = Math.max(1, scale);
  const o = layout.cameraOrigin;
  return { x: o.x * (1 - 1 / s), y: o.y * (1 - 1 / s), w: layout.width / s, h: layout.height / s };
}

/** A chamber label's anchor through the camera, as fractions of the stage (0..1, clamped). */
export function chamberAnchor(chamber: ChamberGeometry, layout: Pick<NestLayout, 'width' | 'height'>, r: Rect): { x: number; y: number } {
  const wx = chamber.label.x * layout.width;
  const wy = chamber.label.y * layout.height;
  return { x: clamp((wx - r.x) / r.w, 0, 1), y: clamp((wy - r.y) / r.h, 0, 1) };
}
