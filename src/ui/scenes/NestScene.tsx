import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { feelBalance } from '../../data/balance/feel';
import type { NestView } from '../../state/nestView';
import { formatFull } from '../../utils/format';
import { Sep } from '../primitives/Deco';
import { ANT_BODY, ANT_SCALE, EGG_SHAPE, LARVA_PATH, MIN_STAGE_PX, crackPath, nestLayout, type Ant, type ChamberGeometry, type ChamberId, type Token, type Tunnel } from './nestLayout';
import { antPose } from './antMotion';
import { sceneClock, useSceneClock, type SceneClock } from './sceneClock';
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
 * Story 8.6 (AR14): a crowded chamber draws its extras as one dot-cloud
 * path (`[data-scene-part="cloud"]`, faded by a radial gradient on the phase
 * accent), under at most `sceneBalance.animatedAntsMax` individual ants. The
 * ants move on the shared scene clock: each frame sets their `transform`
 * directly, so a frame re-renders nothing; a re-render (at most 4 times a
 * second, when the view changes) draws them at the clock's current time.
 * They sit in a second SVG over the first, on its own compositor layer, so a
 * frame repaints the ants alone and not the soil, the tunnels and the cloud.
 *
 * Game feel (Story 8.9, UX-DR37): a creature that arrives after the first
 * draw is wrapped in `[data-arrive=<kind>]`, fixed at its mount: an egg
 * appears beside the queen, a larva after it, a worker walks into its chamber
 * (a one-off CSS animation over `feelBalance.arriveMs` on the wrapper, so no
 * frame re-renders and the ants' own per-frame transform is untouched; none
 * under reduced motion). Only drawn creatures arrive: the cloud and the
 * 50-ant budget are unchanged.
 *
 * Story 9.6 (FR59, UX-DR34): the scene draws only the rooms dug so far
 * (`view.roomsDug`), and its viewBox is the layout's frame, which holds the
 * whole dug nest: the stage takes the frame's aspect, so nothing is ever
 * cropped, and a drawn worker is never under `antMinPx` (`MIN_STAGE_PX`).
 * This replaced Story 8.7's camera steps. A room that opens after the first
 * draw arrives (`[data-arrive="room"]`): dirt falls and its wall appears over
 * `feelBalance.roomOpenMs`, none under reduced motion. A larva that arrives breaks
 * out of an egg shell (`hatch-shell`, faded out by scenes.css). A starving
 * colony (`view.starving`, `[data-starving]`) draws fewer ants; the labels
 * keep the exact counts.
 *
 * Hooks: `[data-scene="nest"]` (`[data-starving]`), `svg [data-scene-part]`, `button[data-chamber]`,
 * `[data-arrive]`, `[data-rooms]`, `svg [data-scene-part="room"][data-room]`.
 */

export interface NestSceneProps {
  readonly view: NestView;
  readonly onChamber: (id: ChamberId) => void;
  /** The clock the ants move on (the shared scene clock unless a test hands in its own). */
  readonly clock?: SceneClock;
  /** The dig-face crack's stage (Story 9.3, `crackStage`): 0 or absent draws none. It never animates. */
  readonly crack?: number;
  /**
   * FEED (Story 9.4): from Colony on the brood button feeds instead of peeking.
   * It is named "Feed the brood", and while `blocked` it is disabled with its reason
   * (`FEED · NEST FULL`). Absent: the brood button peeks (Phase 1).
   */
  readonly feed?: { readonly blocked: string | null } | null;
  /**
   * Story 9.7 (FR1): from Colony on, the queen is LAY EGG. The container hands
   * its control in, and the scene anchors it on the queen (`[data-queen-tap]`).
   */
  readonly queen?: ComponentChildren;
}

type ArriveKind = 'egg' | 'larva' | 'worker' | 'room';

/**
 * Marks a creature as arriving if it first draws after the scene's first draw; the mark is fixed at mount.
 * `extra` is drawn beside an arriving creature only (Story 8.7: the shell a hatching larva leaves).
 */
