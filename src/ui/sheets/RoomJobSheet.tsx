import type { SheetController } from '../shell/SheetController';
import { PeekSheet } from '../shell/Sheet';
import { Button } from '../primitives/Button';
import { selectRoomJobRows, type RoomJobChange } from '../../state/selectors';
import { digBalance } from '../../data/balance/dig';
import { PLAIN_ROOM, ROOM_JOBS, ROOM_JOB_REFUSALS, type RoomSlot } from '../../data/content/roomJobs';
import { formatFull } from '../../utils/format';
import type { ActionResult } from '../../actions';
import './RoomJobSheet.css';

/** What the room-job sheets call: `actions.setRoomJob`. */
export interface RoomJobActions {
  setRoomJob(from: RoomSlot, to: RoomSlot): ActionResult;
}

/**
 * The room-opened choice (Story 9.14, FR59): a peek, never a modal, so it
 * never blocks DIG, FEED or CONTINUE. `ROOM OPENED.` with one tap for a job
 * (the room's first job is free) or PLAIN; closing it or doing nothing leaves
 * the room plain. The jobs come from `data/content/roomJobs.ts`.
 *
 * Hooks: `[data-room-job-choice]`, `[data-room-job-pick="<job>|plain"]`.
 */
function RoomJobChoice({ actions, close }: { actions: RoomJobActions; close: () => void }) {
  return (
    <PeekSheet header="ROOM OPENED." data-room-job-choice="">
      <p class="room-jobs__line">{`+${digBalance.roomSize} ROOM. GIVE IT A JOB?`}</p>
      <div class="room-jobs__picks">
        {ROOM_JOBS.map((job) => (
          <Button
            key={job.id}
            verb={job.label}
            cost={job.hint}
            data-room-job-pick={job.id}
            onPress={() => {
              const r = actions.setRoomJob('plain', job.id);
              if (r.ok) close();
              return r;
            }}
          />
        ))}
        <Button verb={PLAIN_ROOM.label} cost={PLAIN_ROOM.hint} data-room-job-pick="plain" onPress={close} />
      </div>
    </PeekSheet>
  );
}

/** Open the room-opened choice; returns its sheet id. */
export function openRoomJobChoice(sheets: SheetController, actions: RoomJobActions): number {
  return sheets.open({ priority: 'peek', render: (close) => <RoomJobChoice actions={actions} close={close} /> });
}

const costLine = (c: RoomJobChange): string => (c.stone === 0 ? 'FREE' : `${formatFull(c.stone)} STONE`);
const refusal = (c: RoomJobChange): string | false => (c.refused ? ROOM_JOB_REFUSALS[c.refused] : false);

/**
 * The room jobs sheet (Story 9.14): every job with its rooms, a way to give a
 * plain room the job and to take it back. A change costs stone, except a
 * never-assigned room's first job; refusals say why on the button.
 *
 * Hooks: `[data-room-jobs-sheet]`, `[data-room-job-row="<job>"]`,
 * `[data-room-job-add="<job>"]`, `[data-room-job-remove="<job>"]`.
 */
function RoomJobsSheet({ actions }: { actions: RoomJobActions }) {
  const rows = selectRoomJobRows.value;
  return (
    <PeekSheet header="ROOMS" data-room-jobs-sheet="">
      <p class="room-jobs__line">{`${formatFull(rows.plain)} PLAIN`}</p>
      {rows.jobs.map((row) => {
        const job = ROOM_JOBS.find((j) => j.id === row.id)!;
        return (
          <div key={row.id} class="room-jobs__row" data-room-job-row={row.id}>
            <p class="room-jobs__line">{`${job.label} ${formatFull(row.rooms)} · ${job.hint}`}</p>
            <Button verb="ASSIGN" target={job.label} disabled={refusal(row.add)} cost={costLine(row.add)} data-room-job-add={row.id} onPress={() => actions.setRoomJob('plain', row.id)} />
            <Button verb="CLEAR" target={job.label} disabled={refusal(row.remove)} cost={costLine(row.remove)} data-room-job-remove={row.id} onPress={() => actions.setRoomJob(row.id, 'plain')} />
          </div>
        );
      })}
    </PeekSheet>
  );
}

/** Open the room jobs sheet; returns its sheet id. */
export function openRoomJobs(sheets: SheetController, actions: RoomJobActions): number {
  return sheets.open({ priority: 'peek', render: () => <RoomJobsSheet actions={actions} /> });
}
