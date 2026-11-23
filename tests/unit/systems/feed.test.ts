/**
 * Story 9.4 (FR57, FR2): FEED hurries larvae into a free room. Invariants only.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { feedBrood, feedRefusal, freeRooms } from '../../../src/systems/Brood';
import { feedBalance } from '../../../src/data/balance/feed';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';
import { testActions } from '../helpers/actions';
import { gameState } from '../../../src/state/gameSignal';
import type { GameState } from '../../../src/state/GameState';

const initial = gameState.value;
afterEach(() => {
  gameState.value = initial;
});

const colony = (workers: number, cap: number, larvae: number, inPipe = larvae): GameState =>
  makeState({ phase: Phase.COLONY, resources: { workers, nestCapacity: cap, larvae }, larvaPipeline: { count: inPipe, progress: 0.3 } });

describe('FEED', () => {
  it('is refused in Egg Laying, with no free room, and with no larvae', () => {
    expect(feedRefusal({ ...colony(1, 10, 3), phase: Phase.EGG_LAYING })).toBe('locked');
    expect(feedRefusal(colony(10, 10, 3))).toBe('at_capacity');
    expect(feedRefusal(colony(1, 10, 0))).toBe('unavailable');
    expect(feedRefusal(colony(1, 10, 3))).toBeNull();
  });

  it('matures larvae into workers, never more than the free rooms, the fixed amount or the larvae (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 1, max: 300 }), fc.integer({ min: 0, max: 50 }), (workers, cap, larvae) => {
        const s = colony(workers, cap, larvae);
        if (feedRefusal(s) !== null) return;
        const after = feedBrood(s);
        const gained = after.resources.workers - s.resources.workers;
        expect(gained).toBeGreaterThan(0);
        expect(gained).toBeLessThanOrEqual(freeRooms(s));
        expect(gained).toBeLessThanOrEqual(feedBalance.larvaePerFeed);
        expect(after.resources.workers).toBeLessThanOrEqual(cap);
        // Every larva that leaves the pipeline becomes a worker.
        expect(s.resources.larvae - after.resources.larvae).toBe(gained);
        expect(s.larvaPipeline.count - after.larvaPipeline.count).toBe(gained);
        for (const v of [after.resources.workers, after.resources.larvae, after.larvaPipeline.count]) expect(Number.isInteger(v)).toBe(true);
        // It costs nothing.
        expect(after.resources.food).toBe(s.resources.food);
      }),
    );
  });

  it('counts the warehouse in the free rooms', () => {
    const s = { ...colony(10, 10, 3), buildings: { ...colony(10, 10, 3).buildings, warehouse: { level: 1 } } };
    expect(freeRooms(s)).toBeGreaterThan(0);
    expect(feedRefusal(s)).toBeNull();
  });

  it('the action writes once, or refuses and leaves the state', () => {
    const actions = testActions();
    gameState.value = colony(1, 10, 3);
    const before = gameState.value;
    expect(actions.feed().ok).toBe(true);
    expect(gameState.value.resources.workers).toBeGreaterThan(before.resources.workers);
    gameState.value = colony(10, 10, 3);
    const full = gameState.value;
    const r = actions.feed();
    expect(r.ok).toBe(false);
    expect(gameState.value).toBe(full);
  });
});
