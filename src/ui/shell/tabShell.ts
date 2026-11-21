import { computed, effect, signal, untracked, type ReadonlySignal } from '@preact/signals-core';
import type { Phase } from '../../phases/phases';
import {
  isUnlocked,
  placementOf,
  segmentsForPhase,
  showsTabBar,
  tabsForPhase,
  type SegmentId,
  type TabId,
} from '../../data/content/tabs';

/**
 * Session state of the tab shell (Story 1.15, arch D7): which tab and FRONT
 * segment are open, each tab's scroll position, and the `•` dots. UI state
 * only: nothing here is saved or written to the game state.
 */
export interface TabShell {
  /** Tabs the current phase shows, in bar order. */
  readonly tabs: ReadonlySignal<readonly TabId[]>;
  /** False in Phase 1: NEST is the whole game. */
  readonly showBar: ReadonlySignal<boolean>;
  readonly active: ReadonlySignal<TabId>;
  /** FRONT's segments in this phase, in row order. */
  readonly segments: ReadonlySignal<readonly SegmentId[]>;
  /** The open FRONT segment, or null before Combat. */
  readonly segment: ReadonlySignal<SegmentId | null>;
  /** Tabs where something became affordable since the last visit, and NEST while the goal is met elsewhere. */
  readonly dots: ReadonlySignal<ReadonlySet<TabId>>;
  /** The phase goal is latched: NEST's primary action is CONTINUE (Story 1.19). */
  readonly goalMet: ReadonlySignal<boolean>;
  /**
   * Desktop columns (Story 1.29, UX-DR6): a wide viewport once there is more
   * than NEST. NEST stays in column 1 and `columnTab` fills columns 2–3.
   */
  readonly columns: ReadonlySignal<boolean>;
  /** The tab in columns 2–3: the last tab picked other than NEST (BUILD on first visit). */
  readonly columnTab: ReadonlySignal<TabId | null>;
  /** The tabs on screen, in bar order: the active one, or NEST and `columnTab` in columns. */
  readonly visible: ReadonlySignal<readonly TabId[]>;
  /** Open a tab. Tapping the open tab returns 'top': the caller scrolls it to the top. */
  select(tab: TabId): 'switched' | 'top' | 'locked';
  selectSegment(segment: SegmentId): void;
  rememberScroll(tab: TabId, y: number): void;
  scrollOf(tab: TabId): number;
  dispose(): void;
}

export interface TabShellDeps {
  /** `selectPhase` (the save stores the phase as a string). */
  phase: ReadonlySignal<string>;
  /** `selectAffordableKeys`: `<panelId>:<item>` keys joined by `|`. */
  affordable: ReadonlySignal<string>;
  /** `selectGoalMet`: the phase goal has latched (Story 1.19). Default: never. */
  goalMet?: ReadonlySignal<boolean>;
  /** `platform.viewport.wide`: the viewport is at least 1024 px wide (Story 1.29). Default: never. */
  wide?: ReadonlySignal<boolean>;
}

/** Columns 2–3 open on BUILD the first time (UX-DR6). */
const FIRST_COLUMN_TAB: TabId = 'build';

export function createTabShell({ phase: rawPhase, affordable, goalMet: rawGoalMet, wide }: TabShellDeps): TabShell {
  const goalMet = computed(() => rawGoalMet?.value ?? false);
  const phase = computed(() => rawPhase.value as Phase);
  const tabs = computed(() => tabsForPhase(phase.value));
  const showBar = computed(() => showsTabBar(phase.value));
  const chosen = signal<TabId>('nest');
  const active = computed<TabId>(() => (tabs.value.includes(chosen.value) ? chosen.value : 'nest'));

  // Desktop columns: NEST in column 1, the last other tab picked in columns 2–3.
  const columns = computed(() => (wide?.value ?? false) && showBar.value);
  const chosenColumn = signal<TabId>(FIRST_COLUMN_TAB);
  const columnTab = computed<TabId | null>(() => {
    const others: readonly TabId[] = tabs.value.filter((t) => t !== 'nest');
    if (others.includes(chosenColumn.value)) return chosenColumn.value;
    if (others.includes(FIRST_COLUMN_TAB)) return FIRST_COLUMN_TAB;
    return others[0] ?? null;
  });
  const visible = computed<readonly TabId[]>(() => {
    const col = columnTab.value;
    if (!columns.value || col === null) return [active.value];
    return ['nest', col];
  });

  const segments = computed(() => segmentsForPhase('front', phase.value));
  const chosenSegment = signal<SegmentId | null>(null);
  const segment = computed<SegmentId | null>(() => {
    const list = segments.value;
    if (list.length === 0) return null;
    const c = chosenSegment.value;
    return c !== null && list.includes(c) ? c : list[list.length - 1];
  });

  const scroll = new Map<TabId, number>();
  const affordDots = signal<ReadonlySet<TabId>>(new Set());
  // A met goal puts `•` on NEST while another tab is open (Story 1.19, UX-DR14).
  const dots = computed<ReadonlySet<TabId>>(() => {
    const base = affordDots.value;
    if (!goalMet.value || visible.value.includes('nest') || base.has('nest')) return base;
    return new Set([...base, 'nest']);
  });

  // FRONT opens on the newest segment whenever the row grows.
  let segmentCount = untracked(() => segments.value.length);
  const disposeSegments = effect(() => {
    const list = segments.value;
    if (list.length > segmentCount) chosenSegment.value = list[list.length - 1];
    segmentCount = list.length;
  });

  // The dot: a key on a revealed panel of another tab that wasn't affordable at the last update.
  const keysByTab = (): Map<TabId, Set<string>> => {
    const out = new Map<TabId, Set<string>>();
    const ph = phase.value;
    const visible = tabs.value;
    const raw = affordable.value;
    if (raw === '') return out;
    for (const key of raw.split('|')) {
      const p = placementOf(key.slice(0, key.indexOf(':')));
      if (!p || p.tab === 'strip' || !visible.includes(p.tab) || !isUnlocked(p.unlockPhase, ph)) continue;
      let set = out.get(p.tab);
      if (!set) out.set(p.tab, (set = new Set()));
      set.add(key);
    }
    return out;
  };
  let previous = untracked(keysByTab);
  const disposeDots = effect(() => {
    const current = keysByTab();
    const open = visible.value;
    untracked(() => {
      const next = new Set(affordDots.value);
      for (const [tab, keys] of current) {
        if (open.includes(tab)) continue;
        const before = previous.get(tab);
        for (const k of keys) {
          if (!before?.has(k)) {
            next.add(tab);
            break;
          }
        }
      }
      for (const tab of open) next.delete(tab);
      previous = current;
      const was = affordDots.value;
      if (next.size !== was.size || [...next].some((t) => !was.has(t))) affordDots.value = next;
    });
  });

  return {
    tabs,
    showBar,
    active,
    segments,
    segment,
    dots,
    goalMet,
    columns,
    columnTab,
    visible,
    select(tab) {
      if (!tabs.peek().includes(tab)) return 'locked';
      if (active.peek() === tab) return 'top';
      chosen.value = tab;
      if (tab !== 'nest') chosenColumn.value = tab;
      return 'switched';
    },
    selectSegment(s) {
      if (segments.peek().includes(s)) chosenSegment.value = s;
    },
    rememberScroll(tab, y) {
      scroll.set(tab, Math.max(0, Math.floor(y)));
    },
    scrollOf(tab) {
      return scroll.get(tab) ?? 0;
    },
    dispose() {
      disposeSegments();
      disposeDots();
    },
  };
}
