import { useMemo } from 'preact/hooks';
import type { NestView } from '../../state/nestView';
import { formatFull } from '../../utils/format';
import { Sep } from '../primitives/Deco';
import { nestLayout, type ChamberGeometry, type ChamberId, type Token } from './nestLayout';
import './scenes.css';

/**
 * The nest scene (Story 8.5; FR44, AR14, UX-DR34, N1): the colony as a
 * cross-section of countable creatures.
 *
 * A dumb view: it gets the colony as `view` (from `selectNestView`, read at
 * most 4 times a second by its container), lays it out with the pure
 * `nestLayout` and draws it. It never reads the game state and never writes
 * anything (tests/arch/sceneBoundary.test.ts); a chamber press only asks its
 * container to open that chamber (`onChamber`).
 *
 * The drawing is decoration (`aria-hidden`), colored only through the
 * phase's `--color-*` tokens in scenes.css: no paint attribute in this file
 * (one nest scene is on screen, so the grain pattern's id is fixed). The numbers are HTML: the root is
 * a group labelled with its counts, and each chamber's label is a button
 * with that chamber's exact counts, from the view, never from the drawn ants.
 *
 * Hooks: `[data-scene="nest"]`, `svg [data-scene-part]`, `button[data-chamber]`.
 */

export interface NestSceneProps {
  readonly view: NestView;
  readonly onChamber: (id: ChamberId) => void;
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "Nest: 37 workers, 5 eggs, 4 larvae" (UX-DR34). */
export function nestAriaLabel(v: NestView): string {
  return `Nest: ${count(v.workers, 'worker', 'workers')}, ${count(v.eggs, 'egg', 'eggs')}, ${count(v.larvae, 'larva', 'larvae')}`;
}

/**
 * A chamber button's name: its visible label in words ("Brood: 3 eggs, 2
 * larvae"), so the name holds what is shown (WCAG 2.5.3) without reading `·`.
 */
export function chamberAriaLabel(id: ChamberId, v: NestView): string {
  return id === 'brood' ? `Brood: ${count(v.eggs, 'egg', 'eggs')}, ${count(v.larvae, 'larva', 'larvae')}` : `Workers: ${v.workers}`;
}

/** "3 EGGS", "1 LARVA": the exact count, then the word. */
const shown = (n: number, one: string, many: string): string => `${formatFull(n)} ${n === 1 ? one : many}`;

function ChamberText({ id, view }: { id: ChamberId; view: NestView }) {
  return id === 'brood' ? (
    <>
      BROOD
      <Sep />
      {shown(view.eggs, 'EGG', 'EGGS')}
      <Sep />
      {shown(view.larvae, 'LARVA', 'LARVAE')}
    </>
  ) : (
    <>
      WORKERS
      <Sep />
      {formatFull(view.workers)}
    </>
  );
}

function ChamberButton({ chamber, view, onChamber }: { chamber: ChamberGeometry; view: NestView; onChamber: (id: ChamberId) => void }) {
  // Anchored at its chamber, and shifted by the same share of its own size, so it never leaves the scene.
  const x = `${(chamber.label.x * 100).toFixed(1)}%`;
  const y = `${(chamber.label.y * 100).toFixed(1)}%`;
  return (
    <button
      type="button"
      class="nest-chamber"
      data-chamber={chamber.id}
      aria-label={chamberAriaLabel(chamber.id, view)}
      style={{ left: x, top: y, transform: `translate(-${x}, -${y})` }}
      onClick={() => onChamber(chamber.id)}
    >
      <span class="nest-chamber__plate">
        <ChamberText id={chamber.id} view={view} />
      </span>
    </button>
  );
}

const at = (t: Token) => `translate(${t.x} ${t.y}) rotate(${t.angle})`;
/** Workers are drawn at this scale, so one is never under 12 px long on a phone (DESIGN.md). */
const ANT_SCALE = 1.4;

/** A worker: abdomen, thorax, head, along its heading. */
function Ant({ t }: { t: Token }) {
  return (
    <g data-scene-part="worker" class="nest-svg__creature" transform={`${at(t)} scale(${ANT_SCALE})`}>
      <ellipse cx={-3.4} rx={2.6} ry={1.7} />
      <ellipse rx={1.6} ry={1.2} />
      <circle cx={2.8} r={1.4} />
      <path class="nest-svg__legs" d="M-1 -1 l-1.5 -2.5 M0 -1 l0.5 -3 M1 -1 l2 -2.2 M-1 1 l-1.5 2.5 M0 1 l0.5 3 M1 1 l2 2.2" />
    </g>
  );
}

/** The queen: abdomen, thorax, head, six legs and antennae. */
function Queen({ t }: { t: Token }) {
  return (
    <g data-scene-part="queen" class="nest-svg__creature" transform={at(t)}>
      <ellipse cx={-17} rx={13} ry={7.5} />
      <ellipse cx={-2} rx={5} ry={3.6} />
      <circle cx={8} r={4.2} />
      <path class="nest-svg__legs" d="M11 -2 q6 -7 11 -6 M11 2 q6 7 11 6" />
      <path class="nest-svg__legs" d="M-4 -3 l-5 -8 l-6 -3 M-1 -3 l1 -9 l4 -4 M2 -3 l6 -7 l6 0 M-4 3 l-5 8 l-6 3 M-1 3 l1 9 l4 4 M2 3 l6 7 l6 0" />
    </g>
  );
}

export function NestScene({ view, onChamber }: NestSceneProps) {
  const layout = useMemo(() => nestLayout(view), [view]);
  const soilH = layout.height - layout.surfaceY;
  return (
    <div class="nest-scene-view" data-scene="nest" role="group" aria-label={nestAriaLabel(view)}>
      <div class="nest-stage" data-crt-surface="">
        <svg class="nest-svg" data-line-work="" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
          <defs>
            <pattern id="nest-grain" width={14} height={12} patternUnits="userSpaceOnUse">
              <circle class="nest-svg__grain-dot" cx={2} cy={3} r={0.8} />
              <circle class="nest-svg__grain-dot" cx={9} cy={8} r={0.6} />
              <circle class="nest-svg__grain-dot" cx={5} cy={10} r={0.7} />
            </pattern>
          </defs>
          <rect data-scene-part="soil" class="nest-svg__soil" x={0} y={layout.surfaceY} width={layout.width} height={soilH} />
          <rect data-scene-part="grain" class="nest-svg__grain" x={0} y={layout.surfaceY} width={layout.width} height={soilH} />
          <g data-scene-part="strata" class="nest-svg__strata">
            {layout.strata.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          {layout.pebbles.map((p, i) => (
            <ellipse key={i} data-scene-part="pebble" class="nest-svg__pebble" cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />
          ))}
          <path data-scene-part="grass" class="nest-svg__grass" d={layout.grass} />
          <g data-scene-part="tunnel">
            {layout.tunnels.map((t) => (
              <path key={`${t.id}-wall`} class="nest-svg__tunnel-wall" stroke-linecap="round" d={t.d} />
            ))}
            {layout.tunnels.map((t) => (
              <path key={`${t.id}-carved`} class="nest-svg__tunnel" stroke-linecap="round" d={t.d} />
            ))}
          </g>
          {layout.chambers.map((c) => (
            <path key={c.id} data-scene-part="chamber" data-chamber-wall={c.id} class="nest-svg__chamber" d={c.wall} />
          ))}
          {layout.eggs.map((t, i) => (
            <ellipse key={i} data-scene-part="egg" class="nest-svg__egg" rx={4} ry={2.8} transform={at(t)} />
          ))}
          {layout.larvae.map((t, i) => (
            <path key={i} data-scene-part="larva" class="nest-svg__larva" stroke-linecap="round" d="M-4 2 q4 -8 8 0" transform={at(t)} />
          ))}
          <Queen t={layout.queen} />
          {layout.workers.map((t, i) => (
            <Ant key={i} t={t} />
          ))}
        </svg>
        {layout.chambers.map((c) => (
          <ChamberButton key={c.id} chamber={c} view={view} onChamber={onChamber} />
        ))}
      </div>
    </div>
  );
}
