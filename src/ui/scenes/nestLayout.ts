import type { NestView } from '../../state/nestView';
import { sceneBalance } from '../../data/balance/scene';
import { between, hashString, keyedStream, type RngStream } from '../../utils/rng';

/**
 * The nest cross-section as geometry (Story 8.5, AR14, N1): a pure function
 * of the view, so the same colony always draws the same way.
 *
 * Every random-looking choice comes from a stream keyed by what it places
 * (a chamber id, a creature kind and its index), never by call order. A
 * creature keeps its place when another arrives: creature `i` is placed by
 * `(kind, i)` alone.
 *
 * Coordinates are viewBox units (`width` × `height`). Chamber label anchors
 * are fractions of the scene (0..1), for the HTML labels laid over it.
 */

export type ChamberId = 'brood' | 'workers';

/** A creature or the queen: a position and a heading in degrees. */
export interface Token {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

export interface ChamberGeometry {
  readonly id: ChamberId;
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  /** The irregular wall, drawn inside the `rx`/`ry` ellipse. */
  readonly wall: string;
  /** Where its HTML label sits, as fractions of the scene's width and height. */
  readonly label: { readonly x: number; readonly y: number };
}

export interface Pebble {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

export interface NestLayout {
  readonly width: number;
  readonly height: number;
  /** The ground line: soil below, the grass line on it. */
  readonly surfaceY: number;
  readonly grass: string;
  readonly strata: readonly string[];
  readonly pebbles: readonly Pebble[];
  /** Centre lines of the round-capped tunnels. */
  readonly tunnels: readonly { readonly id: string; readonly d: string }[];
  readonly chambers: readonly ChamberGeometry[];
  readonly queen: Token;
  readonly eggs: readonly Token[];
  readonly larvae: readonly Token[];
  readonly workers: readonly Token[];
}

// --- Fixed geometry (layout constants of the drawing, in viewBox units) ------------------------

const WIDTH = 360;
const HEIGHT = 190;
const SURFACE_Y = 18;
const ENTRANCE_X = 180;
const GRASS_STEP = 6;
const GRASS_BLADE = 5;
const STRATA_Y = [56, 102, 150] as const;
const STRATA_STEP = 30;
const STRATA_WAVE = 3;
const PEBBLES = 6;
const WALL_POINTS = 14;
const WALL_WOBBLE = 0.06;
/** Creatures stay within this share of a chamber's radii, inside its irregular wall. */
const INNER = 0.75;
const LABEL_GAP = 4;

interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

const CHAMBERS: Readonly<Record<ChamberId, Ellipse>> = {
  brood: { cx: 92, cy: 80, rx: 72, ry: 36 },
  workers: { cx: 250, cy: 132, rx: 96, ry: 44 },
};

/** Parts of the brood chamber, as fractions of its radii: the queen on the left, eggs and larvae to her right. */
const QUEEN_AT = { x: -0.4, y: 0.1 };
const EGGS_IN = { x: 0.35, y: -0.15, rx: 0.4, ry: 0.45 };
const LARVAE_IN = { x: 0.3, y: 0.35, rx: 0.4, ry: 0.3 };

const round = (n: number): number => Math.round(n * 10) / 10;
const stream = (...keys: string[]): RngStream => keyedStream(...keys.map(hashString));

/** A point inside an ellipse (area-uniform), from one creature's own stream. */
function pointIn(e: Ellipse, rng: RngStream): Token {
  const t = between(rng, 0, 2 * Math.PI);
  const r = Math.sqrt(rng.float());
  return { x: round(e.cx + Math.cos(t) * r * e.rx), y: round(e.cy + Math.sin(t) * r * e.ry), angle: Math.floor(between(rng, 0, 360)) };
}

function tokens(kind: string, count: number, max: number, area: Ellipse): Token[] {
  const n = Math.max(0, Math.min(Math.floor(count), max));
  return Array.from({ length: n }, (_, i) => pointIn(area, keyedStream(hashString(kind), i)));
}

/** A closed, smooth, slightly irregular ellipse (quadratic curves through midpoints). */
function wallPath(id: ChamberId, e: Ellipse): string {
  const rng = stream('wall', id);
  const pts = Array.from({ length: WALL_POINTS }, (_, i) => {
    const t = (i / WALL_POINTS) * 2 * Math.PI;
    const k = 1 - between(rng, 0, WALL_WOBBLE);
    return { x: e.cx + Math.cos(t) * e.rx * k, y: e.cy + Math.sin(t) * e.ry * k };
  });
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(pts[WALL_POINTS - 1], pts[0]);
  let d = `M${round(start.x)} ${round(start.y)}`;
  for (let i = 0; i < WALL_POINTS; i++) {
    const m = mid(pts[i], pts[(i + 1) % WALL_POINTS]);
    d += ` Q${round(pts[i].x)} ${round(pts[i].y)} ${round(m.x)} ${round(m.y)}`;
  }
  return `${d} Z`;
}

function grassPath(): string {
  let d = `M0 ${SURFACE_Y}`;
  for (let x = 0; x < WIDTH; x += GRASS_STEP) {
    d += ` L${x + GRASS_STEP / 2} ${SURFACE_Y - GRASS_BLADE} L${x + GRASS_STEP} ${SURFACE_Y}`;
  }
  return d;
}

function stratumPath(i: number, y: number): string {
  const rng = stream('stratum', String(i));
  let d = `M0 ${y}`;
  for (let x = 0; x < WIDTH; x += STRATA_STEP) {
    d += ` Q${x + STRATA_STEP / 2} ${round(y + between(rng, -STRATA_WAVE, STRATA_WAVE))} ${x + STRATA_STEP} ${y}`;
  }
  return d;
}

function pebbles(): Pebble[] {
  return Array.from({ length: PEBBLES }, (_, i) => {
    const rng = keyedStream(hashString('pebble'), i);
    const rx = round(between(rng, 2, 4));
    return {
      cx: round(between(rng, rx, WIDTH - rx)),
      cy: round(between(rng, SURFACE_Y + 2 * rx, HEIGHT - rx)),
      rx,
      ry: round(rx * between(rng, 0.6, 0.9)),
    };
  });
}

function tunnels(): { id: string; d: string }[] {
  const b = CHAMBERS.brood;
  const w = CHAMBERS.workers;
  const broodTop = { x: b.cx + b.rx * 0.6, y: b.cy - b.ry * 0.6 };
  const workersTop = { x: w.cx - w.rx * 0.45, y: w.cy - w.ry * 0.7 };
  const broodSide = { x: b.cx + b.rx * 0.8, y: b.cy + b.ry * 0.4 };
  const workersSide = { x: w.cx - w.rx * 0.8, y: w.cy - w.ry * 0.2 };
  return [
    { id: 'entrance', d: `M${ENTRANCE_X} ${SURFACE_Y} C${ENTRANCE_X - 2} 34 ${round(broodTop.x + 14)} ${round(broodTop.y - 6)} ${round(broodTop.x)} ${round(broodTop.y)}` },
    { id: 'down', d: `M${ENTRANCE_X} ${SURFACE_Y} C${ENTRANCE_X + 6} 50 ${round(workersTop.x - 4)} ${round(workersTop.y - 20)} ${round(workersTop.x)} ${round(workersTop.y)}` },
    { id: 'between', d: `M${round(broodSide.x)} ${round(broodSide.y)} Q${round((broodSide.x + workersSide.x) / 2)} ${round(workersSide.y + 6)} ${round(workersSide.x)} ${round(workersSide.y)}` },
  ];
}

function part(c: Ellipse, at: { x: number; y: number; rx: number; ry: number }): Ellipse {
  return { cx: c.cx + at.x * c.rx, cy: c.cy + at.y * c.ry, rx: at.rx * c.rx, ry: at.ry * c.ry };
}

function chamber(id: ChamberId): ChamberGeometry {
  const e = CHAMBERS[id];
  return {
    id,
    ...e,
    wall: wallPath(id, e),
    label: { x: e.cx / WIDTH, y: Math.min(1, (e.cy + e.ry + LABEL_GAP) / HEIGHT) },
  };
}

export function nestLayout(view: NestView): NestLayout {
  const brood = CHAMBERS.brood;
  const workers = CHAMBERS.workers;
  return {
    width: WIDTH,
    height: HEIGHT,
    surfaceY: SURFACE_Y,
    grass: grassPath(),
    strata: STRATA_Y.map((y, i) => stratumPath(i, y)),
    pebbles: pebbles(),
    tunnels: tunnels(),
    chambers: [chamber('brood'), chamber('workers')],
    queen: { x: round(brood.cx + QUEEN_AT.x * brood.rx), y: round(brood.cy + QUEEN_AT.y * brood.ry), angle: 0 },
    eggs: tokens('egg', view.eggs, sceneBalance.drawnEggsMax, part(brood, EGGS_IN)),
    larvae: tokens('larva', view.larvae, sceneBalance.drawnLarvaeMax, part(brood, LARVAE_IN)),
    workers: tokens('worker', view.workers, sceneBalance.drawnWorkersMax, { ...workers, rx: workers.rx * INNER, ry: workers.ry * INNER }),
  };
}
