/**
 * UIRoot — Phase-Based Panel Reveal (replaces UX-2 Scroll-Based Discovery).
 *
 * Phase 2+ panels are lazy-loaded (not mounted at boot).
 * showPanel() reveals panels when their phase unlocks,
 * adding .panel-revealed for the animation. Scroll-based
 * discovery (IntersectionObserver + .panel-awaiting-reveal) has been removed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('UIRoot — Phase-Based Panel Reveal', () => {
  let bus: EventBus;
  let container: HTMLElement;
  let ui: UIRoot;

  beforeEach(() => {
    bus = new EventBus();
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

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
  });

  describe('lazy panel creation', () => {
    it('Phase 1 panels (resource_panel) are mounted at boot', () => {
      ui.mount(container);

      // resource_panel should exist in the DOM after mount
      const panel = document.querySelector('.resource-panel');
      expect(panel).not.toBeNull();
    });

    it('Phase 2+ panels are NOT mounted at boot', () => {
      ui.mount(container);

      // worker_assignment should NOT be in the DOM (lazy-loaded)
      const wa = document.querySelector('.worker-assignment');
      expect(wa).toBeNull();

      // soldier_panel should NOT be in the DOM
      const sp = document.querySelector('.soldier-panel');
      expect(sp).toBeNull();
    });

    it('createPanel lazily creates Phase 2 panels and appends to #panels', () => {
      ui.mount(container);

      const el = ui.createPanel('worker_assignment');
      expect(el).not.toBeNull();

      // Should be inside #panels
      const panelsEl = document.getElementById('panels');
      expect(panelsEl).not.toBeNull();
      expect(panelsEl!.contains(el)).toBe(true);
    });

    it('createPanel is idempotent — returns same element on second call', () => {
      ui.mount(container);

      const first = ui.createPanel('worker_assignment');
      const second = ui.createPanel('worker_assignment');

      expect(first).toBe(second);
    });

    it('createPanel throws for unknown panel IDs', () => {
      ui.mount(container);

      expect(() => ui.createPanel('nonexistent_panel')).toThrow();
    });
  });

  describe('phase-based panel reveal', () => {
    it('showPanel sets display to empty and adds panel-revealed class', () => {
      ui.mount(container);
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

    it('showPanel removes legacy panel-awaiting-reveal if present', () => {
      ui.mount(container);
      const el = ui.createPanel('worker_assignment');
      el.classList.add('panel-awaiting-reveal'); // simulate legacy state

      ui.showPanel('worker_assignment');

      expect(el.classList.contains('panel-awaiting-reveal')).toBe(false);
    });

    it('showPanel emits panel_revealed event', () => {
      ui.mount(container);
      ui.createPanel('worker_assignment');

      const events: unknown[] = [];
      bus.subscribe('panel_revealed', (payload) => events.push(payload));

      ui.showPanel('worker_assignment');

      expect(events.length).toBeGreaterThanOrEqual(1);
      const evt = events[events.length - 1] as { panelId: string };
      expect(evt.panelId).toBe('worker_assignment');
    });

    it('showPanel is a no-op for panels not yet created', () => {
      ui.mount(container);

      // Should not throw
      expect(() => ui.showPanel('worker_assignment')).not.toThrow();
    });
  });

  describe('no IntersectionObserver usage', () => {
    it('IntersectionObserver is never created during mount', () => {
      // We should be able to mount without IntersectionObserver being available
      // (In jsdom it's undefined by default; the old code would crash without a mock)
      ui.mount(container);

      // Verify mount succeeded without errors
      const panelsEl = document.getElementById('panels');
      expect(panelsEl).not.toBeNull();
    });
  });
});
