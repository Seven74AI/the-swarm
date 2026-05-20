import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { PrestigePanel } from '../../src/ui/panels/PrestigePanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('PrestigePanel', () => {
  let bus: EventBus;
  let panel: PrestigePanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new PrestigePanel(
      bus,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
    expect(el.className).toContain('prestige-panel');
  });

  it('shows prestige title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Legacy');
    expect(text).toContain('Prestige');
  });

  it('shows current legacy points as 0 initially', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('0');
  });

  it('shows legacy points count when > 0', () => {
    currentState = {
      ...currentState,
      prestige: { count: 0, legacyPoints: 5, totalFoodProduced: 50_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('5');
  });

  it('shows "Legacy 0" when prestige count is 0', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toMatch(/Legacy.*?0/);
  });

  it('shows "Legacy 3" after 3 prestiges', () => {
    currentState = {
      ...currentState,
      prestige: { count: 3, legacyPoints: 12, totalFoodProduced: 500_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toMatch(/Legacy.*?3/);
  });

  it('has a prestige button', () => {
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige');
    expect(btn).toBeTruthy();
  });

  it('disables button when requirements are not met', () => {
    // All starting values are zero — prestige not available
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('enables button when requirements are met', () => {
    currentState = {
      ...currentState,
      buildings: {
        barracks: { level: 5, count: 0 },
        walls: { level: 5 },
        warehouse: { level: 5 },
      },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });

  it('shows tooltip with unmet requirements when button is disabled', () => {
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    // Button should have a title attribute with unmet requirements
    const title = btn.getAttribute('title') || '';
    expect(title).toContain('barracks');
    expect(title).toContain('100K');
  });

  it('shows projected legacy points for next reset', () => {
    currentState = {
      ...currentState,
      buildings: {
        barracks: { level: 5, count: 0 },
        walls: { level: 5 },
        warehouse: { level: 5 },
      },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 1_000_000_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    // Should show "Next Reset" or similar text with projected points
    expect(text).toMatch(/Next|Reset|Projected/i);
  });

  it('emits a prestige event when button is clicked (requirements met)', () => {
    currentState = {
      ...currentState,
      buildings: {
        barracks: { level: 5, count: 0 },
        walls: { level: 5 },
        warehouse: { level: 5 },
      },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;

    let prestigeEvent: unknown = null;
    bus.subscribe('prestige_triggered', (p) => { prestigeEvent = p; });

    btn.click();

    expect(prestigeEvent).not.toBeNull();
  });

  it('does not emit prestige event when button is disabled', () => {
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;

    let prestigeEvent: unknown = null;
    bus.subscribe('prestige_triggered', (p) => { prestigeEvent = p; });

    // Button is disabled — click should not fire
    btn.click();

    expect(prestigeEvent).toBeNull();
  });
});
