import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { SpaceshipPanel } from '../../src/ui/panels/SpaceshipPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('SpaceshipPanel', () => {
  let bus: EventBus;
  let panel: SpaceshipPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new SpaceshipPanel(
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

  it('shows spaceship title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Spaceship');
  });

  it('shows ship level when level > 0', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Lv');
    expect(text).toContain('1');
  });

  it('shows build button when ship level is 0', () => {
    const el = panel.getElement();
    const buildBtn = el.querySelector('button');
    expect(buildBtn).toBeTruthy();
    expect(buildBtn?.textContent).toContain('Build');
  });

  it('shows upgrade button when ship level > 0', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
      resources: { ...currentState.resources, voidCrystals: 100, antimatter: 50, darkMatter: 10 },
    };
    panel.refresh();
    const el = panel.getElement();
    const upgradeBtn = el.querySelector('button');
    expect(upgradeBtn).toBeTruthy();
    expect(upgradeBtn?.textContent).toContain('Upgrade');
  });

  it('disables build button without enough resources', () => {
    currentState = {
      ...currentState,
      resources: { ...currentState.resources, voidCrystals: 0, antimatter: 0, darkMatter: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    const btn = el.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows fuel display when ship has fuel', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 2, fuel: 75, maxFuel: 200 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Fuel');
    expect(text).toContain('75');
    expect(text).toContain('200');
  });
});
