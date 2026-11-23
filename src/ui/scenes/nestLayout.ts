import type { NestView } from '../../state/nestView';
import { sceneBalance } from '../../data/balance/scene';
import { between, hashString, keyedStream, pick, type RngStream } from '../../utils/rng';

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
 *
 * Story 8.6 (AR14, N1): a chamber whose creatures, all drawn, would cover
 * more than `sceneBalance.cloudCoverage` of its area draws the extras as one
 * dot-cloud path. The worker chamber keeps `cloudAntsMin` to
 * `animatedAntsMax` individual ants on top, and the whole scene never has
 * more than `animatedAntsMax` of them. Every creature is counted once: drawn,
 * or in its chamber's `cloud.count`.
 *
 * Story 8.7 (UX-DR34): the first workers settle near their chamber's door
 * (`DOOR`), so the close camera (`nestCamera.ts`, about `cameraOrigin`) sees a
 * young colony. A starving colony (`view.starving`) draws only
 * `sceneBalance.starvingShown` of its individual workers and of its cloud's
 * dots; the ants it leaves out are `thinned`, and the labels, which come from
 * the view, keep the exact count.
 */

export type ChamberId = 'brood' | 'workers';

/** A creature or the queen: a position and a heading in degrees. */
export interface Token {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** A point in viewBox units. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** An individual worker: where it rests, and how it moves (`ui/scenes/antMotion.ts`). */
export interface Ant extends Token {
  /** The tunnel it walks along and back, or null for an ant swaying in its chamber. */
  readonly tunnel: string | null;
  /** Where in its cycle it starts (0..1), so the ants never move in step. */
  readonly start: number;
}

/** A round-capped tunnel: its path, and the same centre line as a cubic curve from end to end. */
export interface Tunnel {
  readonly id: string;
  readonly d: string;
  readonly curve: readonly [Point, Point, Point, Point];
}

/** A chamber's dot cloud: how many creatures it stands for, and its dots as one path (empty when none). */
export interface Cloud {
  readonly count: number;
  readonly d: string;
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
  /** Its floor area (the `rx`/`ry` ellipse), in square viewBox units. */
  readonly area: number;
  readonly cloud: Cloud;
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
  readonly tunnels: readonly Tunnel[];
  readonly chambers: readonly ChamberGeometry[];
  readonly queen: Token;
  readonly eggs: readonly Token[];
  readonly larvae: readonly Token[];
  readonly workers: readonly Ant[];
  /** Workers a starving colony leaves out of the drawing (0 when fed): drawn + cloud + thinned = all workers. */
  readonly thinned: number;
  /**
   * The rooms dug so far (Story 9.6), in the order they opened, each on a
   * tunnel to the nest above it. `width` × `height` frames them all: the
   * scene's viewBox, so no chamber or room is ever cropped.
   */
  readonly rooms: readonly RoomGeometry[];
  /** Where the next room is being dug (its slot's centre): the crack grows here (Story 9.3). */
  readonly digFace: Point;
}

/** A room dug (Story 9.6): a small chamber of its own, no label, no creatures of its own (no ant has a location). */
export interface RoomGeometry {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly wall: string;
}

// --- Creature shapes (drawn by NestScene; their areas decide when a chamber clouds) ------------

/** Workers are drawn at this scale (with `nestCamera.MIN_STAGE_PX`, never under 12 px long on screen). */
export const ANT_SCALE = 1.5;
/** A worker's abdomen, thorax and head, along its heading, before `ANT_SCALE`. */
export const ANT_BODY = [
  { cx: -3.4, rx: 2.6, ry: 1.7 },
  { cx: 0, rx: 1.6, ry: 1.2 },
  { cx: 2.8, rx: 1.4, ry: 1.4 },
] as const;
/** A drawn worker's length, abdomen to head, in viewBox units. */
export const ANT_LENGTH = (ANT_BODY[2].cx + ANT_BODY[2].rx - (ANT_BODY[0].cx - ANT_BODY[0].rx)) * ANT_SCALE;
/** An egg's outlined oval. */
export const EGG_SHAPE = { rx: 4, ry: 2.8 } as const;
/** A larva's curl and its stroke width (scenes.css draws it at the same width). */
export const LARVA_PATH = 'M-4 2 q4 -8 8 0';
const LARVA_LENGTH = 12;
const LARVA_STROKE = 2.6;

/** The area one drawn worker covers (its body, legs aside), in square viewBox units. */
export const ANT_AREA = Math.PI * ANT_BODY.reduce((sum, e) => sum + e.rx * e.ry, 0) * ANT_SCALE * ANT_SCALE;
/** The area one drawn egg and one drawn larva cover. */
export const BROOD_AREA = { egg: Math.PI * EGG_SHAPE.rx * EGG_SHAPE.ry, larva: LARVA_LENGTH * LARVA_STROKE } as const;

// --- Fixed geometry (layout constants of the drawing, in viewBox units) ------------------------

const WIDTH = 360;
/** The drawing's width in viewBox units. */
export const SCENE_WIDTH = WIDTH;
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
/** The worker chamber's cloud fills this share of its radii. */
const CLOUD_IN = 0.85;
/** A cloud dot's side, in viewBox units (about a pixel at 1×; DESIGN.md: 1–1.5 px). */
const DOT_MIN = 1;
const DOT_MAX = 1.5;

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
/**
 * The worker chamber's door side, as fractions of its radii (inside the ants'
 * area): the first workers settle around it, by the tunnel from the brood.
 */
const DOOR_AT = { x: -0.6, y: -0.35 };
/**
 * The rooms dug (Story 9.6). The first fill the soil under the brood chamber,
 * `UNDER_BROOD` columns by two rows; the rest go in rows of `ROOMS_PER_ROW`
 * below the founding nest, each row deepening the picture by `ROW_STEP`.
 */
const ROOM = { rx: 14, ry: 8 } as const;
const UNDER_BROOD_X = [34, 74, 114] as const;
const UNDER_BROOD_Y = [134, 162] as const;
const DEEP_FIRST_Y = 200;
const ROOMS_PER_ROW = 8;
const ROOM_X0 = 30;
const ROOM_STEP_X = 42;
const ROW_STEP = 24;
/** Soil kept below the deepest room or dig face. */
const BOTTOM_SOIL = 8;

const round = (n: number): number => Math.round(n * 10) / 10;
const stream = (...keys: string[]): RngStream => keyedStream(...keys.map(hashString));

/** A point inside an ellipse (area-uniform), from one creature's own stream. */
function pointIn(e: Ellipse, rng: RngStream): Token {
  const t = between(rng, 0, 2 * Math.PI);
  const r = Math.sqrt(rng.float());
  return { x: round(e.cx + Math.cos(t) * r * e.rx), y: round(e.cy + Math.sin(t) * r * e.ry), angle: Math.floor(between(rng, 0, 360)) };
}

function tokens(kind: string, n: number, area: Ellipse): Token[] {
  return Array.from({ length: n }, (_, i) => pointIn(area, keyedStream(hashString(kind), i)));
}

const whole = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** `n` dots of a cloud as path commands, each placed by `(key, i)` alone, so a growing cloud keeps its dots. */
function cloudDots(key: string, n: number, area: Ellipse): string {
  let d = '';
  const k = hashString(key);
  for (let i = 0; i < n; i++) {
    const rng = keyedStream(k, i);
    const t = between(rng, 0, 2 * Math.PI);
    const r = Math.sqrt(rng.float());
    const size = Math.round(between(rng, DOT_MIN, DOT_MAX) * 10) / 10;
    const x = round(area.cx + Math.cos(t) * r * area.rx - size / 2);
    const y = round(area.cy + Math.sin(t) * r * area.ry - size / 2);
    d += `M${x} ${y}h${size}v${size}h-${size}z`;
  }
  return d;
}

/** How many of `count` creatures, each covering `each`, are drawn one by one in a chamber of `area`. */
const fitting = (area: number, each: number): number => Math.floor((sceneBalance.cloudCoverage * area) / each);

/** A closed, smooth, slightly irregular ellipse (quadratic curves through midpoints). */
function wallPath(id: string, e: Ellipse): string {
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

const cubicPath = (c: Tunnel['curve']): string =>
  `M${round(c[0].x)} ${round(c[0].y)} C${round(c[1].x)} ${round(c[1].y)} ${round(c[2].x)} ${round(c[2].y)} ${round(c[3].x)} ${round(c[3].y)}`;

/** A quadratic curve as the same cubic. */
const fromQuadratic = (a: Point, q: Point, b: Point): Tunnel['curve'] => [
  a,
  { x: a.x + (2 / 3) * (q.x - a.x), y: a.y + (2 / 3) * (q.y - a.y) },
  { x: b.x + (2 / 3) * (q.x - b.x), y: b.y + (2 / 3) * (q.y - b.y) },
  b,
];

function tunnels(): Tunnel[] {
  const b = CHAMBERS.brood;
  const w = CHAMBERS.workers;
  const entrance = { x: ENTRANCE_X, y: SURFACE_Y };
  const broodTop = { x: b.cx + b.rx * 0.6, y: b.cy - b.ry * 0.6 };
  const workersTop = { x: w.cx - w.rx * 0.45, y: w.cy - w.ry * 0.7 };
  const broodSide = { x: b.cx + b.rx * 0.8, y: b.cy + b.ry * 0.4 };
  const workersSide = { x: w.cx - w.rx * 0.8, y: w.cy - w.ry * 0.2 };
  const curves: { id: string; curve: Tunnel['curve'] }[] = [
    { id: 'entrance', curve: [entrance, { x: ENTRANCE_X - 2, y: 34 }, { x: broodTop.x + 14, y: broodTop.y - 6 }, broodTop] },
    { id: 'down', curve: [entrance, { x: ENTRANCE_X + 6, y: 50 }, { x: workersTop.x - 4, y: workersTop.y - 20 }, workersTop] },
    {
      id: 'between',
      curve: fromQuadratic(broodSide, { x: (broodSide.x + workersSide.x) / 2, y: workersSide.y + 6 }, workersSide),
    },
  ];
  return curves.map((t) => ({ ...t, d: cubicPath(t.curve) }));
}

function part(c: Ellipse, at: { x: number; y: number; rx: number; ry: number }): Ellipse {
  return { cx: c.cx + at.x * c.rx, cy: c.cy + at.y * c.ry, rx: at.rx * c.rx, ry: at.ry * c.ry };
}

const areaOf = (e: Ellipse): number => Math.PI * e.rx * e.ry;

function chamber(id: ChamberId, cloud: Cloud, height: number): ChamberGeometry {
  const e = CHAMBERS[id];
  return {
    id,
    ...e,
    wall: wallPath(id, e),
    label: { x: e.cx / WIDTH, y: Math.min(1, (e.cy + e.ry + LABEL_GAP) / height) },
    area: areaOf(e),
    cloud,
  };
}

/**
 * The brood's split: every egg and larva while they fit under the coverage
 * threshold; past it, both are drawn in the same proportion, so the drawn ones
 * just fit, and the rest become the cloud.
 */
function broodSplit(eggs: number, larvae: number): { eggs: number; larvae: number; cloud: Cloud } {
  const budget = sceneBalance.cloudCoverage * areaOf(CHAMBERS.brood);
  const total = eggs * BROOD_AREA.egg + larvae * BROOD_AREA.larva;
  if (total <= budget) return { eggs, larvae, cloud: { count: 0, d: '' } };
  const k = budget / total;
  const drawnEggs = Math.floor(eggs * k);
  const drawnLarvae = Math.floor(larvae * k);
  const eggExtra = eggs - drawnEggs;
  const larvaExtra = larvae - drawnLarvae;
  const extra = eggExtra + larvaExtra;
  // Past the dot cap, the dots are shared in proportion; under it, one dot per creature.
  const eggDots = extra <= sceneBalance.cloudDotsMax ? eggExtra : Math.floor((sceneBalance.cloudDotsMax * eggExtra) / extra);
  const larvaDots = Math.min(larvaExtra, sceneBalance.cloudDotsMax - eggDots);
  const brood = CHAMBERS.brood;
  return {
    eggs: drawnEggs,
    larvae: drawnLarvae,
    cloud: { count: extra, d: cloudDots('cloud-egg', eggDots, part(brood, EGGS_IN)) + cloudDots('cloud-larva', larvaDots, part(brood, LARVAE_IN)) },
  };
}

/**
 * The worker chamber's split: every worker while they fit under the threshold
 * and the animation budget; past either, `cloudAntsMin` to `animatedAntsMax`
 * individual ants (as many as fit under the threshold), the rest the cloud.
 * Starving (Story 8.7), only `starvingShown` of the individual ants (at least
 * one) and of the cloud's dots are drawn; the ants left out are `thinned`.
 */
function workerSplit(workers: number, starving: boolean): { drawn: number; thinned: number; cloud: Cloud } {
  const w = CHAMBERS.workers;
  const fits = fitting(areaOf(w), ANT_AREA);
  const shown = (n: number, least: number) => (starving ? Math.max(least, Math.floor(n * sceneBalance.starvingShown)) : n);
  const full =
    workers <= Math.min(fits, sceneBalance.animatedAntsMax)
      ? workers
      : Math.min(workers, Math.max(sceneBalance.cloudAntsMin, Math.min(fits, sceneBalance.animatedAntsMax)));
  const drawn = Math.min(full, shown(full, 1));
  const count = workers - full;
  const area = { ...w, rx: w.rx * CLOUD_IN, ry: w.ry * CLOUD_IN };
  const dots = shown(Math.min(count, sceneBalance.cloudDotsMax), 0);
  return { drawn, thinned: full - drawn, cloud: { count, d: dots > 0 ? cloudDots('cloud-workers', dots, area) : '' } };
}

/** The dig-face crack's stages (Story 9.3): it shows from the first stage on, one more every equal share of the room. */
export const CRACK_STAGES = 4;

/** The crack's stage (0 = none … `CRACK_STAGES`) for a room `percent` (0–99) done. Pure, never shrinking as the percent grows. */
export function crackStage(percent: number): number {
  const p = Math.max(0, Math.min(99, Math.floor(percent)));
  return Math.min(CRACK_STAGES, Math.floor((p * (CRACK_STAGES + 1)) / 100));
}

/** Each crack stage adds these zig-zag steps (viewBox units), out from the dig face. */
const CRACK_STEPS: readonly Point[] = [
  { x: 4, y: 5 },
  { x: -3, y: 4 },
  { x: 5, y: 4 },
  { x: -2, y: 5 },
];

/** The crack at the dig face `at` for a stage (1 … `CRACK_STAGES`): two more steps a stage; '' at 0. Pure. */
export function crackPath(stage: number, at: Point): string {
  const n = Math.max(0, Math.min(CRACK_STAGES, Math.floor(stage)));
  if (n === 0) return '';
  const steps = Array.from({ length: n * 2 }, (_, i) => CRACK_STEPS[i % CRACK_STEPS.length]);
  return `M${at.x} ${at.y}` + steps.map((s) => ` l${s.x} ${s.y}`).join('');
}

/** Room `i`'s centre (Story 9.6): under the brood first, then row by row below the nest. Fixed, so a room never moves. */
export function roomSlot(i: number): Point {
  const under = UNDER_BROOD_X.length * UNDER_BROOD_Y.length;
  if (i < under) return { x: UNDER_BROOD_X[i % UNDER_BROOD_X.length], y: UNDER_BROOD_Y[Math.floor(i / UNDER_BROOD_X.length)] };
  const k = i - under;
  return { x: ROOM_X0 + (k % ROOMS_PER_ROW) * ROOM_STEP_X, y: DEEP_FIRST_Y + Math.floor(k / ROOMS_PER_ROW) * ROW_STEP };
}

/** Where room `i`'s tunnel starts: the room above it, else the founding chamber above it (Story 9.6). */
function roomParent(i: number): Point {
  const at = roomSlot(i);
  const under = UNDER_BROOD_X.length * UNDER_BROOD_Y.length;
  if (i >= UNDER_BROOD_X.length && i < under) return roomSlot(i - UNDER_BROOD_X.length);
  if (i >= under + ROOMS_PER_ROW) return roomSlot(i - ROOMS_PER_ROW);
  if (i < UNDER_BROOD_X.length) {
    const b = CHAMBERS.brood;
    return { x: at.x, y: round(b.cy + b.ry * 0.85) };
  }
  // The first deep row: under the workers chamber, or under the brood's rooms.
  const w = CHAMBERS.workers;
  if (Math.abs(at.x - w.cx) < w.rx * 0.8) return { x: at.x, y: round(w.cy + w.ry * 0.85) };
  const above = [3, 4, 5].map(roomSlot);
  return above.reduce((best, p) => (Math.abs(p.x - at.x) < Math.abs(best.x - at.x) ? p : best));
}

function rooms(n: number): { rooms: RoomGeometry[]; tunnels: Tunnel[] } {
  const out: RoomGeometry[] = [];
  const ways: Tunnel[] = [];
  for (let i = 0; i < n; i++) {
    const c = roomSlot(i);
    const e = { cx: c.x, cy: c.y, rx: ROOM.rx, ry: ROOM.ry };
    out.push({ index: i, ...e, wall: wallPath(`room-${i}`, e) });
    const from = roomParent(i);
    const curve: Tunnel['curve'] = fromQuadratic(from, { x: (from.x + c.x) / 2 + 3, y: (from.y + c.y) / 2 }, c);
    ways.push({ id: `room-${i}`, curve, d: cubicPath(curve) });
  }
  return { rooms: out, tunnels: ways };
}

/** The frame's height for `n` rooms dug: the founding drawing, deepened to hold every room and the next dig face. */
function frameHeight(n: number): number {
  return Math.max(HEIGHT, roomSlot(n).y + ROOM.ry + BOTTOM_SOIL);
}

/**
 * The narrowest the stage is ever drawn, in CSS px (Story 9.6): there, a
 * drawn worker is still `antMinPx` long (DESIGN.md: never under 12 px). The
 * frame is always `SCENE_WIDTH` wide, so this holds at any room count.
 */
export const MIN_STAGE_PX = Math.ceil((sceneBalance.antMinPx * WIDTH) / ANT_LENGTH);

/** The point the first workers settle around, in viewBox units. */
export const DOOR: Point = {
  x: round(CHAMBERS.workers.cx + DOOR_AT.x * CHAMBERS.workers.rx),
  y: round(CHAMBERS.workers.cy + DOOR_AT.y * CHAMBERS.workers.ry),
};

/**
 * The individual workers: placed by index, every `tunnelWalkerEvery`-th one
 * walking a tunnel. Ant `i` sits on the line from the door to its own point
 * in the chamber, the nearer the door the younger the colony it arrived in,
 * so the first ones gather in view of the close camera. Both ends lie inside
 * the ants' area, and so does every point between them.
 */
function ants(n: number, area: Ellipse, routes: readonly Tunnel[]): Ant[] {
  const place = tokens('worker', n, area).map((t, i) => {
    const k = Math.sqrt(Math.min(1, (i + 1) / sceneBalance.doorFillAnts));
    return { ...t, x: round(DOOR.x + (t.x - DOOR.x) * k), y: round(DOOR.y + (t.y - DOOR.y) * k) };
  });
  const every = sceneBalance.tunnelWalkerEvery;
  return place.map((t, i) => {
    const rng = keyedStream(hashString('worker-motion'), i);
    const start = rng.float();
    const tunnel = i % every === every - 1 ? pick(rng, routes).id : null;
    return { ...t, tunnel, start };
  });
}

export function nestLayout(view: NestView): NestLayout {
  const brood = CHAMBERS.brood;
  const workers = CHAMBERS.workers;
  const b = broodSplit(whole(view.eggs), whole(view.larvae));
  const w = workerSplit(whole(view.workers), view.starving === true);
  const dug = rooms(whole(view.roomsDug ?? 0));
  const routes = tunnels();
  const height = frameHeight(dug.rooms.length);
  const face = roomSlot(dug.rooms.length);
  return {
    width: WIDTH,
    height,
    surfaceY: SURFACE_Y,
    grass: grassPath(),
    strata: STRATA_Y.map((y, i) => stratumPath(i, y)),
    pebbles: pebbles(),
    // Ants walk the founding tunnels only; the rooms' own tunnels are drawn, not walked.
    tunnels: [...routes, ...dug.tunnels],
    chambers: [chamber('brood', b.cloud, height), chamber('workers', w.cloud, height)],
    queen: { x: round(brood.cx + QUEEN_AT.x * brood.rx), y: round(brood.cy + QUEEN_AT.y * brood.ry), angle: 0 },
    eggs: tokens('egg', b.eggs, part(brood, EGGS_IN)),
    larvae: tokens('larva', b.larvae, part(brood, LARVAE_IN)),
    workers: ants(w.drawn, { ...workers, rx: workers.rx * INNER, ry: workers.ry * INNER }, routes),
    thinned: w.thinned,
    rooms: dug.rooms,
    digFace: { x: face.x, y: face.y },
  };
}
