import type { Chronicle } from "../../state/chronicle";
import { selectPhase } from "../../state/selectors";
import type { LineJump } from "./jump";
import "./log.css";

/**
 * LOG's full event log (Story 1.26, UX-DR30, UX-DR31): every kept line,
 * newest first, the newest prefixed `> ` in accent and older ones `· ` in
 * dim. A line that points at something is a button that jumps to it.
 * Hooks: `[data-log-section="chronicle"]`, `[data-chronicle]` (role log),
 * `[data-log-line][data-newest]`, `[data-line-prefix]`, `[data-jump=<panelId>]`.
 */
export function ChronicleLog({
  chronicle,
  jump,
}: {
  chronicle: Chronicle;
  jump: LineJump;
}) {
  // Which panels are reachable depends on the phase: re-render when it changes.
  void selectPhase.value;
  const lines = chronicle.entries.value;
  return (
    <section
      class="log-section"
      data-log-section="chronicle"
      aria-labelledby="log-chronicle-heading"
    >
      <h2 class="log-heading" id="log-chronicle-heading">
        CHRONICLE
      </h2>
      <div role="log" aria-label="Chronicle" data-chronicle="">
        <ol class="log-lines">
          {lines.map((entry, i) => {
            const target =
              entry.target && jump.canJump(entry.target)
                ? entry.target
                : undefined;
            return (
              <li
                key={`${lines.length - i}`}
                class="log-line event-line"
                data-log-line=""
                data-newest={i === 0 ? "true" : "false"}
              >
                <span
                  class="event-line__prefix"
                  data-line-prefix=""
                  aria-hidden="true"
                >
                  {i === 0 ? "> " : "· "}
                </span>
                {target ? (
                  <button
                    type="button"
                    class="event-line__jump"
                    data-jump={target}
                    onClick={() => jump.jump(target)}
                  >
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
    </section>
  );
}
