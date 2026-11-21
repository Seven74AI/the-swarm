import type { Phase } from '../../phases/phases';
import {
  isUnlocked,
  placementOf,
  showsTabBar,
  tabsForPhase,
  type PanelId,
  type SegmentId,
  type TabId,
} from '../../data/content/tabs';

/** How long a panel reached from a line stays marked (`[data-jumped]`). */
export const JUMP_HIGHLIGHT_MS = 2000;

/**
 * Tapping an event line that points at something jumps to it (Story 1.26,
 * UX-DR30): its tab (and FRONT segment) opens and the panel scrolls into view.
 */
export interface LineJump {
  /** True when the line's panel can be reached in the current phase. */
  canJump(target: PanelId): boolean;
  jump(target: PanelId): void;
}

export interface LineJumpDeps {
  /** The current phase (the save stores it as a string). */
  phase: () => string;
  select(tab: TabId): unknown;
  selectSegment(segment: SegmentId): void;
  /** The panel's element, once created. */
  element(panelId: PanelId): HTMLElement | null | undefined;
  /** Runs after the tab switch has rendered (default: the next animation frame). */
  schedule?: (fn: () => void) => void;
}

export function createLineJump(deps: LineJumpDeps): LineJump {
  const schedule = deps.schedule ?? ((fn: () => void) => requestAnimationFrame(() => fn()));
  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
  const canJump = (target: PanelId): boolean => {
    const p = placementOf(target);
    if (!p || p.tab === 'strip') return false;
    const phase = deps.phase() as Phase;
    if (!showsTabBar(phase)) return false;
    return tabsForPhase(phase).includes(p.tab) && isUnlocked(p.unlockPhase, phase);
  };
  return {
    canJump,
    jump(target) {
      if (!canJump(target)) return;
      const p = placementOf(target)!;
      deps.select(p.tab as TabId);
      if (p.segment) deps.selectSegment(p.segment);
      schedule(() => {
        const el = deps.element(target);
        if (!el) return;
        el.scrollIntoView?.({ block: 'start' });
        el.setAttribute('data-jumped', '');
        const prev = timers.get(el);
        if (prev !== undefined) clearTimeout(prev);
        timers.set(el, setTimeout(() => el.removeAttribute('data-jumped'), JUMP_HIGHLIGHT_MS));
      });
    },
  };
}
