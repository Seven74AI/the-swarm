import { TABS, type TabId } from '../../data/content/tabs';
import type { TabShell } from './tabShell';

/**
 * Bottom tab bar (Story 1.15, UX-DR9): the active tab in inverse video, `•`
 * on a tab where something became affordable since the last visit, no
 * numeric badges. Hidden in Phase 1.
 */
export function TabBar({ shell, onSelect }: { shell: TabShell; onSelect: (tab: TabId) => void }) {
  const tabs = shell.tabs.value;
  const active = shell.active.value;
  const dots = shell.dots.value;
  return (
    <nav class="tab-bar" data-tab-bar="" aria-label="Tabs" hidden={!shell.showBar.value}>
      <div role="tablist" class="tab-bar-list">
        {TABS.filter((t) => tabs.includes(t.id)).map((t) => {
          const selected = t.id === active;
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
              <span class="tab-bar-label">{t.label}</span>
              {dots.has(t.id) && (
                <>
                  <span class="tab-bar-dot" data-tab-dot="" aria-hidden="true">•</span>
                  <span class="visually-hidden">, something new</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
