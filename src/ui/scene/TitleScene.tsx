import type { JSX } from 'preact';
import { TITLE_BEATS as B } from '../../data/content/titleCinematic';

/**
 * The title cinematic's vector scene (Story 8.10, UX-DR28; DESIGN.md: "vector
 * scene, terminal UI"; `mockups/title-cinematic.html`).
 *
 * A pure drawing of one moment, `ms` from the start: the same moment always
 * draws the same picture. It reads no game state and rolls no dice (the
 * colony's places come from a fixed sequence). Everything is drawn in
 * `currentColor` and the `--color-bg` alias, so it takes the palette of the
 * surface it sits on (the cinematic pins Phase 1 amber). It is decoration: the
 * cinematic's lines tell the story in words. As line-work it takes the CRT
 * glow (Story 8.4, `[data-line-work]`).
 *
 * The story: the queen drops onto the grass, tunnels down and the first
 * chamber opens; an egg; the colony swarms through new chambers; the soil
 * clears and the ants march up to the title; on the title frame a file of
 * ants walks along the grass.
 * Hooks: `[data-scene="title"]`, `[data-scene-soil]`, `[data-scene-tunnel][data-dug]`,
 * `[data-scene-chamber][data-open]`, `[data-scene-queen]`, `[data-scene-ant]`.
 */

const W = 360;
const H = 720;
/** The grass line and the bottom of the soil. */
const TOP = 150;
const BOT = 590;
/** The ground line of the title frame. */
const GROUND = 560;

type Pt = readonly [number, number];

/** The queen's tunnel, from the grass down to the first chamber. */
const TUNNEL: readonly Pt[] = [
  [178, TOP],
  [174, 200],
  [152, 236],
  [142, 280],
  [134, 316],
  [128, 330],
];
/** Chambers: centre and radii. The first one is the brood chamber. */
const CHAMBERS: readonly (readonly [number, number, number, number])[] = [
  [124, 348, 62, 24],
  [246, 394, 46, 19],
  [62, 428, 42, 17],
  [262, 266, 38, 15],
  [176, 468, 46, 16],
];
const LINKS: readonly string[] = [
  'M150 352 C190 360 215 380 236 390',
  'M100 356 C86 380 74 400 68 420',
  'M150 248 C190 250 230 258 248 264',
  'M140 368 C150 400 165 440 172 460',
];
/** Where the queen rests in the brood chamber, and the first egg beside her. */
const QUEEN_REST: Pt = [104, 348];
const EGG: Pt = [140, 350];

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const ease = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const span = (ms: number, from: number, to: number): number => clamp01((ms - from) / (to - from));
const fix = (n: number): string => n.toFixed(1);

/** A fixed sequence in [0, 1): the same picture every time (no Math.random). */
function sequence(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const chamberOpen = (ms: number, i: number): number =>
  i === 0
    ? span(ms, B.chamberStartMs, B.chamberStartMs + B.chamberOpenMs)
    : span(ms, B.swarmStartMs + i * B.chamberStaggerMs, B.swarmStartMs + i * B.chamberStaggerMs + B.chamberOpenMs);
const linkDug = (ms: number, i: number): number =>
  span(ms, B.swarmStartMs + i * B.chamberStaggerMs, B.swarmStartMs + (i + 2) * B.chamberStaggerMs);

/** The colony's places in the chambers (brood chamber first), fixed. */
const SLOTS: readonly (readonly [number, number, number])[] = (() => {
  const rnd = sequence(99);
  const out: [number, number, number, number][] = [];
  CHAMBERS.forEach(([x, y, rx, ry], ci) => {
    const n = ci === 0 ? 48 : 28;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.8;
      const sx = x + Math.cos(a) * r * (rx - 6);
      const sy = y + Math.sin(a) * r * (ry - 5);
      const order = rnd();
      // Leave the queen and the first egg room.
      if (ci === 0 && Math.abs(sx - QUEEN_REST[0]) < 24 && Math.abs(sy - QUEEN_REST[1]) < 10) continue;
      out.push([sx, sy, ci, order]);
    }
  });
  out.sort((a, b) => (a[2] - b[2]) * 0.6 + (a[3] - b[3]));
  return out.map(([x, y, ci]) => [x, y, ci] as const);
})();

/** The soil: a faint fill, strata, pebbles and a grass edge. Fixed. */
const SOIL = (() => {
  const rnd = sequence(7);
  const strata: string[] = [];
  for (let i = 0; i < 7; i++) {
    const y = TOP + 40 + i * 58;
    let d = `M0 ${y}`;
    for (let x = 0; x <= W; x += 30) d += ` Q${x + 15} ${fix(y + (rnd() - 0.5) * 14)} ${x + 30} ${fix(y + (rnd() - 0.5) * 6)}`;
    strata.push(d);
  }
  const pebbles: (readonly [number, number, number])[] = [];
  for (let i = 0; i < 22; i++) pebbles.push([rnd() * W, TOP + 20 + rnd() * (BOT - TOP - 30), 2 + rnd() * 5]);
  return { strata, pebbles, grass: grassLine(TOP) };
})();

