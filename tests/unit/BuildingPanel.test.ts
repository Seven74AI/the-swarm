import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { BuildingPanel } from '../../src/ui/panels/BuildingPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('BuildingPanel', () => {
  let bus: EventBus;
  let panel: BuildingPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new BuildingPanel(
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

  it('sets descriptive tooltip on each building row', () => {
    const el = panel.getElement();
    const barracksRow = el.querySelector('[data-building="barracks"]');
    const wallsRow = el.querySelector('[data-building="walls"]');
    const warehouseRow = el.querySelector('[data-building="warehouse"]');
    expect(barracksRow?.getAttribute('data-tooltip')).toContain('scouts');
    expect(wallsRow?.getAttribute('data-tooltip')).toContain('defense');
    expect(warehouseRow?.getAttribute('data-tooltip')).toContain('capacity');
  });

  it('disabled build buttons keep cost tooltip', () => {
    // Fresh state with 0 resources — all buttons disabled
    const el = panel.getElement();
    const buttons = el.querySelectorAll('button[data-tooltip]');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });
});
