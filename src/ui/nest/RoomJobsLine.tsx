import { selectRoomJobRows, selectRoomsDug } from '../../state/selectors';
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
  const rows = selectRoomJobRows.value;
  if (dug <= 0) return null;
  const plain = rows.plain;
  return (
    <div class="room-jobs-line" data-room-jobs="">
      <span class="room-jobs-line__counts">
        {`${formatFull(plain)} PLAIN ${plain === 1 ? 'ROOM' : 'ROOMS'}`}
        {rows.jobs.map((r) => (
          <span key={r.id}>
            <Sep />
            {`${formatFull(r.rooms)} ${ROOM_JOBS.find((j) => j.id === r.id)?.label ?? r.id.toUpperCase()}`}
          </span>
        ))}
      </span>
      <Button verb="ROOMS" data-room-jobs-assign="" onPress={() => void openRoomJobs(sheets, actions)} />
    </div>
  );
}
