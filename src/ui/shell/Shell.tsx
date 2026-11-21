import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals-core';
import { SEGMENTS, TABS, type SegmentId, type TabId } from '../../data/content/tabs';
import type { TabShell } from './tabShell';
import { TabBar } from './TabBar';
import { SegmentRow } from './SegmentRow';
import { CondensedGoalMeter } from './GoalMeter';
import { Button } from '../primitives/Button';
import type { CharGrid } from './charGrid';
import { bindColumnFocus } from './focusOrder';
import './shell.css';
import './reflow.css';

/**
 * What the shell draws where (Story 1.36): the strip, each tab's content,
 * each FRONT segment and each tab's primary zone. main builds them from the
 * tab registry's placements (`data/content/tabs.ts`); a panel inside one is a
 * `Panel`, which appears once its phase reveals it.
 */
export interface ShellViews {
  readonly strip?: ComponentChildren;
  readonly tabs?: Partial<Record<TabId, ComponentChildren>>;
  readonly segments?: Partial<Record<SegmentId, ComponentChildren>>;
  readonly primary?: Partial<Record<TabId, ComponentChildren>>;
}

/**
 * The portrait tab shell (Story 1.15, UX-DR5, UX-DR9, arch D7): the strip at
 * the top, one scroll area showing the active tab, and the primary zone and
 * tab bar pinned at the bottom, above the safe-area inset.
 *
 * Desktop columns (Story 1.29, UX-DR6): with `shell.columns`, the same DOM is
 * laid out as a grid (`data-layout="columns"`, shell.css): the tab bar becomes
 * a 160 px rail on the left, NEST stays in column 1 and `shell.columnTab`
 * fills columns 2–3, each column scrolling on its own above its own primary
 * zone. Picking NEST in the rail focuses column 1. Same panels, same game.
 *
 * Every tab's content is always rendered (only `hidden` changes), so a
 * panel keeps its DOM, and its scroll position, while its tab is closed.
 */
export interface ShellProps {
  shell: TabShell;
  views?: ShellViews;
  /** CONTINUE: commit the latched phase goal (`actions.continuePhase`, Story 1.19). */
  onContinue?: () => { readonly ok: boolean } | void;
  /** The keys of tabs 1–5 for the rail's hints (settings → key bindings); none when shortcuts are off. Default 1–5. */
  tabKeys?: ReadonlySignal<readonly string[]>;
  /** The character grid (Story 1.31): measured from this shell's columns once mounted. */
  grid?: CharGrid;
}

const DEFAULT_TAB_KEYS: readonly string[] = ['1', '2', '3', '4', '5'];

