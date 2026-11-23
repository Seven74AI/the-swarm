import { selectNextRoom } from '../../state/selectors';
import { sceneBalance } from '../../data/balance/scene';
import { useThrottledSignal } from '../primitives/throttledSignal';
import { Meter } from '../primitives/Meter';
import { Sep } from '../primitives/Deco';
import { formatTime } from '../../utils/format';
import './nest.css';

/**
 * The NEXT ROOM strip (Story 9.3, FR56, UX-DR47): under the nest scene from
 * Colony on, `NEXT ROOM  +5 [ ██████ ············ ] IN 4M 3S · 13 DIGS`. The
 * time is the diggers' own rate (`nextRoom`, the dig system's rule); with no
 * diggers it reads `NO DIGGERS`. It reads `selectNextRoom` at most 4 times a
 * second (`sceneBalance.viewRefreshMs`).
 *
 * Hooks: `[data-next-room]`, `[data-next-room-time]`, `[data-next-room-digs]`.
 */
export function NextRoomStrip() {
  const room = useThrottledSignal(selectNextRoom, sceneBalance.viewRefreshMs).value;
  if (!room) return null;
  const time = room.timeLeftMs === null ? 'NO DIGGERS' : `IN ${formatTime(room.timeLeftMs).toUpperCase()}`;
  const digs = `${room.presses} ${room.presses === 1 ? 'DIG' : 'DIGS'}`;
  return (
    <div class="next-room" data-next-room="" data-auto-dig={room.auto ? 'on' : 'off'}>
      <span class="next-room__label">
        NEXT ROOM
        {room.auto && (
          <>
            <Sep />
            AUTO-DIG ON
          </>
        )}
      </span>
      <span class="next-room__size">+{room.size}</span>
      <Meter
        class="next-room__meter"
        label="Next room"
        value={room.percent}
        max={100}
        valueText={`Next room ${room.percent} percent dug, ${room.presses} ${room.presses === 1 ? 'dig' : 'digs'} left`}
      />
      <span class="next-room__eta">
        <span data-next-room-time="">{time}</span>
        <Sep />
        <span data-next-room-digs="">{digs}</span>
      </span>
    </div>
  );
}