function grassLine(y: number): string {
  let g = `M0 ${y}`;
  for (let x = 0; x <= W; x += 6) g += ` L${x} ${y - (x % 18 === 0 ? 7 : x % 12 === 0 ? 4 : 1)} L${x + 3} ${y}`;
  return g;
}

/** A point `k` of the way along a polyline, with its heading in degrees. */
function along(points: readonly Pt[], k: number): { x: number; y: number; deg: number } {
  const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let left = clamp01(k) * total;
  for (let i = 0; i < lens.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    if (left <= lens[i] || i === lens.length - 1) {
      const t = lens[i] === 0 ? 0 : Math.min(1, left / lens[i]);
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, deg: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
    }
    left -= lens[i];
  }
  const [x, y] = points[points.length - 1];
  return { x, y, deg: 90 };
}

const pathOf = (points: readonly Pt[]): string => points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

function Queen({ x, y, deg, scale }: { x: number; y: number; deg: number; scale: number }) {
  return (
    <g data-scene-queen="" transform={`translate(${fix(x)} ${fix(y)}) rotate(${Math.round(deg)}) scale(${scale})`} fill="currentColor" stroke="currentColor" stroke-linecap="round">
      <ellipse cx="-17" rx="13" ry="7.5" />
      <ellipse cx="-2" rx="5" ry="3.6" />
      <circle cx="8" r="4.2" />
      <path d="M11 -2 q6 -7 11 -6 M11 2 q6 7 11 6" fill="none" stroke-width="1.3" />
      <path d="M-4 -3 l-5 -8 l-6 -3 M-1 -3 l1 -9 l4 -4 M2 -3 l6 -7 l6 0 M-4 3 l-5 8 l-6 3 M-1 3 l1 9 l4 4 M2 3 l6 7 l6 0" fill="none" stroke-width="1.2" />
      <path d="M-24 -5 q4 2 0 9 M-19 -6 q4 3 0 12 M-14 -6 q4 3 0 12" fill="none" style={{ stroke: 'var(--color-bg)' }} stroke-width="0.9" stroke-opacity="0.6" />
    </g>
  );
}

function Ant({ x, y, deg, opacity }: { x: number; y: number; deg: number; opacity?: number }) {
  return (
    <g data-scene-ant="" transform={`translate(${fix(x)} ${fix(y)}) rotate(${Math.round(deg)})`} fill="currentColor" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity={opacity === undefined ? undefined : opacity.toFixed(2)}>
      <ellipse cx="-3.6" rx="2.6" ry="1.7" />
      <ellipse rx="1.3" ry="1" />
      <circle cx="2.4" r="1.3" />
      <path d="M-1 -1 l-1.5 -2.5 M0 -1 l0 -3 M1 -1 l1.5 -2.5 M-1 1 l-1.5 2.5 M0 1 l0 3 M1 1 l1.5 2.5 M3.4 -.6 l2 -1.6 M3.4 .6 l2 1.6" fill="none" />
    </g>
  );
}

const Egg = ({ x, y }: { x: number; y: number }) => <ellipse data-scene-brood="" cx={fix(x)} cy={fix(y)} rx="3" ry="2.1" fill="none" stroke="currentColor" stroke-width="1.1" />;
const Larva = ({ x, y }: { x: number; y: number }) => (
  <path data-scene-brood="" d={`M${fix(x - 3)} ${fix(y + 1)} q3 -6 6 0`} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
);

/** A dug passage: a wall stroke with the background carved inside it, drawn `dug` of the way. */
function Passage({ d, dug, wall, hollow, hook }: { d: string; dug: number; wall: number; hollow: number; hook?: boolean }) {
  const dash = { strokeDasharray: '1 1', strokeDashoffset: String(1 - dug) };
  return (
    <g data-scene-tunnel={hook ? '' : undefined} data-dug={hook ? dug.toFixed(3) : undefined}>
      <path d={d} pathLength={1} fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width={wall} stroke-linecap="round" style={dash} />
      <path d={d} pathLength={1} fill="none" stroke-width={hollow} stroke-linecap="round" style={{ ...dash, stroke: 'var(--color-bg)' }} />
    </g>
  );
}