export function Shell({ shell, views = {}, onContinue, tabKeys, grid }: ShellProps) {
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const active = shell.active.value;
  const segment = shell.segment.value;
  const showBar = shell.showBar.value;
  const columns = shell.columns.value;
  const visible = shell.visible.value;
  const shown = useRef<readonly TabId[]>([]);
  // A met goal makes CONTINUE NEST's primary action (Story 1.19, UX-DR14).
  const goalMet = shell.goalMet.value && onContinue !== undefined;

  useLayoutEffect(() => (grid && root.current ? grid.attach(root.current) : undefined), [grid]);

  // The pinned primary zone and tab bar grow with the text (Story 1.31): the scroll area is
  // padded by their measured heights, so the last row can still reach the thumb zone.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const zone = el.querySelector<HTMLElement>('[data-primary-zone]');
    const bar = el.querySelector<HTMLElement>('[data-tab-bar]');
    const write = () => {
      if (zone) el.style.setProperty('--shell-primary-h', `${zone.offsetHeight}px`);
      if (bar) el.style.setProperty('--shell-tab-bar-h', `${bar.offsetHeight}px`);
    };
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), write()));
    });
    if (zone) observer.observe(zone);
    if (bar) observer.observe(bar);
    write();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
    // The tab bar is drawn in a new place when the layout switches (Story 1.32): observe the new one.
  }, [columns]);
  // Desktop: Tab goes column by column (Story 1.32); the phone layout keeps the DOM order.
  useLayoutEffect(() => {
    if (!columns || !root.current) return;
    return bindColumnFocus(root.current);
  }, [columns]);

  // The element that scrolls a tab: the one scroll area, or the tab's own column on desktop.
  const scrollerOf = (tab: TabId): HTMLElement | null =>
    shell.columns.peek()
      ? (root.current?.querySelector<HTMLElement>(`[data-tab-panel="${tab}"]`) ?? null)
      : scroller.current;

  // Each tab keeps its scroll position for the session: a tab that comes on screen gets its own back.
  useLayoutEffect(() => {
    for (const tab of visible) {
      if (shown.current.includes(tab)) continue;
      const el = scrollerOf(tab);
      if (el) el.scrollTop = shell.scrollOf(tab);
    }
    shown.current = visible;
  }, [visible, columns]);

  const onTab = (tab: TabId) => {
    for (const t of shell.visible.peek()) {
      const el = scrollerOf(t);
      if (el) shell.rememberScroll(t, el.scrollTop);
    }
    if (shell.select(tab) === 'top') {
      const el = scrollerOf(tab);
      if (el) el.scrollTop = 0;
      shell.rememberScroll(tab, 0);
    }
    // Desktop: NEST is always in column 1, so picking it moves the focus there (UX-DR6).
    if (tab === 'nest' && shell.columns.peek()) {
      root.current?.querySelector<HTMLElement>('[data-tab-panel="nest"]')?.focus({ preventScroll: true });
    }
  };

  return (
    <div
      ref={root}
      class="shell"
      data-shell=""
      data-active-tab={active}
      data-tab-bar-shown={showBar ? 'true' : 'false'}
      data-layout={columns ? 'columns' : 'single'}
    >
      <header class="shell-strip" data-shell-strip="">
        {views.strip}
      </header>
      {/* Story 1.18: NEST shows the full goal meter on its phase line; every other tab, this one line. */}
      {/* On desktop NEST, with its full meter, never leaves column 1. */}
      <div class="shell-goal-line" data-goal-line="" role="region" aria-label="Phase goal" hidden={active === 'nest' || columns}>
        <CondensedGoalMeter />
      </div>
      {/* Desktop: the rail comes right after the strip in reading and focus order (UX-DR40). */}
      {columns && <TabBar shell={shell} onSelect={onTab} keys={tabKeys?.value ?? DEFAULT_TAB_KEYS} />}
      <main ref={scroller} id="panels" class="shell-scroll" data-shell-scroll="">
        {TABS.map((t) => (
          <section
            key={t.id}
            id={`tab-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${t.id}`}
            class="shell-tab-panel"
            data-tab-panel={t.id}
            data-column={columns ? (t.id === 'nest' ? '1' : '2') : undefined}
            tabIndex={columns && t.id === 'nest' ? -1 : undefined}
            hidden={!visible.includes(t.id)}
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
                  >
                    {views.segments?.[s.id]}
                  </div>
                ))}
              </>
            ) : (
              <div class="shell-tab-content" data-tab-content={t.id} data-empty={t.empty}>
                {views.tabs?.[t.id]}
              </div>
            )}
          </section>
        ))}
      </main>
      <div class="shell-primary" data-primary-zone="">
        {TABS.map((t) => (
          <div
            key={t.id}
            class="shell-primary-slot"
            data-primary-for={t.id}
            hidden={!visible.includes(t.id) || (t.id === 'nest' && goalMet)}
          >
            {views.primary?.[t.id]}
          </div>
        ))}
        {goalMet && (
          <div class="shell-primary-slot" data-primary-continue="" hidden={!visible.includes('nest')}>
            <Button variant="primary" verb="CONTINUE" data-action="continue" onPress={onContinue} />
          </div>
        )}
      </div>
      {/* Phone: the tab bar comes last, after the primary action. */}
      {!columns && <TabBar shell={shell} onSelect={onTab} keys={null} />}
    </div>
  );
}
