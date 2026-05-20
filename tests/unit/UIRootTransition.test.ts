/**
 * UIRoot phase transition tests — overlay lifecycle and panel dimming.
 * Tests the DOM changes triggered by transition_start / transition_complete events.
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

describe('UIRoot — phase transition overlay', () => {
  let bus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    bus = new EventBus();
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    // Mock IntersectionObserver (needed by scroll discovery feature)
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn(() => []),
      })),
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createUIRoot(): UIRoot {
    const resourceSystem = new ResourceSystem(bus);
    const soldierSystem = new SoldierSystem(bus);
    const battleSystem = new BattleSystem(bus);
    const saveManager = new SaveManager();
    const mapSystem = new MapSystem();
    const territorySystem = new TerritorySystem();
    let state = createInitialState();

    return new UIRoot({
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
  }

  describe('overlay lifecycle', () => {
    it('creates overlay element on transition_start event', () => {
      const ui = createUIRoot();
      ui.mount(container);

      bus.emit('transition_start', { phase: 'colony', quote: 'Test quote.' });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.classList.contains('active')).toBe(true);
    });

    it('overlay contains the lore quote text', () => {
      const ui = createUIRoot();
      ui.mount(container);

      bus.emit('transition_start', { phase: 'colony', quote: 'The colony awakens.' });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay?.textContent).toContain('The colony awakens.');
    });

    it('removes overlay active class on transition_complete event', () => {
      const ui = createUIRoot();
      ui.mount(container);

      bus.emit('transition_start', { phase: 'colony', quote: 'Test.' });
      expect(document.getElementById('phase-transition-overlay')).not.toBeNull();

      bus.emit('transition_complete', { phase: 'colony' });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay?.classList.contains('active')).toBe(false);
    });

    it('dims existing panels during transition', () => {
      const ui = createUIRoot();
      ui.mount(container);

      // Show some panels first
      ui.showPanel('resource_panel');
      ui.showPanel('event_log');

      bus.emit('transition_start', { phase: 'colony', quote: 'Test.' });

      // At least one panel should have transition-dimmed
      const dimmedPanels = container.querySelectorAll('.panel.transition-dimmed');
      expect(dimmedPanels.length).toBeGreaterThan(0);
    });

    it('removes dim class from panels on transition_complete', () => {
      const ui = createUIRoot();
      ui.mount(container);

      ui.showPanel('resource_panel');
      ui.showPanel('event_log');

      bus.emit('transition_start', { phase: 'colony', quote: 'Test.' });
      bus.emit('transition_complete', { phase: 'colony' });

      // No panels should still be dimmed
      const dimmedPanels = container.querySelectorAll('.panel.transition-dimmed');
      expect(dimmedPanels.length).toBe(0);
    });

    it('adds transitioning class to phase indicator on transition_start', () => {
      const ui = createUIRoot();
      ui.mount(container);

      bus.emit('transition_start', { phase: 'colony', quote: 'The colony awakens.' });

      const indicator = document.querySelector('.phase-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.classList.contains('transitioning')).toBe(true);
    });

    it('removes transitioning class from phase indicator on transition_complete', () => {
      const ui = createUIRoot();
      ui.mount(container);

      bus.emit('transition_start', { phase: 'colony', quote: 'Test.' });
      bus.emit('transition_complete', { phase: 'colony' });

      const indicator = document.querySelector('.phase-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.classList.contains('transitioning')).toBe(false);
    });

    it('overlay displays the phase name alongside the lore quote', () => {
      const ui = createUIRoot();
      ui.mount(container);

      bus.emit('transition_start', { phase: 'space', quote: 'Gravity is a chain.' });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay).not.toBeNull();
      // Phase name should be displayed (space → "Space")
      expect(overlay?.textContent).toContain('Space');
      expect(overlay?.textContent).toContain('Gravity is a chain.');
    });
  });
});
