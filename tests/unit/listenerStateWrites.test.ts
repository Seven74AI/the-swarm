import { describe, it, expect, beforeAll, vi } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import type { EventBus } from '../../src/engine/EventBus';
import type { SwarmEvents } from '../../src/engine/events';
import { log } from '../../src/utils/log';
import { EVENT_NAMES, EVENT_SAMPLES } from './helpers/eventSamples';
import { PANEL_PLACEMENT } from '../../src/data/content/tabs';

type Swarm = {
  bus: EventBus;
  loop: { stop(): void };
  panels: { reveal(ids: readonly string[]): void };
};

/**
 * AR18: no listener writes game state. A listener that needs a state change
 * calls an action, which writes between ticks.
 *
 * Runtime half of the check: the boundary test (tests/arch, Story 1.4) scans
 * inline listeners statically but can't follow named ones. Boot the game,
 * reveal every panel so every view (legacy FRONT panels included) is mounted, then emit
 * every SwarmEvents event and assert the state signal was never reassigned.
 */
describe('event listeners never write gameState', () => {
  let swarm: Swarm;

  beforeAll(async () => {
    await import('../../src/main');
    swarm = (window as unknown as { __swarm: Swarm }).__swarm;
    swarm.loop.stop();
    swarm.panels.reveal(Object.keys(PANEL_PLACEMENT));
    // Let Preact draw the revealed panels (renders are batched).
    await new Promise((r) => setTimeout(r, 0));
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
