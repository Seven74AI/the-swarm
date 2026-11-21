/**
 * UIRoot — Phase-Based Panel Reveal (replaces UX-2 Scroll-Based Discovery).
 *
 * Phase 2+ panels are lazy-loaded (not mounted at boot).
 * showPanel() reveals panels when their phase unlocks,
 * adding .panel-revealed for the animation. Scroll-based
 * discovery (IntersectionObserver + .panel-awaiting-reveal) has been removed.
 */
import { shellHosts } from './helpers/shellHosts';
import { testActions } from './helpers/actions';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { UIRoot } from '../../src/ui/UIRoot';
import { SaveManager } from '../../src/persistence/SaveManager';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';
import { Ticker } from '../../src/engine/Ticker';
import { GameLoop } from '../../src/engine/GameLoop';
import { confirmSettings } from './helpers/confirm';

describe('UIRoot — Phase-Based Panel Reveal', () => {
  let bus: EventBus;
  let container: HTMLElement;
  let ui: UIRoot;
  let loop: GameLoop;

  beforeEach(() => {
    bus = new EventBus();
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    const saveManager = new SaveManager();
    const ticker = new Ticker();
    loop = new GameLoop(ticker);
    let state = createInitialState();

    ui = new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager,
      getState: () => state,
      loop,
      confirmSettings: confirmSettings(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('lazy panel creation', () => {
    it('Phase 1 panels (resource_panel) are mounted at boot', () => {
      ui.mount(shellHosts(container));

      // resource_panel should exist in the DOM after mount
      const panel = document.querySelector('.resource-panel');
      expect(panel).not.toBeNull();
    });

    it('draws the resource strip into the resource_panel host in the strip (Story 1.16)', () => {
      let state = createInitialState();
      const hosts: HTMLElement[] = [];
      const withStrip = new UIRoot({
        bus,
        actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
        saveManager: new SaveManager(),
        getState: () => state,
        loop,
        confirmSettings: confirmSettings(),
        mountStrip: (host) => hosts.push(host),
      });
      const shell = shellHosts(container);
      withStrip.mount(shell);
      expect(hosts).toHaveLength(1);
      expect(hosts[0].classList.contains('resource-panel')).toBe(true);
      expect(shell.strip.contains(hosts[0])).toBe(true);
    });

    it('Phase 2+ panels are NOT mounted at boot', () => {
      ui.mount(shellHosts(container));

      // worker_assignment should NOT be in the DOM (lazy-loaded)
      const wa = document.querySelector('.worker-assignment');
      expect(wa).toBeNull();

      // soldier_panel should NOT be in the DOM
      const sp = document.querySelector('.soldier-panel');
      expect(sp).toBeNull();
    });

    it('createPanel lazily creates Phase 2 panels and appends to #panels', () => {
      ui.mount(shellHosts(container));

      const el = ui.createPanel('worker_assignment');
      expect(el).not.toBeNull();

      // Should be inside #panels
      const panelsEl = document.getElementById('panels');
      expect(panelsEl).not.toBeNull();
      expect(panelsEl!.contains(el)).toBe(true);
    });

    it('createPanel is idempotent — returns same element on second call', () => {
      ui.mount(shellHosts(container));

      const first = ui.createPanel('worker_assignment');
      const second = ui.createPanel('worker_assignment');

      expect(first).toBe(second);
    });

    it('createPanel throws for unknown panel IDs', () => {
      ui.mount(shellHosts(container));

      expect(() => ui.createPanel('nonexistent_panel')).toThrow();
    });
  });

  describe('phase-based panel reveal', () => {
    it('showPanel sets display to empty and adds panel-revealed class', () => {
      ui.mount(shellHosts(container));
      const el = ui.createPanel('worker_assignment');

      // Panel should start hidden (set by constructor)
      expect(el.style.display).toBe('none');

      ui.showPanel('worker_assignment');

      // Should now be visible
      expect(el.style.display).toBe('');
      // Should have the reveal class
      expect(el.classList.contains('panel-revealed')).toBe(true);
      // Should have the unlocked marker
      expect(el.classList.contains('panel-unlocked')).toBe(true);
    });

    /** An `animationend` for `name` dispatched on `target` (bubbles, like the browser's). */
    const animationEnd = (target: Element, name: string) => {
      const e = new Event('animationend', { bubbles: true });
      Object.defineProperty(e, 'animationName', { value: name });
      target.dispatchEvent(e);
    };

    it('the reveal plays once: when it ends, the reveal class and its stagger delay go', () => {
      ui.mount(shellHosts(container));
      const el = ui.createPanel('worker_assignment');
      onScreen(el, true);
      ui.showPanel('worker_assignment', 300);
      expect(el.classList.contains('panel-revealed')).toBe(true);
      expect(el.style.animationDelay).not.toBe('');

      // A child's animation ending bubbles up, but does not end the panel's reveal.
      const child = el.appendChild(document.createElement('span'));
      animationEnd(child, 'phaseReveal');
      animationEnd(el, 'some-other-animation');
      expect(el.classList.contains('panel-revealed')).toBe(true);

      animationEnd(el, 'phaseReveal');
      // Showing its tab again later must not replay the slide-in (it moved panels from under the pointer).
      expect(el.classList.contains('panel-revealed')).toBe(false);
      expect(el.style.animationDelay).toBe('');
      expect(el.classList.contains('panel-unlocked')).toBe(true);
    });

    it('a panel unlocked in a closed tab slides in once, unstaggered, when its tab opens', () => {
      ui.mount(shellHosts(container));
      const el = ui.createPanel('worker_assignment');
      onScreen(el, false);
      ui.showPanel('worker_assignment', 300);
      expect(el.classList.contains('panel-revealed')).toBe(true);
      expect(el.style.animationDelay).toBe('');
      // The tab opens and the reveal plays; once it ends, opening the tab again shows it as is.
      animationEnd(el, 'phaseReveal');
      expect(el.classList.contains('panel-revealed')).toBe(false);
    });

    it('a reveal cut short (its tab closed mid-slide) is over too', () => {
      ui.mount(shellHosts(container));
      const el = ui.createPanel('worker_assignment');
      onScreen(el, true);
      ui.showPanel('worker_assignment', 300);
      const e = new Event('animationcancel', { bubbles: true });
      Object.defineProperty(e, 'animationName', { value: 'phaseReveal' });
      el.dispatchEvent(e);
      expect(el.classList.contains('panel-revealed')).toBe(false);
      expect(el.style.animationDelay).toBe('');
    });

    it('showPanel removes legacy panel-awaiting-reveal if present', () => {
      ui.mount(shellHosts(container));
      const el = ui.createPanel('worker_assignment');
      el.classList.add('panel-awaiting-reveal'); // simulate legacy state

      ui.showPanel('worker_assignment');

      expect(el.classList.contains('panel-awaiting-reveal')).toBe(false);
    });

    it('showPanel emits panel_revealed event', () => {
      ui.mount(shellHosts(container));
      ui.createPanel('worker_assignment');

      const events: unknown[] = [];
      bus.subscribe('panel_revealed', (payload) => events.push(payload));

      ui.showPanel('worker_assignment');

      expect(events.length).toBeGreaterThanOrEqual(1);
      const evt = events[events.length - 1] as { panelId: string };
      expect(evt.panelId).toBe('worker_assignment');
    });

    // The stagger cascades panels in as a phase begins. It belongs to that one
    // reveal: a panel in a closed tab, or one opened again later, must not wait
    // out its place in the cascade every time its tab opens.
    const onScreen = (el: HTMLElement, shown: boolean) => {
      el.getClientRects = () => (shown ? [new DOMRect(0, 0, 10, 10)] : []) as unknown as DOMRectList;
    };
    const animationDone = (el: HTMLElement, type: 'animationend' | 'animationcancel', target: Element = el) => {
      const e = new Event(type, { bubbles: true });
      Object.defineProperty(e, 'animationName', { value: 'phaseReveal' });
      target.dispatchEvent(e);
    };

    it('staggers a panel that is on screen as it is revealed', () => {
      ui.mount(shellHosts(container));
      const el = ui.createPanel('worker_assignment');
      onScreen(el, true);
      ui.showPanel('worker_assignment', 300);
      expect(el.style.animationDelay).not.toBe('');
    });

    it('does not stagger a panel whose tab is closed', () => {
      ui.mount(shellHosts(container));
      const el = ui.createPanel('worker_assignment');
      onScreen(el, false);
      ui.showPanel('worker_assignment', 300);
      expect(el.style.animationDelay).toBe('');
      expect(el.classList.contains('panel-revealed')).toBe(true);
    });

    for (const type of ['animationend', 'animationcancel'] as const) {
      it(`drops the stagger once the reveal is over (${type})`, () => {
        ui.mount(shellHosts(container));
        const el = ui.createPanel('worker_assignment');
        onScreen(el, true);
        ui.showPanel('worker_assignment', 300);
        // A child's animation bubbling up is not the panel's reveal.
        const child = el.appendChild(document.createElement('span'));
        animationDone(el, type, child);
        expect(el.style.animationDelay).not.toBe('');
        animationDone(el, type);
        expect(el.style.animationDelay).toBe('');
      });
    }

    it('showPanel is a no-op for panels not yet created', () => {
      ui.mount(shellHosts(container));

      // Should not throw
      expect(() => ui.showPanel('worker_assignment')).not.toThrow();
    });
  });

  describe('no IntersectionObserver usage', () => {
    it('IntersectionObserver is never created during mount', () => {
      // We should be able to mount without IntersectionObserver being available
      // (In jsdom it's undefined by default; the old code would crash without a mock)
      ui.mount(shellHosts(container));

      // Verify mount succeeded without errors
      const panelsEl = document.getElementById('panels');
      expect(panelsEl).not.toBeNull();
    });
  });
});
