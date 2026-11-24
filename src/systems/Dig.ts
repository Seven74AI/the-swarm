import type { GameState } from '../state/GameState';
import { digBalance } from '../data/balance/dig';
import { getEffects } from './BuildingSystem';
import { MS_PER_SEC, PERCENT } from '../data/constants';
import { automationBalance } from '../data/balance/automation';
import { Phase } from '../phases/phases';
import { crowdedPercent, getCrowding } from './Crowding';

/**
 * DIG (Story 9.2, FR55): the dig state is `state.dig` (`roomsDug`, `progress`
 * in whole dig points toward the current room, `carry`: the diggers' fraction
 * of a point in [0, 1)). Pure functions; they never write the state given.
 */

/** The dig points room number `roomsDug` (from 0) costs: strictly more for every room dug. */
export function roomCost(roomsDug: number): number {
  const n = Math.max(0, Math.floor(roomsDug));
  const past = Math.max(0, n - digBalance.steepFromRoom);
  return Math.floor(digBalance.firstRoomPoints * (1 + digBalance.roomGrowthPerRoom * n + digBalance.roomGrowthSquared * past * past)) + n;
}

/**
 * The dig points one press adds: the base plus a share per worker on the DIG
 * role (whole points). Crowding (Story 9.13) slows the diggers' share, never
 * the press's own points: tapping stays a boost.
 */
export function pressChunk(s: GameState): number {
  return digBalance.pressPoints + Math.floor(digBalance.pressPointsPerDigger * s.workersAssigned.dig * getCrowding(s).multiplier);
}

/** Dig points the diggers dig a second on their own (Tunnels speed them up, Story 4.7; crowding slows them, Story 9.13). */
export function diggerPointsPerSec(s: GameState): number {
  const diggers = s.workersAssigned.dig;
  if (diggers <= 0) return 0;
  const speed = 1 + (getEffects('tunnels', s.buildings.tunnels?.level ?? 0).digSpeedBonus ?? 0);
  return diggers * digBalance.diggerPointsPerSec * speed * getCrowding(s).multiplier;
}

/** Dig points auto-dig presses a second (Story 9.5): `pressesPerSec` chunks, once bought, while anyone is on DIG. */
export function autoDigPointsPerSec(s: GameState): number {
  if (!s.dig.auto || s.workersAssigned.dig <= 0) return 0;
  return automationBalance.autoDig.pressesPerSec * pressChunk(s);
}

/** Everything that digs on its own a second: the diggers, plus auto-dig's presses. */
export function digRate(s: GameState): number {
  return diggerPointsPerSec(s) + autoDigPointsPerSec(s);
}

/** Auto-dig's price (Story 9.5): stone only. */
export function getAutoDigCost(): { readonly stone: number } {
  return { stone: automationBalance.autoDig.costStone };
}

/** The auto-dig card is on sale: from Colony on, after enough rooms by hand, until bought. */
export function isAutoDigOpen(s: GameState): boolean {
  return s.phase !== Phase.EGG_LAYING && !s.dig.auto && s.dig.roomsByHand >= automationBalance.autoDig.unlockAfterRoomsByHand;
}

export function canBuyAutoDig(s: GameState): boolean {
  return isAutoDigOpen(s) && s.resources.stone >= getAutoDigCost().stone;
}

/** Buy auto-dig: the stone goes, the diggers dig on. Unchanged when it can't be bought. */
export function buyAutoDig(s: GameState): GameState {
  if (!canBuyAutoDig(s)) return s;
  return { ...s, resources: { ...s.resources, stone: s.resources.stone - getAutoDigCost().stone }, dig: { ...s.dig, auto: true } };
}

/** Every dig point dug so far (each room's cost, the progress and the carry), for comparisons. */
export function digPoints(s: GameState): number {
  let total = s.dig.progress + s.dig.carry;
  for (let n = 0; n < s.dig.roomsDug; n++) total += roomCost(n);
  return total;
}

/**
 * Add `points` whole dig points: each room whose cost is reached opens (the
 * nest holds `roomSize` more), and what is left carries over to the next.
 */
export function addDigPoints(s: GameState, points: number): GameState {
  const whole = Math.max(0, Math.floor(points));
  if (whole === 0) return s;
  let progress = s.dig.progress + whole;
  let roomsDug = s.dig.roomsDug;
  let opened = 0;
  while (progress >= roomCost(roomsDug)) {
    progress -= roomCost(roomsDug);
    roomsDug += 1;
    opened += 1;
  }
  return {
    ...s,
    dig: { ...s.dig, progress, roomsDug },
    // Every room opens plain and never assigned (Story 9.14).
    roomJobs: opened > 0 ? { ...s.roomJobs, fresh: s.roomJobs.fresh + opened } : s.roomJobs,
    resources: opened > 0 ? { ...s.resources, nestCapacity: s.resources.nestCapacity + opened * digBalance.roomSize } : s.resources,
  };
}

/** One DIG press: its chunk of dig points, and the stone for the dirt dug (whole stone, the fraction kept). */
export function digPress(s: GameState): GameState {
  const chunk = pressChunk(s);
  const exact = s.resourceRemainder.stone + chunk / digBalance.pointsPerStone;
  const stone = Math.floor(exact);
  const withStone: GameState = {
    ...s,
    resources: { ...s.resources, stone: s.resources.stone + stone },
    resourceRemainder: { ...s.resourceRemainder, stone: exact - stone },
  };
  const dug = addDigPoints(withStone, chunk);
  // Rooms this press opened count as opened by hand (Story 9.5).
  const opened = dug.dig.roomsDug - s.dig.roomsDug;
  return opened > 0 ? { ...dug, dig: { ...dug.dig, roomsByHand: dug.dig.roomsByHand + opened } } : dug;
}

/** How close the next room is (Story 9.3, FR56): what the NEXT ROOM strip shows. */
export interface NextRoom {
  /** The nest capacity the room adds. */
  readonly size: number;
  /** Whole points dug toward it, and its cost. */
  readonly progress: number;
  readonly cost: number;
  /** Whole share done, floored: 0–99 while the room is still closed. */
  readonly percent: number;
  /** DIG presses left at the current chunk. */
  readonly presses: number;
  /** Time left at the diggers' own rate, auto-dig included (the one `ResourceSystem` digs at); null with no diggers. */
  readonly timeLeftMs: number | null;
  /** Auto-dig is on (Story 9.5): the strip reads `NEXT ROOM · AUTO-DIG ON`. */
  readonly auto: boolean;
  /** The work crowding costs as a whole percent, or null while the creatures fit (Story 9.13: `CROWDED · −<n>% WORK`). */
  readonly crowdedPercent: number | null;
}

/** The next room, from the same rules the dig system uses. Pure. */
export function nextRoom(s: GameState): NextRoom {
  const cost = roomCost(s.dig.roomsDug);
  const progress = Math.min(s.dig.progress, cost);
  const left = cost - progress;
  const rate = digRate(s);
  return {
    size: digBalance.roomSize,
    progress,
    cost,
    percent: Math.min(PERCENT - 1, Math.floor((progress * PERCENT) / cost)),
    presses: Math.max(1, Math.ceil(left / pressChunk(s))),
    timeLeftMs: rate > 0 ? Math.ceil((Math.max(0, left - s.dig.carry) / rate) * MS_PER_SEC) : null,
    auto: s.dig.auto,
    crowdedPercent: crowdedPercent(s),
  };
}
