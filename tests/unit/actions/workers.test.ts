import { describe, it, expect } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { Phase } from '../../../src/phases/phases';
import type { GameState } from '../../../src/state/GameState';
import { freeWorkers, roleCount, workforceTotal } from '../../../src/systems/Workforce';
import { testActions } from '../helpers/actions';
import { makeState, type StateOverrides } from '../helpers/makeState';

/** Story 1.23: WRKR's steppers and its primary action go through one action each, one write per press. */
function setup(over: StateOverrides = {}) {
  let state: GameState = makeState({ phase: Phase.COLONY, resources: { workers: 10, food: 100 }, ...over });
  let writes = 0;
  const bus = new EventBus();
  const actions = testActions(bus, () => state, (s) => {
    state = s;
    writes++;
  });
  return { actions, bus, get: () => state, writes: () => writes };
}

describe('actions.stepRole', () => {
  it('applies a whole step in one write', () => {
    const t = setup();
    const before = t.get();
    expect(t.actions.stepRole('gather', 4)).toEqual({ ok: true });
    expect(t.writes()).toBe(1);
    expect(roleCount(t.get(), 'gather')).toBe(roleCount(before, 'gather') + 4);
    expect(t.actions.stepRole('gather', -4)).toEqual({ ok: true });
    expect(roleCount(t.get(), 'gather')).toBe(roleCount(before, 'gather'));
  });

  it('refuses with no_free_workers past the free pool, and writes nothing', () => {
    const t = setup();
    const r = t.actions.stepRole('tend', freeWorkers(t.get()) + 1);
    expect(r).toEqual({ ok: false, reason: 'no_free_workers' });
    expect(t.writes()).toBe(0);
  });

  it('refuses with none_assigned below zero', () => {
    const t = setup({ workersAssigned: { dig: 1 } });
    expect(t.actions.stepRole('dig', -2)).toEqual({ ok: false, reason: 'none_assigned' });
    expect(t.writes()).toBe(0);
  });

  it('steps the researcher pool, which keeps the workforce whole', () => {
    const t = setup();
    const total = workforceTotal(t.get());
    expect(t.actions.stepRole('research', 2).ok).toBe(true);
    expect(roleCount(t.get(), 'research')).toBe(2);
    expect(workforceTotal(t.get())).toBe(total);
  });

  it('raises workers_assigned after the write for a job role', () => {
    const t = setup();
    const seen: number[] = [];
    t.bus.subscribe('workers_assigned', ({ assigned }) => seen.push(assigned.gather));
    t.actions.stepRole('gather', 3);
    expect(seen).toEqual([t.get().workersAssigned.gather]);
  });
});

describe('actions.moveWorkers', () => {
  it('moves between roles in one write and keeps the free pool', () => {
    const t = setup({ workersAssigned: { tend: 5 } });
    const free = freeWorkers(t.get());
    expect(t.actions.moveWorkers('tend', 'gather', 3)).toEqual({ ok: true });
    expect(t.writes()).toBe(1);
    expect(roleCount(t.get(), 'tend')).toBe(2);
    expect(freeWorkers(t.get())).toBe(free);
  });

  it('refuses a move it cannot make', () => {
    const t = setup({ workersAssigned: { tend: 1 } });
    expect(t.actions.moveWorkers('tend', 'gather', 2)).toEqual({ ok: false, reason: 'none_assigned' });
    expect(t.actions.moveWorkers('free', 'gather', 100)).toEqual({ ok: false, reason: 'no_free_workers' });
    expect(t.actions.moveWorkers('tend', 'tend', 1)).toEqual({ ok: false, reason: 'unavailable' });
    expect(t.writes()).toBe(0);
  });
});

describe('actions.assignResearcher', () => {
  it('refuses when every worker already has a job (no free workers)', () => {
    const t = setup({ resources: { workers: 3 }, workersAssigned: { gather: 3 } });
    expect(t.actions.assignResearcher()).toEqual({ ok: false, reason: 'no_free_workers' });
    expect(t.writes()).toBe(0);
  });
});
