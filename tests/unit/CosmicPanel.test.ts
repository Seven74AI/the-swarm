import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { CosmicPanel } from '../../src/ui/panels/CosmicPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('CosmicPanel', () => {
  let bus: EventBus;
  let panel: CosmicPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new CosmicPanel(
      bus,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
    expect(el.className).toContain('cosmic-panel');
  });

  it('shows cosmic discoveries title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Cosmic Discoveries');
  });

  it('shows placeholder when no discoveries exist', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('No cosmic discoveries yet');
  });

  it('displays discovery entries when they exist', () => {
    currentState = {
      ...currentState,
      discoveries: ['Found a neutron star', 'Discovered alien signal'],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Found a neutron star');
    expect(text).toContain('Discovered alien signal');
  });

  it('shows most recent discoveries first', () => {
    currentState = {
      ...currentState,
      discoveries: ['First discovery', 'Second discovery', 'Third discovery'],
    };
    panel.refresh();
    const el = panel.getElement();
    const items = el.querySelectorAll('.cosmic-discovery-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
    // Most recent should be first (reversed order)
    expect(items[0].textContent).toContain('Third discovery');
    expect(items[1].textContent).toContain('Second discovery');
    expect(items[2].textContent).toContain('First discovery');
  });

  it('caps at 10 most recent discoveries', () => {
    const discoveries: string[] = [];
    for (let i = 1; i <= 15; i++) {
      discoveries.push(`Discovery #${i}`);
    }
    currentState = { ...currentState, discoveries };
    panel.refresh();
    const el = panel.getElement();
    const items = el.querySelectorAll('.cosmic-discovery-item');
    expect(items.length).toBeLessThanOrEqual(10);
  });
});
