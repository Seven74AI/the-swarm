import { describe, it, expect, beforeAll, vi } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import type { EventBus } from '../../src/engine/EventBus';
import type { SwarmEvents } from '../../src/engine/events';
import { log } from '../../src/utils/log';
import { EVENT_NAMES, EVENT_SAMPLES } from './helpers/eventSamples';

type Swarm = {
  bus: EventBus;
  loop: { stop(): void };
  ui: { createPanel(id: string): HTMLElement };
};

/**
 * AR18: no listener writes game state. A listener that needs a state change
 * calls an action, which writes between ticks.
 *
 * Interim check until the boundary test (Story 1.4) covers it: boot the game,
 * create every lazily-mounted panel so its listeners are subscribed, then emit
 * every SwarmEvents event and assert the state signal was never reassigned.
 */
describe('event listeners never write gameState', () => {
  let swarm: Swarm;

  beforeAll(async () => {
    await import('../../src/main');
    swarm = (window as unknown as { __swarm: Swarm }).__swarm;
    swarm.loop.stop();
    const registry = (swarm.ui as unknown as { panelRegistry: Map<string, unknown> }).panelRegistry;
    for (const id of registry.keys()) swarm.ui.createPanel(id);
  });

  it.each(EVENT_NAMES)('%s listeners leave gameState.value untouched', (name) => {
    const errorSpy = vi.spyOn(log, 'error');
    // Spy on the setter itself: a write of the same reference still counts.
    const writeSpy = vi.spyOn(gameState, 'value', 'set');
    const emit = swarm.bus.emit.bind(swarm.bus) as <K extends keyof SwarmEvents>(e: K, p: SwarmEvents[K]) => void;
    try {
      emit(name, EVENT_SAMPLES[name]);
      expect(writeSpy).not.toHaveBeenCalled();
      // A listener that throws on a sample payload would hide a write; fail loudly instead.
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
