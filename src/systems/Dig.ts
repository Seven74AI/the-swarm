import type { GameState } from '../state/GameState';
import { digBalance } from '../data/balance/dig';
import { getEffects } from './BuildingSystem';

/**
 * DIG (Story 9.2, FR55): the dig state is `state.dig` (`roomsDug`, `progress`
 * in whole dig points toward the current room, `carry`: the diggers' fraction
 * of a point in [0, 1)). Pure functions; they never write the state given.
 */

/** The dig points room number `roomsDug` (from 0) costs: strictly more for every room dug. */
export function roomCost(roomsDug: number): number {
  const n = Math.max(0, Math.floor(roomsDug));
  return Math.floor(digBalance.firstRoomPoints * (1 + digBalance.roomGrowthPerRoom * n)) + n;
}

/** The dig points one press adds: the base plus a share per worker on the DIG role (whole points). */
export function pressChunk(s: GameState): number {
  return digBalance.pressPoints + Math.floor(digBalance.pressPointsPerDigger * s.workersAssigned.dig);
}

/** Dig points the diggers dig a second on their own (Tunnels speed them up, Story 4.7). */
export function diggerPointsPerSec(s: GameState): number {
  const diggers = s.workersAssigned.dig;
  if (diggers <= 0) return 0;
  const speed = 1 + (getEffects('tunnels', s.buildings.tunnels?.level ?? 0).digSpeedBonus ?? 0);
  return diggers * digBalance.diggerPointsPerSec * speed;
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
  return addDigPoints(withStone, chunk);
}
