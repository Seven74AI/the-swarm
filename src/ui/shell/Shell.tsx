import { useLayoutEffect, useRef } from 'preact/hooks';
import { SEGMENTS, TABS, type TabId } from '../../data/content/tabs';
import type { TabShell } from './tabShell';
import { hostsFromRoot, type ShellHosts } from './hosts';
import { TabBar } from './TabBar';
import { SegmentRow } from './SegmentRow';
import './shell.css';

/** The part of the legacy `UIRoot` the shell needs: mount its panels into the shell's hosts. */
export interface LegacyUi {
  mount(hosts: ShellHosts): void;
}

/**
 * The portrait tab shell (Story 1.15, UX-DR5, UX-DR9, arch D7): the strip at
 * the top, one scroll area showing the active tab, and the primary zone and
 * tab bar pinned at the bottom, above the safe-area inset.
 *
 * Legacy panels mount into the empty host containers (they have no Preact
 * children, so re-renders never touch the legacy DOM). Only `hidden` changes.
 */
export function Shell({ shell, legacy }: { shell: TabShell; legacy: LegacyUi }) {
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const active = shell.active.value;
  const segment = shell.segment.value;
  const showBar = shell.showBar.value;

  useLayoutEffect(() => {
    if (root.current) legacy.mount(hostsFromRoot(root.current));
    // Mount once per legacy UI; UIRoot has no unmount.
  }, [legacy]);

  // Each tab keeps its scroll position for the session.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = shell.scrollOf(active);
  }, [active]);

  const onTab = (tab: TabId) => {
    const el = scroller.current;
    const from = shell.active.peek();
    if (el) shell.rememberScroll(from, el.scrollTop);
    if (shell.select(tab) === 'top' && el) {
      el.scrollTop = 0;
      shell.rememberScroll(tab, 0);
    }
  };

  return (
    <div
      ref={root}
      class="shell"
      data-legacy-ui=""
      data-shell=""
      data-active-tab={active}
      data-tab-bar-shown={showBar ? 'true' : 'false'}
    >
      <header class="shell-strip" data-shell-strip="" />
      <main ref={scroller} id="panels" class="shell-scroll" data-shell-scroll="">
        {TABS.map((t) => (
          <section
            key={t.id}
            id={`tab-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${t.id}`}
            class="shell-tab-panel"
            data-tab-panel={t.id}
            hidden={active !== t.id}
          >
            {t.id === 'front' ? (
              <>
                <SegmentRow shell={shell} />
                {SEGMENTS.filter((s) => s.tab === t.id).map((s) => (
                  <div
                    key={s.id}
                    id={`segment-panel-${s.id}`}
                    role="tabpanel"
                    aria-labelledby={`segment-${s.id}`}
                    data-segment-panel={s.id}
                    hidden={segment !== s.id}
                  />
                ))}
              </>
            ) : (
              <div class="shell-tab-content" data-tab-content={t.id} data-empty={t.empty} />
            )}
          </section>
        ))}
      </main>
      <div class="shell-primary" data-primary-zone="">
        {TABS.map((t) => (
          <div key={t.id} class="shell-primary-slot" data-primary-for={t.id} hidden={active !== t.id} />
        ))}
      </div>
      <TabBar shell={shell} onSelect={onTab} />
    </div>
  );
}
