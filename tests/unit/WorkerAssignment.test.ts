import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { WorkerAssignment } from '../../src/ui/panels/WorkerAssignment';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('WorkerAssignment', () => {
  let bus: EventBus;
  let resourceSystem: ResourceSystem;
  let panel: WorkerAssignment;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    resourceSystem = new ResourceSystem(bus);
    currentState = createInitialState();
    panel = new WorkerAssignment(
      bus,
      resourceSystem,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
  });

  it('lists gather, tend, dig, and guard roles', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Gather');
    expect(text).toContain('Tend');
    expect(text).toContain('Dig');
    expect(text).toContain('Guard');
  });

  it('has +/- buttons for each role', () => {
    const el = panel.getElement();
    const buttons = el.querySelectorAll('[data-role] button');
    // 4 roles × 2 buttons = 8 buttons
    expect(buttons.length).toBeGreaterThanOrEqual(8);
  });

  it('sets data-tooltip on dig role row', () => {
    const el = panel.getElement();
    const digRow = el.querySelector('[data-role="dig"]');
    expect(digRow?.getAttribute('data-tooltip')).toContain('capacity');
  });

  it('does not set data-tooltip on gather role row (desc is self-explanatory)', () => {
    const el = panel.getElement();
    const gatherRow = el.querySelector('[data-role="gather"]');
    expect(gatherRow?.getAttribute('data-tooltip')).toBeNull();
  });

  it('does not set data-tooltip on tend role row (desc is self-explanatory)', () => {
    const el = panel.getElement();
    const tendRow = el.querySelector('[data-role="tend"]');
    expect(tendRow?.getAttribute('data-tooltip')).toBeNull();
  });

  it('does not set data-tooltip on guard role row (desc is self-explanatory)', () => {
    const el = panel.getElement();
    const guardRow = el.querySelector('[data-role="guard"]');
    expect(guardRow?.getAttribute('data-tooltip')).toBeNull();
  });
});
