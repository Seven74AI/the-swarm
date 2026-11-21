import type { Chronicle, ChronicleEntry } from '../../state/chronicle';
import { selectPhase } from '../../state/selectors';
import type { LineJump } from '../log/jump';
import './nest.css';

/** NEST shows this many newest lines; CSS keeps only the newest below 560 px viewport height (UX-DR30). */
export const NEST_LINES = 3;

/** A stable key per chronicle line, so a line keeps its node while newer ones arrive. */
const keys = new WeakMap<ChronicleEntry, number>();
let nextKey = 1;
const keyOf = (entry: ChronicleEntry): number => {
  let k = keys.get(entry);
  if (k === undefined) {
    k = nextKey++;
    keys.set(entry, k);
  }
  return k;
};

/**
 * NEST's event lines (Story 1.22, UX-DR30; Preact since Story 1.36): the
 * chronicle's newest `NEST_LINES`, the newest prefixed `> ` in accent, older
 * ones `· ` in dim. The full log is LOG's. A `role="log"` region holding a
 * real list (UX-DR40); each line keeps its node while newer ones arrive, so
 * the region reads a new line once (Story 1.32).
 * Hooks: `#activity-log`, `.log-entry`, `[data-newest]`, `[data-line-prefix]`, `[data-jump=<panelId>]`.
 */
export function EventLines({ chronicle, jump }: { chronicle: Chronicle; jump: LineJump }) {
  // Which panels are reachable depends on the phase: re-render when it changes.
  void selectPhase.value;
  const shown = chronicle.entries.value.slice(0, NEST_LINES);
  return (
    <div id="activity-log" class="event-log event-lines">
      <div class="event-lines__region" role="log" aria-label="Latest events">
        <ol class="event-lines__list">
          {shown.map((entry, i) => {
            const target = entry.target && jump.canJump(entry.target) ? entry.target : undefined;
            return (
              <li key={keyOf(entry)} class="log-entry event-line" data-newest={i === 0 ? 'true' : 'false'}>
                <span class="event-line__prefix" data-line-prefix="" aria-hidden="true">
                  {i === 0 ? '> ' : '· '}
                </span>
                {target ? (
                  <button type="button" class="event-line__jump" data-jump={target} onClick={() => jump.jump(target)}>
                    {entry.message}
                  </button>
                ) : (
                  entry.message
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
