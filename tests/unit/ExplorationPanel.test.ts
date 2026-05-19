import { describe, it, expect, beforeEach } from 'vitest';
import { ExplorationPanel } from '../../src/ui/panels/ExplorationPanel';
import { Store } from '../../src/state/Store';
import { StateManager } from '../../src/state/StateManager';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ExplorationPanel', () => {
  let bus: EventBus;
  let manager: StateManager;
  let store: Store;
  let panel: ExplorationPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    manager = new StateManager(bus);
    store = new Store(manager);
    currentState = createInitialState();
    currentState.spaceExplorations = [];
    currentState.discoveredPlanets = [];
    panel = new ExplorationPanel(
      store,
      bus,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
  });

  it('shows exploration panel title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Exploration');
  });

  it('shows space resources (voidCrystals, antimatter, darkMatter)', () => {
    currentState = {
      ...currentState,
      resources: {
        ...currentState.resources,
        voidCrystals: 5,
        antimatter: 3,
        darkMatter: 1,
      },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Void Crystals');
    expect(text).toContain('Antimatter');
    expect(text).toContain('Dark Matter');
    expect(text).toContain('5');
    expect(text).toContain('3');
    expect(text).toContain('1');
  });

  it('shows planet select dropdown with available planets', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    // Should show planet names
    expect(text).toContain('MARS');
    expect(text).toContain('SATURN');
    expect(text).toContain('EUROPA');
    expect(text).toContain('KEPLER-442B');
  });

  it('renders active space explorations', () => {
    currentState = {
      ...currentState,
      spaceExplorations: [
        { id: 'spc_1', destination: 'MARS', ticksRemaining: 60, risk: 0.3 },
        { id: 'spc_2', destination: 'SATURN', ticksRemaining: 80, risk: 0.2 },
      ],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('MARS');
    expect(text).toContain('SATURN');
    expect(text).toContain('60');
    expect(text).toContain('80');
  });

  it('shows discovered planets list', () => {
    currentState = {
      ...currentState,
      discoveredPlanets: ['MARS', 'EUROPA'],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Discovered');
    expect(text).toContain('MARS');
    expect(text).toContain('EUROPA');
  });
});
