import { selectRoomJobs, selectRoomsDug } from '../../state/selectors';
import { ROOM_JOBS } from '../../data/content/roomJobs';
import { formatFull } from '../../utils/format';
import { Sep } from '../primitives/Deco';
import { Button } from '../primitives/Button';
import type { SheetController } from '../shell/SheetController';
import { openRoomJobs, type RoomJobActions } from '../sheets/RoomJobSheet';
import './nest.css';

/**
 * NEST's room jobs line (Story 9.14, FR59): once a room is dug,
 * `<n> PLAIN ROOMS · <n> GALLERY` and `ROOMS`, which opens the room jobs
 * sheet to assign or change them.
 *
 * Hooks: `[data-room-jobs]`, `[data-room-jobs-assign]`.
 */
export function RoomJobsLine({ sheets, actions }: { sheets: SheetController; actions: RoomJobActions }) {
  const dug = selectRoomsDug.value;
  const jobs = selectRoomJobs.value.jobs;
  if (dug <= 0) return null;
  const assigned = ROOM_JOBS.reduce((n, j) => n + jobs[j.id], 0);
  const plain = Math.max(0, dug - assigned);
  return (
    <div class="room-jobs-line" data-room-jobs="">
      <span class="room-jobs-line__counts">
        {`${formatFull(plain)} PLAIN ${plain === 1 ? 'ROOM' : 'ROOMS'}`}
        {ROOM_JOBS.map((j) => (
          <span key={j.id}>
            <Sep />
            {`${formatFull(jobs[j.id])} ${j.label}`}
          </span>
        ))}
      </span>
      <Button verb="ROOMS" data-room-jobs-assign="" onPress={() => void openRoomJobs(sheets, actions)} />
    </div>
  );
}
