// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultPolicy, type SimMove } from '../../src/sim/policy';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { Phase } from '../../src/phases/phases';
import { goalFor } from '../../src/phases/transitions';
import { getNextAction } from '../../src/systems/NextAction';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

const kinds = (moves: readonly SimMove[]) => moves.map((m) => m.kind);

/** A Colony state whose goal is met but for its guard. */
function colonyWithoutGuard(): GameState {
  const base = createInitialState();
  const s: GameState = { ...base, phase: Phase.COLONY };
  const workers = goalFor(Phase.COLONY)!.conditions.find((c) => c.id === 'workers')!.target(s);
  return {
    ...s,
    resources: { ...s.resources, workers, nestCapacity: workers * 4, food: 1_000_000 },
    workersAssigned: { ...s.workersAssigned, guard: 0 },
  };
}

/** Story 3.7 (AR15): the default player policy. */
describe('defaultPolicy', () => {
  it('is pure: never changes the state and answers the same state the same way', () => {
    const s = deepFreeze(colonyWithoutGuard());
    const a = defaultPolicy(s, { taps: 5 });
    const b = defaultPolicy(s, { taps: 5 });
    expect(a).toEqual(b);
  });

  it('lays eggs in Egg Laying with the turn’s taps, and not without them', () => {
    const s = createInitialState();
    expect(defaultPolicy(s, { taps: 7 })).toContainEqual({ kind: 'layEgg', taps: 7 });
    expect(kinds(defaultPolicy(s, { taps: 0 }))).not.toContain('layEgg');
  });

  it('keeps tapping after Egg Laying while the goal still needs workers (Story 3.11)', () => {
    const s = colonyWithoutGuard();
    const short = { ...s, resources: { ...s.resources, workers: s.resources.workers - 1, eggs: 0, larvae: 0 } };
    expect(defaultPolicy(short, { taps: 7 })).toContainEqual({ kind: 'layEgg', taps: 7 });
  });

  it('stops tapping after Egg Laying once the brood covers the workers the goal lacks', () => {
    const s = colonyWithoutGuard();
    const brood = { ...s, resources: { ...s.resources, workers: s.resources.workers - 2, eggs: 1, larvae: 1 } };
    expect(kinds(defaultPolicy(brood, { taps: 7 }))).not.toContain('layEgg');
  });

  it('keeps tapping in Egg Laying whatever the brood', () => {
    const s = createInitialState();
    const brood = { ...s, resources: { ...s.resources, eggs: 10_000, larvae: 10_000 } };
    expect(defaultPolicy(brood, { taps: 7 })).toContainEqual({ kind: 'layEgg', taps: 7 });
  });

  it('stops tapping once the goal has its workers', () => {
    expect(kinds(defaultPolicy(colonyWithoutGuard(), { taps: 7 }))).not.toContain('layEgg');
  });

  it('follows the next-action rule', () => {
    const s = colonyWithoutGuard();
    const next = getNextAction(s);
    expect(next.kind).toBe('act');
    if (next.kind === 'act') expect(defaultPolicy(s, { taps: 0 })).toContainEqual({ kind: 'intent', intent: next.intent });
  });

  it('puts a worker on GUARD when the goal needs a guard', () => {
    const moves = defaultPolicy(colonyWithoutGuard(), { taps: 0 });
    expect(moves.some((m) => (m.kind === 'stepRole' || m.kind === 'moveWorkers') && ('role' in m ? m.role : m.to) === 'guard')).toBe(true);
  });

  it('leaves GUARD alone once the goal has its guard', () => {
    const s = colonyWithoutGuard();
    const guarded = { ...s, workersAssigned: { ...s.workersAssigned, guard: 1 } };
    const moves = defaultPolicy(guarded, { taps: 0 });
    expect(moves.some((m) => m.kind === 'stepRole' && m.role === 'guard')).toBe(false);
  });

  it('trains soldiers in Combat when it has none, and fights once it has an army', () => {
    const base = createInitialState();
    const s: GameState = {
      ...base,
      phase: Phase.COMBAT,
      resources: { ...base.resources, workers: 200, nestCapacity: 800, food: 1_000_000 },
      combatSoldiers: 0,
    };
    expect(kinds(defaultPolicy(s, { taps: 0 }))).toContain('trainSoldier');
    const army = { ...s, combatSoldiers: 1_000 };
    expect(kinds(defaultPolicy(army, { taps: 0 }))).toContain('fight');
  });

  it('never prestiges and never answers a decision', () => {
    const s = colonyWithoutGuard();
    for (const m of defaultPolicy(s, { taps: 3 })) {
      if (m.kind === 'intent') expect(m.intent.action).not.toMatch(/prestige|decision/i);
    }
  });
});
