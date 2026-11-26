import { signal, type ReadonlySignal } from '@preact/signals';
import {
  selectCombatResources,
  selectEffectiveNestCapacity, selectFoodLimit,
  selectFoodProductionPerSec,
  selectFoodUpkeepPerSec,
  selectPhase,
  selectResources,
  selectStats,
} from '../../state/selectors';
import { Phase, PHASE_ORDER } from '../../phases/phases';
import { RESOURCES, STRIP_SETS, type ResourceId } from './resourceCatalog';
import { sheetBalance } from '../../data/balance/sheet';
import { sparkline } from '../../utils/format';
import { foodLineNet } from './foodLine';

/**
 * The resource feed (Story 1.16; UX-DR7, UX-DR8).
 *
 * One sampler shared by the resource strip and the resource sheet. While anyone
 * retains it, it reads the state every `REFRESH_MS` and publishes a snapshot, so
 * both refresh at most 4 times a second however fast the game ticks.
 *
 * Rates are measured, not modelled: the change of each amount over the last
 * `RATE_WINDOW_MS` of GAME time (`stats.playTimeMs`), per second, truncated to a
 * whole number. Measuring works the same for every resource (pipelines, loot,
 * conversions), counts consumption, and stays right across offline catch-up,
 * because catch-up advances game time too. A pause adds no game time, so the
 * window (and the rates) hold still until the game runs again.
 *
 * One exception (#494): food is clamped at 0, so while the colony starves the
 * store stops moving and a measured rate reads 0. Then food's rate is the net
 * WRKR shows (`foodLineNet`), at least one whole unit a second, so the strip
 * reads falling and never disagrees with WRKR's sign.
 */

/** Strip and sheet refresh period: at most 4 updates a second. */
export const REFRESH_MS = 250;
/** Game time the rate is measured over. */
export const RATE_WINDOW_MS = 4000;
/** Cells in a full strip. */
export const STRIP_CELLS = 5;

export interface ResourceRow {
  readonly id: ResourceId;
  /** Integer amount held. */
  readonly amount: number;
  /** Whole units per second over the rate window (negative while falling). */
  readonly rate: number;
  /**
   * The rate per second, not rounded (Story 9.10): over the rate window when
   * that moves a whole unit a second, else over the sparkline's longer history,
   * so a slow resource still shows its pace.
   */
  readonly ratePerSec: number;
  /** The last `sheetBalance.sparkWindowMs` of the amount as a text sparkline (Story 9.10); '' until there are two samples. */
  readonly spark: string;
  /** Storage cap, or `null` when the resource has none. */
  readonly cap: number | null;
  readonly capped: boolean;
  /** Reached by this phase, or held already. */
  readonly unlocked: boolean;
}

export interface ResourceSnapshot {
  readonly phase: Phase;
  /** Every resource, in catalog order. */
  readonly rows: readonly ResourceRow[];
}

export interface ResourceFeed {
  readonly snapshot: ReadonlySignal<ResourceSnapshot>;
  /** Read the state now and publish a new snapshot. */
  sample(): void;
  /** Keep sampling every `REFRESH_MS`; returns the release. Readers share one timer. */
  retain(): () => void;
  /** Counts `flash()` calls: the strip flashes its deltas once per change (Story 2.9). */
  readonly flashes: ReadonlySignal<number>;
  /** A short return (under 60 s, UX-DR43): sample now and flash the strip's deltas once. */
  flash(): void;
}

interface Sample {
  readonly atMs: number;
  readonly amounts: Readonly<Record<ResourceId, number>>;
}

function phaseOf(value: string): Phase {
  return (PHASE_ORDER as string[]).includes(value) ? (value as Phase) : Phase.EGG_LAYING;
}

function readSample(): Sample {
  const r = selectResources.peek();
  const c = selectCombatResources.peek();
  const amounts = {} as Record<ResourceId, number>;
  for (const def of RESOURCES) {
    const store = (def.store === 'resources' ? r : c) as unknown as Record<string, number | undefined>;
    const raw = store[def.id] ?? 0;
    amounts[def.id] = Number.isFinite(raw) ? Math.floor(raw) : 0;
  }
  return { atMs: selectStats.peek().playTimeMs, amounts };
}

