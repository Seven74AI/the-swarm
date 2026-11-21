import { SEGMENTS } from '../../data/content/tabs';
import type { TabShell } from './tabShell';

/** FRONT's segment row (Story 1.15): WAR · MAP · STARS, the active one in inverse video. */
export function SegmentRow({ shell }: { shell: TabShell }) {
  const segments = shell.segments.value;
  const active = shell.segment.value;
  return (
    <div role="tablist" class="segment-row" data-segment-row="" aria-label="Frontier">
      {SEGMENTS.filter((s) => segments.includes(s.id)).map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          id={`segment-${s.id}`}
          class="segment-row-tab"
          data-segment={s.id}
          aria-selected={s.id === active ? 'true' : 'false'}
          aria-controls={`segment-panel-${s.id}`}
          onClick={() => shell.selectSegment(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
