import type { RoomJobId, RoomSlot } from '../../systems/RoomJobs';

export type { RoomJobId, RoomSlot };

/** A room job's copy (Story 9.14): its name, and what it does in a few words. */
export interface RoomJobCopy {
  readonly id: RoomJobId;
  readonly label: string;
  readonly hint: string;
}

/** The room jobs in the order the choice lists them. */
export const ROOM_JOBS: readonly RoomJobCopy[] = [{ id: 'gallery', label: 'GALLERY', hint: 'HOLDS TWICE AS MANY ANTS' }];

/** A room with no job. */
export const PLAIN_ROOM = { label: 'PLAIN', hint: 'NO JOB' } as const;

/** Why a room's job can't change (Story 9.14): the refusals `setRoomJob` gives, in words. */
export const ROOM_JOB_REFUSALS = {
  locked: 'LOCKED',
  unavailable: 'NO SUCH ROOM',
  cannot_afford: 'NOT ENOUGH STONE',
  at_capacity: 'WORKERS WOULD HAVE NO ROOM',
} as const;
export type RoomJobRefusal = keyof typeof ROOM_JOB_REFUSALS;
