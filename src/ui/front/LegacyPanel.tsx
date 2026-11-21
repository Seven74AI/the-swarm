import { useLayoutEffect, useRef } from 'preact/hooks';
import type { PanelId } from '../../data/content/tabs';
import { usePanelDelay, usePanelShown } from '../shell/Panel';

/**
 * A legacy vanilla-DOM panel mounted by its FRONT segment (Story 1.36):
 * absent until its phase reveals it, then created once by `create` and kept,
 * with the reveal hooks every panel carries (`[data-panel]`,
 * `.panel-revealed`). Only the Phase 4–5 panels Epic 6 rebuilds use it.
 */
export function LegacyPanel({ id, create }: { id: PanelId; create: () => HTMLElement }) {
  const shown = usePanelShown(id);
  const delay = usePanelDelay(id);
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el || el.firstChild) return;
    const panel = create();
    panel.classList.add('panel-unlocked', 'panel-revealed');
    panel.setAttribute('data-panel', id);
    el.appendChild(panel);
    // The stagger belongs to this one reveal, and only while on screen (#360, as `Panel`).
    if (delay > 0 && panel.getClientRects().length > 0) {
      panel.style.animationDelay = `${delay}ms`;
      const done = (e: Event) => {
        if (e.target !== panel || (e as AnimationEvent).animationName !== 'phaseReveal') return;
        panel.style.animationDelay = '';
        panel.removeEventListener('animationend', done);
        panel.removeEventListener('animationcancel', done);
      };
      panel.addEventListener('animationend', done);
      panel.addEventListener('animationcancel', done);
    }
    // Created once: a re-render never rebuilds the legacy DOM.
  }, [shown]);
  if (!shown) return null;
  return <div ref={host} data-legacy-panel="" style={{ display: 'contents' }} />;
}
