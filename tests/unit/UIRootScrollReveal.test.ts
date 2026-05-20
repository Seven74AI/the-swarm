/**
 * UIRoot scroll-based discovery tests — UX-2 Scroll-Based Discovery.
 * Tests that panels below the viewport are hidden until scrolled into view,
 * that they get `.panel-revealed` on scroll, and that the reveal is single-pass.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { UIRoot } from '../../src/ui/UIRoot';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { SaveManager } from '../../src/persistence/SaveManager';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';

describe('UIRoot — Scroll Discovery', () => {
  let bus: EventBus;
  let container: HTMLElement;
  let ui: UIRoot;
  /** Mock IntersectionObserver callback so we can fire intersection events */
  let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;

  beforeEach(() => {
    bus = new EventBus();
    container = document.createElement('div');
    container.id = 'app';
    container.style.minHeight = '200vh'; // force vertical scroll
    document.body.appendChild(container);

    // Mock IntersectionObserver: store the callback
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn((cb: (entries: IntersectionObserverEntry[]) => void) => {
        observerCallback = cb;
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
          takeRecords: vi.fn(() => []),
        };
      }),
    );

    const resourceSystem = new ResourceSystem(bus);
    const soldierSystem = new SoldierSystem(bus);
    const battleSystem = new BattleSystem(bus);
    const saveManager = new SaveManager();
    const mapSystem = new MapSystem();
    const territorySystem = new TerritorySystem();
    let state = createInitialState();

    ui = new UIRoot({
      bus,
      resourceSystem,
      soldierSystem,
      battleSystem,
      saveManager,
      mapSystem,
      territorySystem,
      getState: () => state,
      setState: (s: GameState) => { state = s; },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    observerCallback = null;
  });

  describe('scroll-based panel reveal', () => {
    it('panels mounted by UIRoot get scroll observation', () => {
      ui.mount(container);

      // IntersectionObserver should have been created
      expect(vi.mocked(IntersectionObserver)).toHaveBeenCalled();

      // Panels in #panels should be observed
      const panelsEl = document.getElementById('panels');
      expect(panelsEl).not.toBeNull();
      // At least one panel element should exist
      const panelElements = panelsEl!.querySelectorAll('.panel');
      expect(panelElements.length).toBeGreaterThan(0);
    });

    it('panels below viewport do NOT have .panel-revealed initially', () => {
      ui.mount(container);

      const panelElements = document.querySelectorAll('.panel');
      for (const panel of panelElements) {
        expect(panel.classList.contains('panel-revealed')).toBe(false);
      }
    });

    it('panels intersecting viewport get .panel-revealed class', () => {
      ui.mount(container);

      // IntersectionObserver callback should now be captured
      expect(observerCallback).not.toBeNull();
      if (!observerCallback) return;

      // Simulate a panel intersecting the viewport
      const panelEl = document.querySelector('.panel');
      expect(panelEl).not.toBeNull();
      if (!panelEl) return;

      // Fire intersection for this panel
      observerCallback([
        {
          target: panelEl,
          isIntersecting: true,
          boundingClientRect: panelEl.getBoundingClientRect(),
          intersectionRect: panelEl.getBoundingClientRect(),
          intersectionRatio: 1,
          rootBounds: null,
          time: Date.now(),
        } as unknown as IntersectionObserverEntry,
      ]);

      expect(panelEl.classList.contains('panel-revealed')).toBe(true);
    });

    it('panels NOT intersecting viewport do NOT get .panel-revealed class', () => {
      ui.mount(container);

      expect(observerCallback).not.toBeNull();
      if (!observerCallback) return;

      const panelEl = document.querySelector('.panel');
      expect(panelEl).not.toBeNull();
      if (!panelEl) return;

      observerCallback([
        {
          target: panelEl,
          isIntersecting: false,
          boundingClientRect: panelEl.getBoundingClientRect(),
          intersectionRect: {} as DOMRectReadOnly,
          intersectionRatio: 0,
          rootBounds: null,
          time: Date.now(),
        } as unknown as IntersectionObserverEntry,
      ]);

      expect(panelEl.classList.contains('panel-revealed')).toBe(false);
    });

    it('single-pass: once revealed, .panel-revealed class stays even if panel scrolls out', () => {
      ui.mount(container);

      expect(observerCallback).not.toBeNull();
      if (!observerCallback) return;

      const panelEl = document.querySelector('.panel');
      expect(panelEl).not.toBeNull();
      if (!panelEl) return;

      // First: reveal the panel (isIntersecting=true)
      observerCallback([
        {
          target: panelEl,
          isIntersecting: true,
          boundingClientRect: panelEl.getBoundingClientRect(),
          intersectionRect: panelEl.getBoundingClientRect(),
          intersectionRatio: 1,
          rootBounds: null,
          time: Date.now(),
        } as unknown as IntersectionObserverEntry,
      ]);
      expect(panelEl.classList.contains('panel-revealed')).toBe(true);

      // Then: simulate scrolling away (isIntersecting=false)
      observerCallback([
        {
          target: panelEl,
          isIntersecting: false,
          boundingClientRect: panelEl.getBoundingClientRect(),
          intersectionRect: {} as DOMRectReadOnly,
          intersectionRatio: 0,
          rootBounds: null,
          time: Date.now(),
        } as unknown as IntersectionObserverEntry,
      ]);

      // Class should STILL be present (single-pass)
      expect(panelEl.classList.contains('panel-revealed')).toBe(true);
    });
  });
});