export function TitleScene({ ms, class: extra }: { readonly ms: number; readonly class?: string }) {
  const title = ms >= B.titleMs;
  const fade = title ? 0 : 1 - span(ms, B.marchStartMs, B.marchStartMs + (B.titleMs - B.marchStartMs) * 0.6);
  const tunnel = span(ms, B.tunnelStartMs, B.tunnelEndMs);

  // The queen: dropping, tunnelling, resting in the brood chamber.
  let queen: { x: number; y: number; deg: number; scale: number } | null = null;
  if (!title && ms >= B.landStartMs && ms < B.tunnelStartMs) {
    const d = span(ms, B.landStartMs, B.landEndMs);
    queen = { x: TUNNEL[0][0], y: TOP - 60 + d * 52, deg: 0, scale: 1 };
  } else if (!title && ms >= B.tunnelStartMs && ms < B.tunnelEndMs) {
    const p = along(TUNNEL, Math.max(0.02, tunnel));
    queen = { ...p, scale: 0.75 };
  } else if (!title && ms >= B.tunnelEndMs) {
    queen = { x: QUEEN_REST[0], y: QUEEN_REST[1], deg: 0, scale: 1 };
  }

  // The colony: grows while it swarms, then marches up to the title.
  const colony: JSX.Element[] = [];
  if (!title && ms >= B.swarmStartMs && ms < B.marchStartMs) {
    const p = span(ms, B.swarmStartMs, B.marchStartMs);
    const n = Math.floor(Math.pow(p, 1.3) * SLOTS.length);
    for (let i = 0; i < n; i++) {
      const [x, y, ci] = SLOTS[i];
      if (chamberOpen(ms, ci) < 0.6) continue;
      if (i % 11 === 0) colony.push(<Egg key={i} x={x} y={y} />);
      else if (i % 7 === 0) colony.push(<Larva key={i} x={x} y={y} />);
      else colony.push(<Ant key={i} x={x + Math.sin(ms / 420 + i) * 2.2} y={y} deg={(i * 47 + (ms / 25) * (i % 3 ? 1 : -1)) % 360} />);
    }
  } else if (!title && ms >= B.marchStartMs) {
    const p = ease(span(ms, B.marchStartMs, B.titleMs));
    const marchers = SLOTS.slice(0, 64);
    marchers.forEach(([sx, sy], i) => {
      const tx = 70 + (i % 16) * 14;
      const ty = 200 + Math.floor(i / 16) * 16;
      const d = clamp01(p * 1.4 - (i % 17) * 0.02);
      colony.push(<Ant key={i} x={sx + (tx - sx) * d} y={sy + (ty - sy) * d} deg={(Math.atan2(ty - sy, tx - sx) * 180) / Math.PI} opacity={1 - d * 0.85} />);
    });
  }

  // The title frame: a file of ants walks along the grass.
  const file: JSX.Element[] = [];
  if (title) {
    const off = ((ms - B.titleMs) / 30) % 420;
    for (let i = 0; i < 12; i++) file.push(<Ant key={i} x={((i * 35 + off) % 420) - 30} y={GROUND - 6} deg={0} />);
  }

  return (
    <svg
      class={extra ? `title-scene ${extra}` : 'title-scene'}
      data-scene="title"
      data-line-work=""
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g data-scene-soil="" opacity={fade.toFixed(3)}>
        <rect x="0" y={TOP} width={W} height={BOT - TOP} fill="currentColor" fill-opacity="0.07" />
        {SOIL.strata.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="currentColor" stroke-opacity="0.13" />
        ))}
        {SOIL.pebbles.map(([x, y, r], i) => (
          <ellipse key={i} cx={fix(x)} cy={fix(y)} rx={fix(r)} ry={fix(r * 0.7)} fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-opacity="0.3" />
        ))}
        <path d={SOIL.grass} fill="none" stroke="currentColor" stroke-opacity="0.75" stroke-width="1.1" />
        <Passage d={pathOf(TUNNEL)} dug={tunnel} wall={17} hollow={14} hook />
        {LINKS.map((d, i) => (
          <Passage key={i} d={d} dug={linkDug(ms, i)} wall={13} hollow={10} />
        ))}
        {CHAMBERS.map(([x, y, rx, ry], i) => {
          const k = ease(chamberOpen(ms, i));
          return (
            <g key={i} data-scene-chamber="" data-open={k.toFixed(3)} transform={`translate(${x} ${y}) scale(${k.toFixed(3)})`}>
              <ellipse rx={rx + 1.5} ry={ry + 1.5} stroke="currentColor" stroke-opacity="0.55" stroke-width="2" style={{ fill: 'var(--color-bg)' }} />
              <ellipse rx={rx - 4} ry={ry - 3} fill="none" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="2 4" />
            </g>
          );
        })}
        {!title && ms >= B.eggMs && <Egg x={EGG[0]} y={EGG[1]} />}
        {queen && <Queen {...queen} />}
      </g>
      {colony}
      {title && (
        <g data-scene-ground="">
          <path d={grassLine(GROUND)} fill="none" stroke="currentColor" stroke-opacity="0.7" />
          <line x1="0" y1={GROUND} x2={W} y2={GROUND} stroke="currentColor" stroke-opacity="0.5" />
        </g>
      )}
      {file}
    </svg>
  );
}
