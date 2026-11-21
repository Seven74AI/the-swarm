import { describe, expect, it, vi } from 'vitest';
import { createCheats, MAX_SKIP_HOURS, type CheatDeps } from '../../../src/debug/cheats';
import { EventBus } from '../../../src/engine/EventBus';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';

/**
 * Story 1.34 (AR24): dev-build cheats on `window.__swarm.cheats`. Each one
 * writes the state once, with a spread (never in place), and raises its events
 * after that write.
 */

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

function setup(initial: GameState = makeState()) {
  let state = deepFreeze(initial);
  const writes: GameState[] = [];
  const bus = new EventBus();
  const catchUp = vi.fn((s: GameState, ms: number) => ({ ...s, stats: { ...s.stats, playTimeMs: s.stats.playTimeMs + ms } }));
  const deps: CheatDeps = {
    read: () => state,
    write: (next) => {
      writes.push(next);
      state = deepFreeze(next);
    },
    bus,
    fsm: new PhaseStateMachine(TRANSITIONS),
    catchUp,
  };
  return { cheats: createCheats(deps), writes, bus, catchUp, get state() { return state; } };
}

describe('addResources', () => {
  it('adds whole amounts in one write', () => {
    const t = setup();
    const before = t.state;
    expect(t.cheats.addResources({ food: 10.9, wood: 3 })).toEqual({ ok: true });
    expect(t.writes).toHaveLength(1);
    expect(t.state.resources.food).toBe(before.resources.food + 10);
    expect(t.state.resources.wood).toBe(before.resources.wood + 3);
    expect(Number.isInteger(t.state.resources.food)).toBe(true);
  });

  it('puts eggs and larvae in their pipelines too, so they hatch', () => {
    const t = setup();
    t.cheats.addResources({ eggs: 5, larvae: 4 });
    expect(t.state.eggPipeline.count).toBe(5);
    expect(t.state.resources.eggs).toBe(5);
    expect(t.state.larvaPipeline.count).toBe(4);
    expect(t.state.resources.larvae).toBe(4);
  });

  it('adds combat resources', () => {
    const t = setup();
    t.cheats.addResources({ chitin: 7 });
    expect(t.state.combatResources.chitin).toBe(7);
  });

  it('never goes below zero', () => {
    const t = setup(makeState({ resources: { food: 3 } }));
    t.cheats.addResources({ food: -10 });
    expect(t.state.resources.food).toBe(0);
  });

  it('refuses an unknown resource or a non-number, and writes nothing', () => {
    const t = setup();
    expect(t.cheats.addResources({ gold: 1 } as never)).toMatchObject({ ok: false });
    expect(t.cheats.addResources({ food: Number.NaN })).toMatchObject({ ok: false });
    expect(t.writes).toHaveLength(0);
  });
});

describe('setPhase', () => {
  it('moves forward through every phase in between, in one write, then raises phase_committed', () => {
    const t = setup();
    const seen: { from: string; to: string; phaseAtEmit: string }[] = [];
    t.bus.subscribe('phase_committed', ({ from, to }) => seen.push({ from, to, phaseAtEmit: t.state.phase }));
    expect(t.cheats.setPhase(Phase.COMBAT)).toEqual({ ok: true });
    expect(t.writes).toHaveLength(1);
    expect(t.state.phase).toBe(Phase.COMBAT);
    expect(t.state.phaseGoal).toBeNull();
    expect(seen.map((e) => e.to)).toEqual(PHASE_ORDER.slice(1, PHASE_ORDER.indexOf(Phase.COMBAT) + 1));
    // Listeners read the state the event describes: written before the flush.
    for (const e of seen) expect(e.phaseAtEmit).toBe(Phase.COMBAT);
  });

  it('reaches the last phase', () => {
    const t = setup();
    const last = PHASE_ORDER[PHASE_ORDER.length - 1];
    expect(t.cheats.setPhase(last)).toEqual({ ok: true });
    expect(t.state.phase).toBe(last);
  });

  it('refuses the current phase, an earlier one and an unknown one', () => {
    const t = setup(makeState({ phase: Phase.COMBAT }));
    expect(t.cheats.setPhase(Phase.COMBAT)).toMatchObject({ ok: false });
    expect(t.cheats.setPhase(Phase.COLONY)).toMatchObject({ ok: false });
    expect(t.cheats.setPhase('nowhere' as Phase)).toMatchObject({ ok: false });
    expect(t.writes).toHaveLength(0);
  });
});

describe('timeSkip', () => {
  it('runs the catch-up for N hours of game time and writes once', () => {
    const t = setup();
    const before = t.state.stats.playTimeMs;
    expect(t.cheats.timeSkip(2)).toEqual({ ok: true });
    expect(t.catchUp).toHaveBeenCalledTimes(1);
    expect(t.catchUp.mock.calls[0][1]).toBe(2 * 60 * 60 * 1000);
    expect(t.writes).toHaveLength(1);
    expect(t.state.stats.playTimeMs).toBeGreaterThan(before);
  });

  it('refuses zero, negative, non-finite and over-long skips', () => {
    const t = setup();
    for (const h of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, MAX_SKIP_HOURS + 1]) {
      expect(t.cheats.timeSkip(h)).toMatchObject({ ok: false });
    }
    expect(t.catchUp).not.toHaveBeenCalled();
    expect(t.writes).toHaveLength(0);
  });
});

describe('setSeed', () => {
  it('writes an unsigned 32-bit seed', () => {
    const t = setup();
    expect(t.cheats.setSeed(42)).toEqual({ ok: true });
    expect(t.state.seed).toBe(42);
    expect(t.writes).toHaveLength(1);
  });

  it('refuses anything that is not an unsigned 32-bit integer', () => {
    const t = setup();
    for (const bad of [-1, 1.5, 2 ** 32, Number.NaN]) expect(t.cheats.setSeed(bad)).toMatchObject({ ok: false });
    expect(t.writes).toHaveLength(0);
  });
});
