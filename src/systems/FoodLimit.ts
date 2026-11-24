import type { GameState } from '../state/GameState';
import { foodLimitBalance } from '../data/balance/foodLimit';
import { roomJobBalance } from '../data/balance/roomJobs';
import { ROOM_JOB_IDS } from './RoomJobs';

/**
 * The food store's limit (Story 9.15, FR62): the base, plus a share for every
 * room dug, plus each job's `foodLimit` (the Larder's) per room with it. It
 * never falls as rooms are dug. Pure; whole food.
 */
export function getFoodLimit(s: GameState): number {
  let limit = foodLimitBalance.base + foodLimitBalance.perRoom * Math.max(0, s.dig.roomsDug);
  for (const id of ROOM_JOB_IDS) limit += roomJobBalance.jobs[id].foodLimit * Math.max(0, s.roomJobs.jobs[id] ?? 0);
  return Math.floor(limit);
}

/**
 * Food after a step that would take it from `before` to `after`, at `limit`:
 * income stops at the limit and the rest is lost; a store already over the
 * limit keeps its food (only new income is lost), and a falling store falls.
 */
export function capFood(before: number, after: number, limit: number): { readonly food: number; readonly lost: number } {
  if (after <= before || after <= limit) return { food: after, lost: 0 };
  const kept = Math.max(before, limit);
  return { food: kept, lost: after - kept };
}
