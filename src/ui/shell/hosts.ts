import type { PanelPlacement } from '../../data/content/tabs';

/**
 * Where the legacy panels mount inside the tab shell (Story 1.15). The shell
 * renders one container per tab, FRONT segment and primary zone; UIRoot asks
 * for the host of a panel's placement (data/content/tabs.ts).
 */
export interface ShellHosts {
  /** The shell root, for fixed overlays such as the decision popup. */
  readonly root: HTMLElement;
  /** The global strip at the top (top bar, resources). */
  readonly strip: HTMLElement;
  /** The scroll area (`#panels`) holding the tab panels. */
  readonly scroll: HTMLElement;
  host(placement: PanelPlacement): HTMLElement;
}

/** Reads the hosts out of a rendered shell, by their data-* hooks. */
export function hostsFromRoot(root: HTMLElement): ShellHosts {
  const one = (selector: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Tab shell is missing ${selector}`);
    return el;
  };
  const strip = one('[data-shell-strip]');
  const scroll = one('[data-shell-scroll]');
  return {
    root,
    strip,
    scroll,
    host(p) {
      if (p.tab === 'strip') return strip;
      if (p.zone === 'primary') return one(`[data-primary-for="${p.tab}"]`);
      if (p.segment) return one(`[data-segment-panel="${p.segment}"]`);
      return one(`[data-tab-content="${p.tab}"]`);
    },
  };
}
