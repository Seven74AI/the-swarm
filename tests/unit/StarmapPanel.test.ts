import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { StarmapPanel } from '../../src/ui/panels/StarmapPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('StarmapPanel', () => {
  let bus: EventBus;
  let panel: StarmapPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new StarmapPanel(
      bus,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
    expect(el.className).toContain('starmap-panel');
  });

  it('shows star map title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Star Map');
  });

  it('shows all four planets as celestial bodies', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('MARS');
    expect(text).toContain('SATURN');
    expect(text).toContain('EUROPA');
    expect(text).toContain('KEPLER');
  });

  it('shows undiscovered badge for undiscovered planets', () => {
    // All planets undiscovered by default
    const el = panel.getElement();
    const badges = el.querySelectorAll('.starmap-undiscovered');
    expect(badges.length).toBe(4);
  });

  it('shows discovered planet yields', () => {
    currentState = {
      ...currentState,
      discoveredPlanets: ['MARS', 'SATURN'],
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    // Discovered planets show yields
    expect(text).toContain('Antimatter');
    expect(text).toContain('Dark Matter');
    // Undiscovered show '???'
    const badges = el.querySelectorAll('.starmap-undiscovered');
    expect(badges.length).toBe(2); // Only 2 undiscovered now
  });

  it('shows hint when no spaceship built', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Build a spaceship');
  });

  it('shows no-missions hint when ship built but nothing active', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('No active missions');
  });

  it('renders active spaceships on mission', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
      spaceships: [
        {
          id: 'ship_1',
          type: 'scout_ship',
          level: 2,
          fuel: 30,
          maxFuel: 100,
          status: 'exploring',
          missionTicksRemaining: 25,
          destinationName: 'MARS',
        },
        {
          id: 'ship_2',
          type: 'cruiser',
          level: 1,
          fuel: 50,
          maxFuel: 200,
          status: 'returning',
          missionTicksRemaining: 10,
          destinationName: 'SATURN',
        },
        {
          id: 'ship_3',
          type: 'scout_ship',
          level: 1,
          fuel: 100,
          maxFuel: 100,
          status: 'idle',
          missionTicksRemaining: 0,
          destinationName: '',
        },
      ],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    // Active ships shown
    expect(text).toContain('Spaceships on Mission');
    expect(text).toContain('MARS');
    expect(text).toContain('SATURN');
    expect(text).toContain('scout ship');
    expect(text).toContain('cruiser');
    // Time remaining shown
    expect(text).toContain('Arriving in 25');
    expect(text).toContain('Returning');
    expect(text).toContain('10 left');
    // Idle ship not shown
    expect(text).not.toContain('idle');
  });

  it('renders active probes', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
      spaceProbes: [
        { id: 'probe_1', destination: 'Proxima B', ticksRemaining: 42, scouts: 3 },
        { id: 'probe_2', destination: 'Betelgeuse', ticksRemaining: 78, scouts: 1 },
      ],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Active Probes');
    expect(text).toContain('Proxima B');
    expect(text).toContain('Betelgeuse');
    expect(text).toContain('3 scouts');
    expect(text).toContain('1 scouts');
    expect(text).toContain('42s');
    expect(text).toContain('78s');
  });

  it('does not show sections when probes array is empty', () => {
    currentState = {
      ...currentState,
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
      spaceProbes: [],
      spaceships: [],
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).not.toContain('Active Probes');
    expect(text).not.toContain('Spaceships on Mission');
  });
});