export function createResourceFeed(opts: { windowMs?: number; intervalMs?: number } = {}): ResourceFeed {
  const windowMs = opts.windowMs ?? RATE_WINDOW_MS;
  const intervalMs = Math.max(REFRESH_MS, opts.intervalMs ?? REFRESH_MS);
  let history: Sample[] = [];
  /** The sparkline's history (Story 9.10): one sample per cell of game time, fixed size, never saved. */
  let long: Sample[] = [];
  const sparkStepMs = Math.floor(sheetBalance.sparkWindowMs / sheetBalance.sparkCells);
  let lastPhase = -1;

  function build(): ResourceSnapshot {
    const now = readSample();
    const phase = phaseOf(selectPhase.peek());
    const phaseIdx = PHASE_ORDER.indexOf(phase);
    const newest = history[history.length - 1];
    // A new run, a loaded save or a prestige: the old samples say nothing about now.
    if (!newest || now.atMs < newest.atMs || phaseIdx < lastPhase) {
      history = [];
      long = [];
    }
    lastPhase = phaseIdx;
    if (history.length === 0 || now.atMs > history[history.length - 1].atMs) {
      history.push(now);
    } else {
      // Same game time (paused, or a tap between ticks): the latest amounts replace the last sample.
      history[history.length - 1] = now;
    }
    // Keep the window, plus the newest sample older than it as the baseline.
    const from = now.atMs - windowMs;
    let firstInside = history.findIndex((s) => s.atMs >= from);
    if (firstInside < 0) firstInside = history.length - 1;
    history = history.slice(Math.max(0, firstInside - 1));
    const base = history[0];
    const dt = now.atMs - base.atMs;

    // The sparkline's samples: one per step of game time, at most `sparkCells` kept.
    if (long.length === 0 || now.atMs - long[long.length - 1].atMs >= sparkStepMs) {
      long.push(now);
      if (long.length > sheetBalance.sparkCells) long = long.slice(long.length - sheetBalance.sparkCells);
    }
    const oldest = long[0];
    const longDt = now.atMs - oldest.atMs;

    const cap = selectEffectiveNestCapacity.peek();
    const foodLimit = selectFoodLimit.peek();
    // Held at 0 by the clamp while more is eaten than made: the net, not the (still) store.
    const starvingNet = now.amounts.food <= 0 ? foodLineNet(selectFoodProductionPerSec.peek(), selectFoodUpkeepPerSec.peek()) : 0;
    const rows = RESOURCES.map((def): ResourceRow => {
      const amount = now.amounts[def.id];
      const shortPerSec = dt > 0 ? ((amount - base.amounts[def.id]) * 1000) / dt : 0;
      const longPerSec = longDt > dt ? ((amount - oldest.amounts[def.id]) * 1000) / longDt : shortPerSec;
      const clamped = def.id === 'food' && starvingNet < 0;
      const measured = dt > 0 ? Math.trunc(((amount - base.amounts[def.id]) * 1000) / dt) : 0;
      const rate = clamped ? Math.min(-1, Math.trunc(starvingNet)) : measured;
      const ratePerSec = clamped ? starvingNet : rate !== 0 ? shortPerSec : longPerSec;
      const series = [...long.map((s) => s.amounts[def.id]), ...(long[long.length - 1] === now ? [] : [amount])];
      // Workers stop at the nest capacity; food at the food limit (Story 9.15).
      const rowCap = def.id === 'workers' ? Math.floor(cap) : def.id === 'food' ? foodLimit : null;
      return {
        id: def.id,
        amount,
        rate: rate === 0 ? 0 : rate, // no -0
        ratePerSec: ratePerSec === 0 ? 0 : ratePerSec,
        spark: series.length >= 2 ? sparkline(series) : '',
        cap: rowCap,
        capped: rowCap !== null && amount >= rowCap,
        unlocked: phaseIdx >= PHASE_ORDER.indexOf(def.unlockPhase) || amount > 0,
      };
    });
    return { phase, rows };
  }

  const snapshot = signal<ResourceSnapshot>(build());
  const flashes = signal(0);
  let holders = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const feed: ResourceFeed = {
    snapshot,
    flashes,
    sample() {
      snapshot.value = build();
    },
    flash() {
      feed.sample();
      flashes.value++;
    },
    retain() {
      holders++;
      if (timer === null) {
        feed.sample();
        timer = setInterval(() => feed.sample(), intervalMs);
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holders--;
        if (holders === 0 && timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
  return feed;
}

/**
 * Capped or falling: the resources that need a look first. A full food store
 * (Story 9.15) reads capped where it is shown, but does not jump ahead: unlike
 * a full nest or a falling stock, nothing worsens while it waits.
 */
export function needsAttention(row: ResourceRow): boolean {
  return (row.capped && row.id !== 'food') || row.rate < 0;
}

/**
 * The strip's cells, at most `count`, never a locked resource.
 * Phases 1 and 2 show their set as is; from Phase 3, and whenever the strip is
 * narrowed to fewer cells, capped or falling resources come first.
 */
export function stripCells(snapshot: ResourceSnapshot, count: number = STRIP_CELLS): ResourceId[] {
  const byId = new Map(snapshot.rows.map((r) => [r.id, r]));
  const base = STRIP_SETS[snapshot.phase].filter((id) => byId.get(id)?.unlocked);
  const alertsFirst = count < STRIP_CELLS || PHASE_ORDER.indexOf(snapshot.phase) >= PHASE_ORDER.indexOf(Phase.COMBAT);
  if (!alertsFirst) return base.slice(0, count);
  const alerts = [
    ...base.filter((id) => needsAttention(byId.get(id)!)),
    ...snapshot.rows.filter((r) => r.unlocked && needsAttention(r) && !base.includes(r.id)).map((r) => r.id),
  ];
  const ordered = [...alerts, ...base.filter((id) => !alerts.includes(id))];
  return ordered.slice(0, count);
}
