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

  it('shows exploration title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Exploration');
  });

  it('shows launch probe form', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Scout');
    expect(text).toContain('Launch');
  });

  it('shows destinations select', () => {
    const el = panel.getElement();
    const select = el.querySelector('select');
    expect(select).toBeTruthy();
    const options = select?.querySelectorAll('option');
    expect(options?.length).toBeGreaterThanOrEqual(2);
  });

  it('renders active probes when present', () => {
    currentState = {
      ...currentState,
      spaceProbes: [
        { id: 'probe_1', destination: 'Alpha Centauri', ticksRemaining: 30, scouts: 2 },
        { id: 'probe_2', destination: 'Sirius', ticksRemaining: 45, scouts: 1 },
      ],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Alpha Centauri');
    expect(text).toContain('Sirius');
    expect(text).toContain('30');
    expect(text).toContain('45');
  });

  it('disables launch button without spaceship', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 0, fuel: 0, maxFuel: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    const launchBtn = el.querySelector('button');
    expect(launchBtn).toBeTruthy();
    expect((launchBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
