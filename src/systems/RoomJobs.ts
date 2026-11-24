import type { GameState } from '../state/GameState';
import type { RefusalReason } from '../actions/result';
import { roomJobBalance } from '../data/balance/roomJobs';
import { digBalance } from '../data/balance/dig';
import { Phase } from '../phases/phases';
import { roomSpace } from './Crowding';

/**
 * Room jobs (Story 9.14, FR59, FR63). The state keeps counts by job
 * (`roomJobs.jobs`), never more in total than the rooms dug, and how many
 * plain rooms were never assigned (`roomJobs.fresh`): their first job is
 * free. No ant and no room has a location. Pure functions.
 */
export type RoomJobId = keyof typeof roomJobBalance.jobs;
/** A room's job, or `plain` for none. */
export type RoomSlot = RoomJobId | 'plain';

export const ROOM_JOB_IDS = Object.keys(roomJobBalance.jobs) as readonly RoomJobId[];

/** Rooms with a job. */
export function assignedRooms(s: GameState): number {
  return ROOM_JOB_IDS.reduce((n, id) => n + s.roomJobs.jobs[id], 0);
}

/** Rooms with no job (dug rooms minus the ones with a job). */
export function plainRooms(s: GameState): number {
  return Math.max(0, s.dig.roomsDug - assignedRooms(s));
}

/** Rooms with this job, or plain. */
export function roomsWith(s: GameState, slot: RoomSlot): number {
  return slot === 'plain' ? plainRooms(s) : s.roomJobs.jobs[slot];
}

/** The nest capacity a job adds to a room, beyond the room itself. */
function extraCapacity(slot: RoomSlot): number {
  return slot === 'plain' ? 0 : roomJobBalance.jobs[slot].extraRooms * digBalance.roomSize;
}

/** Whether this change is a never-assigned room's first job (free). */
function isFirstJob(s: GameState, from: RoomSlot, to: RoomSlot): boolean {
  return from === 'plain' && to !== 'plain' && s.roomJobs.fresh > 0;
}

/** What changing one room from `from` to `to` costs: nothing for a never-assigned room's first job. */
export function roomJobCost(s: GameState, from: RoomSlot, to: RoomSlot): { readonly stone: number } {
  return { stone: isFirstJob(s, from, to) ? 0 : roomJobBalance.changeCostStone };
}

/** Why one room can't go from `from` to `to` now, or null. */
export function roomJobRefusal(s: GameState, from: RoomSlot, to: RoomSlot): Extract<RefusalReason, 'locked' | 'unavailable' | 'cannot_afford' | 'at_capacity'> | null {
  if (s.phase === Phase.EGG_LAYING) return 'locked';
  if (from === to || roomsWith(s, from) <= 0) return 'unavailable';
  if (s.resources.stone < roomJobCost(s, from, to).stone) return 'cannot_afford';
  // Only a change that takes room away can leave workers without one.
  const lost = extraCapacity(from) - extraCapacity(to);
  if (lost > 0 && s.resources.workers > roomSpace(s) - lost) return 'at_capacity';
  return null;
}

/** Change one room's job from `from` to `to`: the counts, the capacity and the stone. Unchanged when refused. */
export function applyRoomJob(s: GameState, from: RoomSlot, to: RoomSlot): GameState {
  if (roomJobRefusal(s, from, to) !== null) return s;
  const cost = roomJobCost(s, from, to).stone;
  const jobs = { ...s.roomJobs.jobs };
  if (from !== 'plain') jobs[from] -= 1;
  if (to !== 'plain') jobs[to] += 1;
  return {
    ...s,
    roomJobs: { jobs, fresh: isFirstJob(s, from, to) ? s.roomJobs.fresh - 1 : s.roomJobs.fresh },
    resources: {
      ...s.resources,
      stone: s.resources.stone - cost,
      nestCapacity: s.resources.nestCapacity + extraCapacity(to) - extraCapacity(from),
    },
  };
}
