/**
 * UIRoot phase transition tests — overlay lifecycle and panel dimming.
 * Tests the DOM changes triggered by transition_start / transition_complete events.
 */
import { shellHosts } from './helpers/shellHosts';
import { testActions } from './helpers/actions';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { Phase } from '../../src/phases/phases';
import { UIRoot } from '../../src/ui/UIRoot';
import { SaveManager } from '../../src/persistence/SaveManager';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';
import { Ticker } from '../../src/engine/Ticker';
import { GameLoop } from '../../src/engine/GameLoop';
import { confirmSettings } from './helpers/confirm';

describe('UIRoot — phase transition overlay', () => {
  let bus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    bus = new EventBus();
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function createUIRoot(): UIRoot {
    const saveManager = new SaveManager();
    const ticker = new Ticker();
    const loop = new GameLoop(ticker);
    let state = createInitialState();

    return new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager,
      getState: () => state,
      loop,
      confirmSettings: confirmSettings(),
    });
  }

  describe('overlay lifecycle', () => {
    it('creates overlay element on transition_start event', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      bus.emit('transition_start', { phase: Phase.COLONY, quote: 'Test quote.' });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.classList.contains('active')).toBe(true);
    });

    it('overlay contains the lore quote text', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      bus.emit('transition_start', { phase: Phase.COLONY, quote: 'The colony awakens.' });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay?.textContent).toContain('The colony awakens.');
    });

    it('removes overlay active class on transition_complete event', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      bus.emit('transition_start', { phase: Phase.COLONY, quote: 'Test.' });
      expect(document.getElementById('phase-transition-overlay')).not.toBeNull();

      bus.emit('transition_complete', { phase: Phase.COLONY });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay?.classList.contains('active')).toBe(false);
    });

    it('dims existing panels during transition', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      // Show some panels first
      ui.showPanel('resource_panel');
      ui.showPanel('event_log');

      bus.emit('transition_start', { phase: Phase.COLONY, quote: 'Test.' });

      // At least one panel should have transition-dimmed
      const dimmedPanels = container.querySelectorAll('.panel.transition-dimmed');
      expect(dimmedPanels.length).toBeGreaterThan(0);
    });

    it('removes dim class from panels on transition_complete', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      ui.showPanel('resource_panel');
      ui.showPanel('event_log');

      bus.emit('transition_start', { phase: Phase.COLONY, quote: 'Test.' });
      bus.emit('transition_complete', { phase: Phase.COLONY });

      // No panels should still be dimmed
      const dimmedPanels = container.querySelectorAll('.panel.transition-dimmed');
      expect(dimmedPanels.length).toBe(0);
    });

    it('adds transitioning class to phase indicator on transition_start', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      bus.emit('transition_start', { phase: Phase.COLONY, quote: 'The colony awakens.' });

      const indicator = document.querySelector('.phase-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.classList.contains('transitioning')).toBe(true);
    });

    it('removes transitioning class from phase indicator on transition_complete', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      bus.emit('transition_start', { phase: Phase.COLONY, quote: 'Test.' });
      bus.emit('transition_complete', { phase: Phase.COLONY });

      const indicator = document.querySelector('.phase-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.classList.contains('transitioning')).toBe(false);
    });

    it('overlay displays the phase name alongside the lore quote', () => {
      const ui = createUIRoot();
      ui.mount(shellHosts(container));

      bus.emit('transition_start', { phase: Phase.SPACE, quote: 'Gravity is a chain.' });

      const overlay = document.getElementById('phase-transition-overlay');
      expect(overlay).not.toBeNull();
      // Phase name should be displayed (space → "Space")
      expect(overlay?.textContent).toContain('Space');
      expect(overlay?.textContent).toContain('Gravity is a chain.');
    });
  });
});
