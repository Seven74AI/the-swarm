import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createPanelReveal, PanelRevealContext, REVEAL_STAGGER_MS } from '../../../../src/ui/shell/panelReveal';
import { Panel } from '../../../../src/ui/shell/Panel';

/**
 * Story 1.36: with UIRoot gone, a panel is a Preact element that shows once
 * its phase reveals it. Same rules as UIRoot's lazy panels: not in the DOM
 * before, kept for the session after (a prestige never takes it away), the
 * `.panel-revealed` reveal animation, and a `panel_revealed` notice.
 */
afterEach(() => cleanup());

function setup() {
  const onReveal = vi.fn();
  const panels = createPanelReveal({ onReveal });
  const view = render(
    <PanelRevealContext.Provider value={panels}>
      <Panel id="worker_assignment" domId="worker-assignment" class="panel worker-assignment-panel">
        <p>roles</p>
      </Panel>
      <Panel id="food_display" tag="section">
        <p>food</p>
      </Panel>
    </PanelRevealContext.Provider>,
  );
  return { panels, onReveal, view };
}

describe('Panel', () => {
  it('is not in the DOM until its panel is revealed', () => {
    const { view } = setup();
    expect(view.container.querySelector('#worker-assignment')).toBeNull();
    expect(view.container.textContent).toBe('');
  });

  it('renders once revealed, keeping its id, classes and the reveal hooks', () => {
    const { panels, view } = setup();
    act(() => panels.reveal(['worker_assignment']));
    const el = view.container.querySelector<HTMLElement>('#worker-assignment')!;
    expect(el).not.toBeNull();
    expect(el.classList.contains('worker-assignment-panel')).toBe(true);
    expect(el.classList.contains('panel-revealed')).toBe(true);
    expect(el.classList.contains('panel-unlocked')).toBe(true);
    expect(el.getAttribute('data-panel')).toBe('worker_assignment');
    expect(el.textContent).toBe('roles');
    expect(view.container.querySelector('[data-panel="food_display"]')).toBeNull();
  });

  it('stays revealed for the session (a later reveal never hides it)', () => {
    const { panels, view } = setup();
    act(() => panels.reveal(['worker_assignment']));
    act(() => panels.reveal(['food_display']));
    expect(view.container.querySelector('#worker-assignment')).not.toBeNull();
    expect(view.container.querySelector('section[data-panel="food_display"]')).not.toBeNull();
  });

  it('tells the listener about every panel it reveals, in order, every time', () => {
    const { panels, onReveal } = setup();
    panels.reveal(['worker_assignment', 'food_display']);
    panels.reveal(['worker_assignment']);
    expect(onReveal.mock.calls.map((c) => c[0])).toEqual(['worker_assignment', 'food_display', 'worker_assignment']);
  });

  it('staggers the reveal animation of the panels on screen, by their place in the reveal', () => {
    const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList);
    try {
      const { panels, view } = setup();
      act(() => panels.reveal(['worker_assignment', 'food_display']));
      expect(view.container.querySelector<HTMLElement>('#worker-assignment')!.style.animationDelay).toBe('');
      expect(view.container.querySelector<HTMLElement>('[data-panel="food_display"]')!.style.animationDelay).toBe(`${REVEAL_STAGGER_MS}ms`);
    } finally {
      rects.mockRestore();
    }
  });

  // Main's fix (#360): the stagger belongs to that one reveal. A panel in a closed tab, or one
  // opened again later, must not wait out its place in the cascade every time its tab opens.
  const animationDone = (type: 'animationend' | 'animationcancel', target: Element) => {
    const e = new Event(type, { bubbles: true });
    Object.defineProperty(e, 'animationName', { value: 'phaseReveal' });
    act(() => void target.dispatchEvent(e));
  };

  it('does not stagger a panel that is not on screen as it is revealed (its tab is closed)', () => {
    const { panels, view } = setup();
    act(() => panels.reveal(['worker_assignment', 'food_display']));
    // jsdom lays nothing out: no client rects, as in a closed tab.
    expect(view.container.querySelector<HTMLElement>('[data-panel="food_display"]')!.style.animationDelay).toBe('');
  });

  for (const type of ['animationend', 'animationcancel'] as const) {
    it(`drops the stagger once the reveal is over (${type})`, () => {
      const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList);
      try {
        const { panels, view } = setup();
        act(() => panels.reveal(['worker_assignment', 'food_display']));
        const el = view.container.querySelector<HTMLElement>('[data-panel="food_display"]')!;
        expect(el.style.animationDelay).not.toBe('');
        // A child's animation bubbling up is not the panel's reveal.
        animationDone(type, el.querySelector('p')!);
        expect(el.style.animationDelay).not.toBe('');
        animationDone(type, el);
        expect(el.style.animationDelay).toBe('');
      } finally {
        rects.mockRestore();
      }
    });
  }

  it('without a reveal context, shows its content (tests and harness pages)', () => {
    const view = render(
      <Panel id="food_display">
        <p>food</p>
      </Panel>,
    );
    expect(view.container.querySelector('[data-panel="food_display"]')?.textContent).toBe('food');
  });
});
