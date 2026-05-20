/**
 * UIRoot.createPanel() tests — lazy panel creation system.
 * Tests createPanel adds DOM, is idempotent, and throws for unknown IDs.
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

describe('UIRoot — createPanel lazy loading', () => {
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

  describe('createPanel()', () => {
    it('creates a panel DOM element when called with a known panelId', () => {
      // Call createPanel for a known late-phase panel BEFORE mounting
      // The panel should be created and appended to #panels
      const panelEl = ui.createPanel('spaceship_panel');

      expect(panelEl).toBeInstanceOf(HTMLElement);
      expect(panelEl.id).toBe('spaceship-panel');
      expect(document.getElementById('spaceship-panel')).toBe(panelEl);
    });

    it('is idempotent — calling createPanel twice returns the same element', () => {
      const first = ui.createPanel('spaceship_panel');
      const second = ui.createPanel('spaceship_panel');

      expect(first).toBe(second);
      // There should be exactly one element with that id in the DOM
      const all = document.querySelectorAll('#spaceship-panel');
      expect(all.length).toBe(1);
    });

    it('throws a descriptive error for an unknown panelId', () => {
      expect(() => {
        ui.createPanel('nonexistent_panel_xyz');
      }).toThrow(/Unknown panel/i);
      expect(() => {
        ui.createPanel('nonexistent_panel_xyz');
      }).toThrow(/nonexistent_panel_xyz/);
    });

    it('appends the panel to the panels container', () => {
      const panelEl = ui.createPanel('spaceship_panel');
      const panelsContainer = document.getElementById('panels');
      expect(panelsContainer).not.toBeNull();
      expect(panelsContainer?.contains(panelEl)).toBe(true);
    });

    it('panel element has class "panel" for CSS styling', () => {
      const panelEl = ui.createPanel('spaceship_panel');
      expect(panelEl.classList.contains('panel')).toBe(true);
    });
  });
});
