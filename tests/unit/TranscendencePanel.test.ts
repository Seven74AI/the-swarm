import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { TranscendencePanel } from '../../src/ui/panels/TranscendencePanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('TranscendencePanel', () => {
  let bus: EventBus;
  let panel: TranscendencePanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new TranscendencePanel(
      bus,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
    expect(el.className).toContain('transcendence-panel');
  });

  it('shows transcendence title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Transcendence');
  });

  it('shows victory not achieved message by default', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    // Default state has victoryAchieved = false
    expect(text).toContain('Reach the stars');
  });

  it('shows victory achieved message when victoryAchieved is true', () => {
    currentState = {
      ...currentState,
      victoryAchieved: true,
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('transcended');
  });

  it('shows Legacy Stats section', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Legacy Stats');
  });

  it('shows prestige count', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Prestige Count');
  });

  it('shows prestige count value after prestiging', () => {
    currentState = {
      ...currentState,
      prestige: { count: 3, legacyPoints: 15, totalFoodProduced: 1_000_000, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('3');
    expect(text).toContain('15');
  });

  it('shows legacy points', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Legacy Points');
  });

  it('shows lifetime food', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Lifetime Food');
  });

  it('shows combined endgame + prestige data', () => {
    currentState = {
      ...currentState,
      victoryAchieved: true,
      prestige: { count: 1, legacyPoints: 10, totalFoodProduced: 500_000, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    // Should contain both victory message and prestige stats
    expect(text).toContain('transcended');
    expect(text).toContain('Legacy Stats');
    expect(text).toContain('10');
  });
});
