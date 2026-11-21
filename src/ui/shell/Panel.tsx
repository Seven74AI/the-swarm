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
 * Whether a revealed panel's root still carries its stagger delay. The stagger belongs to
 * the one reveal that cascades a phase's panels in (#360): a panel that is not on screen
 * then (its tab is closed) gets none, and the delay goes once that reveal animation is over,
 * so reopening the tab never makes the panel wait out its place in the cascade again.
 */
export function useStagger(el: { current: HTMLElement | null }, shown: boolean, delay: number): boolean {
  const [active, setActive] = useState(true);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || delay <= 0 || !active) return;
    if (node.getClientRects().length === 0) {
      setActive(false);
      return;
    }
    const done = (e: Event) => {
      if (isReveal(e, node)) setActive(false);
    };
    node.addEventListener('animationend', done);
    node.addEventListener('animationcancel', done);
    return () => {
      node.removeEventListener('animationend', done);
      node.removeEventListener('animationcancel', done);
    };
  }, [shown, delay, active]);
  return active && delay > 0;
}

/**
 * One panel of the tab registry (`data/content/tabs.ts`, Story 1.36): absent
 * until its phase reveals it, then its root element with the legacy id and
 * classes kept, `.panel-revealed` (the reveal animation, main.css) and
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
  const staggered = useStagger(root, shown, delay);
  if (!shown) return null;
  const Tag = tag;
  return (
    <Tag
      {...attrs}
      ref={root}
      id={domId}
      class={[className, 'panel-unlocked', 'panel-revealed'].filter(Boolean).join(' ')}
      data-panel={id}
      style={staggered ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
