import type { GameState } from '../state/GameState';
import { VERDICT_COPY, VERDICT_ORDER, type VerdictFix, type VerdictKind } from '../data/content/verdicts';

export type { VerdictFix };
import { freeWorkers, moveWorkers, netFoodPerSec, roleCount, type MoveSource } from './Workforce';
import { nextActionBalance } from '../data/balance/nextAction';
import { getFoodLimit } from './FoodLimit';
import { ROOM_JOB_IDS, roomJobRefusal, type RoomJobId } from './RoomJobs';
import { freeRooms } from './Brood';
import { deathIntervalMs, getSettlesAt, isStarvingNow } from './Starvation';
import { formatFull, formatTime } from '../utils/format';
import { MS_PER_SEC } from '../data/constants';

/**
 * The resource sheet's first line (Story 9.11, FR66, UX-DR50): the worst
 * current state, first match wins in `VERDICT_ORDER`. Pure, no DOM.
 *
 * - `food`: food is falling; `runwayMs` is how long the store lasts at the
 *   current net rate (the rates the simulation runs at).
 * - `nest`: the nest is full and larvae wait for a room.
 * - `growing`: neither.
 */
export type Verdict =
  | { readonly kind: 'starving'; readonly deathEveryMs: number; readonly fix: VerdictFix; readonly warn: true }
  | { readonly kind: 'food'; readonly runwayMs: number; readonly fix: VerdictFix; readonly warn: true }
  | { readonly kind: 'limit'; readonly fix: VerdictFix | null; readonly warn: true }
  | { readonly kind: 'nest'; readonly larvae: number; readonly warn: true }
  | { readonly kind: 'growing'; readonly warn: false };

const SOURCES: readonly MoveSource[] = ['free', 'tend', 'forage', 'dig', 'guard'];

/** Whether some room could take `job` now (a plain room, or one with another job). */
function roomCanTake(s: GameState, job: RoomJobId): boolean {
  return (['plain', ...ROOM_JOB_IDS] as const).some((from) => roomJobRefusal(s, from, job) === null);
}

/** Whether every worker WRKR can move (free ones, every job, guards above the minimum) put on GATHER would stop the fall. */
function gatherHelps(s: GameState): boolean {
  let all = s;
  for (const from of SOURCES) {
    const n = from === 'free' ? freeWorkers(all) : from === 'guard' ? Math.max(0, roleCount(all, from) - nextActionBalance.minGuards) : roleCount(all, from);
    if (n > 0) all = moveWorkers(all, from, 'gather', n);
  }
  return netFoodPerSec(all) >= 0;
}

function hungerFix(s: GameState): VerdictFix {
  return !gatherHelps(s) && roomCanTake(s, 'pantry') ? 'room_jobs' : 'gather';
}

function check(s: GameState, kind: VerdictKind): Verdict | null {
  switch (kind) {
    case 'starving':
      return isStarvingNow(s) ? { kind, deathEveryMs: deathIntervalMs(s), fix: hungerFix(s), warn: true } : null;
    case 'food': {
      const net = netFoodPerSec(s);
      if (net >= 0) return null;
      return { kind, runwayMs: Math.max(0, Math.ceil((s.resources.food / -net) * MS_PER_SEC)), fix: hungerFix(s), warn: true };
    }
    case 'limit':
      // A full store (Story 9.15) while food still comes in (nothing is lost at a standstill): a Larder holds
      // more; with none possible, no screen fixes it (the tap opens NEST).
      return s.resources.food >= getFoodLimit(s) && netFoodPerSec(s) > 0 ? { kind, fix: roomCanTake(s, 'larder') ? 'room_jobs' : null, warn: true } : null;
    case 'nest': {
      const larvae = Math.floor(s.resources.larvae);
      return freeRooms(s) <= 0 && larvae > 0 ? { kind, larvae, warn: true } : null;
    }
    case 'growing':
      return { kind, warn: false };
  }
}

export function getVerdict(s: GameState): Verdict {
  for (const kind of VERDICT_ORDER) {
    const v = check(s, kind);
    if (v) return v;
  }
  return { kind: 'growing', warn: false };
}

/** The verdict as the sheet prints it. */
export function verdictText(v: Verdict): string {
  switch (v.kind) {
    case 'starving':
      return VERDICT_COPY.starving(formatTime(v.deathEveryMs).toUpperCase());
    case 'food':
      return v.runwayMs > 0 ? VERDICT_COPY.foodLasts(formatTime(v.runwayMs).toUpperCase()) : VERDICT_COPY.foodGone;
    case 'limit':
      return VERDICT_COPY.atLimit;
    case 'nest':
      return VERDICT_COPY.nestFull(formatFull(v.larvae));
    case 'growing':
      return VERDICT_COPY.growing;
  }
}

/**
 * The line under a starving or falling verdict (Story 9.17):
 * `IF NOTHING CHANGES: SETTLES AT <n> WORKERS.` from `getSettlesAt`; null for
 * every other verdict.
 */
export function settlesText(v: Verdict, s: GameState): string | null {
  if (v.kind !== 'starving' && v.kind !== 'food') return null;
  const settle = getSettlesAt(s);
  // Gatherers never starve: if no death would stop the fall, the colony settles nowhere, and the line says nothing.
  return settle.netFoodPerSec >= 0 ? VERDICT_COPY.settles(formatFull(settle.workers)) : null;
}
