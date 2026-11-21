import type { ComponentChildren } from 'preact';
import { useContext, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { PanelId } from '../../data/content/tabs';
import { PanelRevealContext } from './panelReveal';

/** True once the session revealed the panel (always, without a reveal context). */
export function usePanelShown(id: PanelId): boolean {
  const panels = useContext(PanelRevealContext);
  return panels ? panels.revealed.value.has(id) : true;
}

/** The panel's reveal-animation delay (0 without a reveal context). */
export function usePanelDelay(id: PanelId): number {
  const panels = useContext(PanelRevealContext);
  return panels ? panels.delayOf(id) : 0;
}

const isReveal = (e: Event, el: Element): boolean =>
  e.target === el && (e as AnimationEvent).animationName === 'phaseReveal';

/**
 * A revealed panel's reveal animation (`.panel-revealed`), which plays once (#360, #361):
 * the class and its stagger delay go when the animation ends or is cut short, so showing
 * the tab again never replays the slide-in. Only a panel on screen as it is revealed is
 * staggered; one in a closed tab slides in, unstaggered, when its tab first opens.
 */
export function useRevealOnce(el: { current: HTMLElement | null }, shown: boolean, delay: number): { revealing: boolean; staggered: boolean } {
  const [revealing, setRevealing] = useState(true);
  const [offScreen, setOffScreen] = useState(false);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || !revealing) return;
    if (node.getClientRects().length === 0) setOffScreen(true);
    const done = (e: Event) => {
      if (isReveal(e, node)) setRevealing(false);
    };
    node.addEventListener('animationend', done);
    node.addEventListener('animationcancel', done);
    return () => {
      node.removeEventListener('animationend', done);
      node.removeEventListener('animationcancel', done);
    };
  }, [shown, revealing]);
  return { revealing, staggered: revealing && !offScreen && delay > 0 };
}

/**
 * One panel of the tab registry (`data/content/tabs.ts`, Story 1.36): absent
 * until its phase reveals it, then its root element with the legacy id and
 * classes kept, `.panel-unlocked`, `.panel-revealed` while its reveal plays (main.css) and
 * `[data-panel=<id>]` (where an event line jumps to).
 */
export function Panel({
  id,
  domId,
  class: className,
  tag = 'div',
  attrs,
  children,
}: {
  id: PanelId;
  /** The element id the old host had (`worker-assignment`, …). */
  domId?: string;
  class?: string;
  tag?: 'div' | 'section';
  /** Extra attributes for the root (`data-*` hooks). */
  attrs?: Record<string, string>;
  children?: ComponentChildren;
}) {
  const shown = usePanelShown(id);
  const delay = usePanelDelay(id);
  const root = useRef<HTMLDivElement>(null);
  const { revealing, staggered } = useRevealOnce(root, shown, delay);
  if (!shown) return null;
  const Tag = tag;
  return (
    <Tag
      {...attrs}
      ref={root}
      id={domId}
      class={[className, 'panel-unlocked', revealing && 'panel-revealed'].filter(Boolean).join(' ')}
      data-panel={id}
      style={staggered ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
