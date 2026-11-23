import type { GameState } from '../state/GameState';
import { VERDICT_COPY, VERDICT_ORDER, type VerdictKind } from '../data/content/verdicts';
import { netFoodPerSec } from './Workforce';
import { freeRooms } from './Brood';
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
  | { readonly kind: 'food'; readonly runwayMs: number; readonly warn: true }
  | { readonly kind: 'nest'; readonly larvae: number; readonly warn: true }
  | { readonly kind: 'growing'; readonly warn: false };

function check(s: GameState, kind: VerdictKind): Verdict | null {
  switch (kind) {
    case 'food': {
      const net = netFoodPerSec(s);
      if (net >= 0) return null;
      return { kind, runwayMs: Math.max(0, Math.ceil((s.resources.food / -net) * MS_PER_SEC)), warn: true };
    }
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
    case 'food':
      return v.runwayMs > 0 ? VERDICT_COPY.foodLasts(formatTime(v.runwayMs).toUpperCase()) : VERDICT_COPY.foodGone;
    case 'nest':
      return VERDICT_COPY.nestFull(formatFull(v.larvae));
    case 'growing':
      return VERDICT_COPY.growing;
  }
}
