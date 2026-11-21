import { TABS, type TabId } from '../../data/content/tabs';
import type { TabShell } from './tabShell';
import { Abbr } from '../primitives/Deco';

/**
 * Bottom tab bar (Story 1.15, UX-DR9): the active tab in inverse video, `•`
 * on a tab where something became affordable since the last visit, no
 * numeric badges. Hidden in Phase 1.
 *
 * On desktop (Story 1.29, `shell.columns`) the same buttons are the left text
 * rail: full tab names and, with `keys`, the key of each tab's shortcut
 * (`keys[i]` for the i-th tab shown; `aria-hidden`, the name stays the
 * accessible name). shell.css lays it out as a column.
 */
export function TabBar({
  shell,
  onSelect,
  keys = null,
}: {
  shell: TabShell;
  onSelect: (tab: TabId) => void;
  /** Rail key hints by tab position, or null for the phone bar. */
  keys?: readonly string[] | null;
}) {
  const tabs = shell.tabs.value;
  const active = shell.active.value;
  const dots = shell.dots.value;
  const rail = shell.columns.value;
  return (
    <nav
      class="tab-bar"
      data-tab-bar=""
      data-rail={rail ? 'true' : 'false'}
      aria-label="Tabs"
      hidden={!shell.showBar.value}
    >
      <div role="tablist" class="tab-bar-list" aria-orientation={rail ? 'vertical' : 'horizontal'}>
        {TABS.filter((t) => tabs.includes(t.id)).map((t, i) => {
          const selected = t.id === active;
          const key = rail ? keys?.[i] : undefined;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              class="tab-bar-tab"
              data-tab={t.id}
              aria-selected={selected ? 'true' : 'false'}
              aria-controls={`tab-panel-${t.id}`}
              title={t.name}
              onClick={() => onSelect(t.id)}
            >
              {rail ? (
                <span class="tab-bar-name" data-tab-name="">{t.railLabel}</span>
              ) : (
                // The phone bar's short label is decoration; the full word is read (UX-DR40).
                <span class="tab-bar-label">
                  <Abbr shown={t.label} full={t.railLabel} />
                </span>
              )}
              {dots.has(t.id) && (
                <>
                  <span class="tab-bar-dot" data-tab-dot="" aria-hidden="true">•</span>
                  <span class="visually-hidden">, something new</span>
                </>
              )}
              {key !== undefined && (
                <span class="tab-bar-key" data-tab-key="" aria-hidden="true">{keyLabel(key)}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** How a bound key reads in the rail: letters upper case, the space bar as SPACE. */
function keyLabel(key: string): string {
  return key === ' ' ? 'SPACE' : key.toUpperCase();
}