function Arrival({ kind, live, children, extra }: { kind: ArriveKind; live: boolean; children: ComponentChildren; extra?: ComponentChildren }) {
  const [arriving] = useState(live);
  return arriving ? (
    <>
      {extra}
      <g data-arrive={kind} class={`nest-svg__arrive nest-svg__arrive--${kind}`}>
        {children}
      </g>
    </>
  ) : (
    <>{children}</>
  );
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
export function chamberAriaLabel(id: ChamberId, v: NestView, feeds = false): string {
  if (id !== 'brood') return `Workers: ${v.workers}`;
  return `${feeds ? 'Feed the brood' : 'Brood'}: ${count(v.eggs, 'egg', 'eggs')}, ${count(v.larvae, 'larva', 'larvae')}`;
}

/** "3 EGGS", "1 LARVA": the exact count, then the word. */
const shown = (n: number, one: string, many: string): string => `${formatFull(n)} ${n === 1 ? one : many}`;

function ChamberText({ id, view, feeds = false }: { id: ChamberId; view: NestView; feeds?: boolean }) {
  return id === 'brood' ? (
    <>
      {feeds ? 'FEED THE BROOD' : 'BROOD'}
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

function ChamberButton({
  chamber,
  anchor,
  view,
  onChamber,
  feed,
}: {
  chamber: ChamberGeometry;
  anchor: { x: number; y: number };
  view: NestView;
  onChamber: (id: ChamberId) => void;
  feed?: { readonly blocked: string | null } | null;
}) {
  const feeds = chamber.id === 'brood' && !!feed;
  const blocked = feeds ? feed!.blocked : null;
  // Anchored at its chamber, and shifted by the same share of its own size, so it never leaves the scene.
  const x = `${(anchor.x * 100).toFixed(1)}%`;
  const y = `${(anchor.y * 100).toFixed(1)}%`;
  return (
    <button
      type="button"
      class="nest-chamber"
      data-chamber={chamber.id}
      data-feeds={feeds ? '' : undefined}
      aria-label={blocked ? `${chamberAriaLabel(chamber.id, view, feeds)}. Feed: ${blocked.toLowerCase()}` : chamberAriaLabel(chamber.id, view, feeds)}
      aria-disabled={blocked ? 'true' : undefined}
      style={{ left: x, top: y, transform: `translate(-${x}, -${y})` }}
      onClick={() => {
        if (!blocked) onChamber(chamber.id);
      }}
    >
      <span class="nest-chamber__plate">
        <ChamberText id={chamber.id} view={view} feeds={feeds} />
        {blocked && ' '}
        {blocked && (
          <span class="nest-chamber__reason" data-feed-reason="">
            FEED
            <Sep />
            {blocked}
          </span>
        )}
      </span>
    </button>
  );
}

const at = (t: Token) => `translate(${t.x} ${t.y}) rotate(${t.angle})`;
const antAt = (t: Token) => `${at(t)} scale(${ANT_SCALE})`;

/** The individual workers, moved every frame by the scene clock without a render. */
function Ants({ ants, tunnels, clock, live }: { ants: readonly Ant[]; tunnels: readonly Tunnel[]; clock: SceneClock; live: boolean }) {
  const nodes = useRef<(SVGGElement | null)[]>([]);
  useSceneClock((t) => {
    for (let i = 0; i < ants.length; i++) nodes.current[i]?.setAttribute('transform', antAt(antPose(ants[i], tunnels, t)));
  }, clock);
  const now = clock.now();
  return (
    <>
      {ants.map((a, i) => (
        <Arrival key={i} kind="worker" live={live}>
        <g
          ref={(el) => {
            nodes.current[i] = el;
          }}
          data-scene-part="worker"
          class="nest-svg__creature"
          transform={antAt(antPose(a, tunnels, now))}
        >
          {ANT_BODY.map((e, j) => (
            <ellipse key={j} cx={e.cx} rx={e.rx} ry={e.ry} />
          ))}
          <path class="nest-svg__legs" d="M-1 -1 l-1.5 -2.5 M0 -1 l0.5 -3 M1 -1 l2 -2.2 M-1 1 l-1.5 2.5 M0 1 l0.5 3 M1 1 l2 2.2" />
        </g>
        </Arrival>
      ))}
    </>
  );
}

/** The queen's own control (Story 9.7), anchored on her and kept inside the stage like a chamber label. */
function QueenTap({ at, children }: { at: { x: number; y: number }; children: ComponentChildren }) {
  const x = `${(at.x * 100).toFixed(1)}%`;
  const y = `${(at.y * 100).toFixed(1)}%`;
  return (
    <div class="nest-queen-tap" data-queen-tap="" style={{ left: x, top: y, transform: `translate(-${x}, -${y})` }}>
      {children}
    </div>
  );
}

/** The dirt a room's opening shakes loose (Story 9.6): a few crumbs that fall once, drawn only beside an arriving room. */
function Dirt({ x, y }: { x: number; y: number }) {
  return (
    <g data-scene-part="dirt" class="nest-svg__dirt">
      {[-8, -3, 2, 7].map((dx, i) => (
        <circle key={i} cx={x + dx} cy={y - 6 + (i % 2) * 2} r={1.1} />
      ))}
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

export function NestScene({ view, onChamber, clock = sceneClock(), crack = 0, feed = null, queen }: NestSceneProps) {
  const layout = useMemo(() => nestLayout(view), [view]);
  // False during the first draw: what is there when the scene opens doesn't arrive.
  const drawn = useRef(false);
  useEffect(() => {
    drawn.current = true;
  }, []);
  const live = drawn.current;
  const soilH = layout.height - layout.surfaceY;
  return (
    <div class="nest-scene-view" data-scene="nest" data-starving={view.starving ? '' : undefined} role="group" aria-label={nestAriaLabel(view)}>
      <div
        class="nest-stage"
        data-crt-surface=""
        data-rooms={String(layout.rooms.length)}
        style={{
          '--arrive-ms': `${feelBalance.arriveMs}ms`,
          '--room-open-ms': `${feelBalance.roomOpenMs}ms`,
          '--frame-w': String(layout.width),
          '--frame-h': String(layout.height),
          minWidth: `${MIN_STAGE_PX}px`,
        }}
      >
        <div class="nest-camera">
        <svg class="nest-svg" data-line-work="" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
          <defs>
            <pattern id="nest-grain" width={14} height={12} patternUnits="userSpaceOnUse">
              <circle class="nest-svg__grain-dot" cx={2} cy={3} r={0.8} />
              <circle class="nest-svg__grain-dot" cx={9} cy={8} r={0.6} />
              <circle class="nest-svg__grain-dot" cx={5} cy={10} r={0.7} />
            </pattern>
            <radialGradient id="nest-cloud-fade">
              <stop class="nest-svg__cloud-core" offset="0" />
              <stop class="nest-svg__cloud-edge" offset="1" />
            </radialGradient>
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
          {layout.rooms.map((r) => (
            <Arrival key={r.index} kind="room" live={live} extra={<Dirt x={r.cx} y={r.cy} />}>
              <path data-scene-part="room" data-room={String(r.index)} class="nest-svg__chamber nest-svg__room" d={r.wall} />
            </Arrival>
          ))}
          {crack > 0 && <path data-scene-part="crack" data-crack-stage={String(crack)} class="nest-svg__crack" stroke-linecap="round" d={crackPath(crack, layout.digFace)} />}
          {layout.chambers.map((c) =>
            c.cloud.d ? <path key={c.id} data-scene-part="cloud" data-cloud={c.id} class="nest-svg__cloud" d={c.cloud.d} /> : null,
          )}
          {layout.eggs.map((t, i) => (
            <Arrival key={i} kind="egg" live={live}>
              <ellipse data-scene-part="egg" class="nest-svg__egg" rx={EGG_SHAPE.rx} ry={EGG_SHAPE.ry} transform={at(t)} />
            </Arrival>
          ))}
          {layout.larvae.map((t, i) => (
            <Arrival
              key={i}
              kind="larva"
              live={live}
              extra={<ellipse data-scene-part="hatch-shell" class="nest-svg__hatch-shell" rx={EGG_SHAPE.rx} ry={EGG_SHAPE.ry} transform={at(t)} />}
            >
              <path data-scene-part="larva" class="nest-svg__larva" stroke-linecap="round" d={LARVA_PATH} transform={at(t)} />
            </Arrival>
          ))}
          <Queen t={layout.queen} />
        </svg>
        {/* The moving ants on a layer of their own: a frame repaints only them, never the soil and the cloud. */}
        <svg class="nest-svg nest-svg--ants" data-line-work="" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
          <Ants ants={layout.workers} tunnels={layout.tunnels} clock={clock} live={live} />
        </svg>
        </div>
        {layout.chambers.map((c) => (
          <ChamberButton key={c.id} chamber={c} anchor={c.label} view={view} onChamber={onChamber} feed={feed} />
        ))}
        {queen && <QueenTap at={{ x: layout.queen.x / layout.width, y: layout.queen.y / layout.height }}>{queen}</QueenTap>}
      </div>
    </div>
  );
}
