import { describe, it, expect, beforeAll } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { Phase } from '../../src/phases/phases';
import type { EventBus } from '../../src/engine/EventBus';
import { EVENT_NAMES } from './helpers/eventSamples';

type Swarm = { bus: EventBus; tick: (dtSec: number) => void; loop: { stop(): void } };

/**
 * AR18: events raised during a tick are queued on the tick context and
 * flushed only after `gameState.value` holds the tick's new state.
 */
describe('tick events arrive after the state they describe', () => {
  let swarm: Swarm;

  beforeAll(async () => {
    await import('../../src/main');
    swarm = (window as unknown as { __swarm: Swarm }).__swarm;
    swarm.loop.stop();
  });

  it('a phase_changed listener already reads the new phase from gameState', () => {
    const base = createInitialState();
    // Satisfy the real EGG_LAYING → COLONY guard (transitions.ts).
    gameState.value = {
      ...base,
      phase: Phase.EGG_LAYING,
      resources: { ...base.resources, workers: 10_000 },
    };

    const seen: { payload: Phase; statePhase: string }[] = [];
    const onPhase = (p: { phase: Phase }) => seen.push({ payload: p.phase, statePhase: gameState.value.phase });
    swarm.bus.subscribe('phase_changed', onPhase);
    swarm.tick(0.05);
    swarm.bus.unsubscribe('phase_changed', onPhase);

    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(s.statePhase).toBe(s.payload);
  });

  it('every event raised in a tick sees the final post-tick state', () => {
    const base = createInitialState();
    gameState.value = {
      ...base,
      phase: Phase.EGG_LAYING,
      resources: { ...base.resources, workers: 10_000, eggs: 50, larvae: 50 },
      eggPipeline: { ...base.eggPipeline, count: 50 },
      larvaPipeline: { ...base.larvaPipeline, count: 50 },
    };
    const before = gameState.value;

    const seenStates: GameState[] = [];
    const record = () => seenStates.push(gameState.value);
    for (const name of EVENT_NAMES) swarm.bus.subscribe(name, record);
    swarm.tick(0.05);
    for (const name of EVENT_NAMES) swarm.bus.unsubscribe(name, record);

    expect(seenStates.length).toBeGreaterThan(0);
    expect(gameState.value).not.toBe(before);
    for (const s of seenStates) expect(s).toBe(gameState.value);
  });
});
