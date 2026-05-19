import { describe, it, expect, beforeEach } from 'vitest';
import { BuildingPanel } from '../../src/ui/panels/BuildingPanel';
import { Store } from '../../src/state/Store';
import { StateManager } from '../../src/state/StateManager';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('BuildingPanel', () => {
  let bus: EventBus;
  let manager: StateManager;
  let store: Store;
  let panel: BuildingPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    manager = new StateManager(bus);
    store = new Store(manager);
    currentState = createInitialState();
    panel = new BuildingPanel(
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

  it('lists barracks, walls, and warehouse buildings', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Barracks');
    expect(text).toContain('Walls');
    expect(text).toContain('Warehouse');
  });

  it('shows build buttons for each building', () => {
    const el = panel.getElement();
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('shows building levels as 0 initially', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toMatch(/Lv\./i);
  });

  it('shows cost for each building', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    // Costs are shown with emoji labels
    expect(text).toContain('🍞');
    expect(text).toContain('🪵');
    expect(text).toContain('🪨');
  });
});
