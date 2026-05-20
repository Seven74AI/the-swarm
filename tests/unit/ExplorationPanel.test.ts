import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { ExplorationPanel } from '../../src/ui/panels/ExplorationPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ExplorationPanel', () => {
  let bus: EventBus;
  let panel: ExplorationPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new ExplorationPanel(
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

  it('shows planet cards', () => {
    // Need a spaceship to show cards instead of hint
    currentState = { ...currentState, spaceship: { level: 1, fuel: 50, maxFuel: 100 }, soldiers: { ...currentState.soldiers, scouts: 5 } };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('MARS');
    expect(text).toContain('SATURN');
    expect(text).toContain('EUROPA');
    expect(text).toContain('KEPLER');
  });

  it('renders active probes when present', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
      soldiers: { scouts: 5, warriors: 0, totalKilled: 0 },
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

  it('shows hint when no spaceship built', () => {
    currentState = { ...currentState, spaceship: { level: 0, fuel: 0, maxFuel: 0 } };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Build a spaceship');
  });
});
