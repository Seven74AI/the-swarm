import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { ExpeditionPanel } from '../../src/ui/panels/ExpeditionPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ExpeditionPanel', () => {
  let bus: EventBus;
  let panel: ExpeditionPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new ExpeditionPanel(
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

  it('shows launch expedition form', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Expedition');
  });

  it('shows scout and warrior inputs', () => {
    currentState = {
      ...currentState,
      soldiers: { scouts: 3, warriors: 2, totalKilled: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Scout');
    expect(text).toContain('Warrior');
  });

  it('renders active expeditions', () => {
    currentState = {
      ...currentState,
      expeditions: [
        { id: 'exp_1', scouts: 1, warriors: 0, destination: 'FOREST', ticksRemaining: 45, risk: 0.3 },
        { id: 'exp_2', scouts: 2, warriors: 1, destination: 'MOUNTAIN', ticksRemaining: 30, risk: 0.25 },
      ],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('FOREST');
    expect(text).toContain('MOUNTAIN');
    expect(text).toContain('45');
    expect(text).toContain('30');
  });
});
