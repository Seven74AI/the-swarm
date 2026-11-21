import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getNextAction, getReturnMove, workersOpen } from '../../../src/systems/NextAction';
import { getAssignedWorkers } from '../../../src/systems/ResourceSystem';
import { PANEL_PLACEMENT } from '../../../src/data/content/tabs';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';
import { testActions } from '../helpers/actions';
import { EventBus } from '../../../src/engine/EventBus';

/**
 * Story 2.9 (FR27, UX-DR24): the offline summary's next move is the next-action
 * rule's (`getNextAction`, Story 1.21) and is never empty: an action, or
 * `NEXT AFFORDABLE: <item> IN ~<time>`; when the rule has neither, an
 * allocation change the player can make, or (with no worker to move) laying an egg.
 */

function perform(s: GameState, intent: Parameters<ReturnType<typeof testActions>['perform']>[0]) {
  let cur = s;
  const actions = testActions(new EventBus(), () => cur, (n) => {
    cur = n;
  });
  return actions.perform(intent);
}

/** Any state a player could come back to, roughly: any phase, stocks, workers and jobs. */
const anyState = fc
  .record({
    phase: fc.constantFrom(...PHASE_ORDER),
    food: fc.integer({ min: 0, max: 100_000 }),
    wood: fc.integer({ min: 0, max: 5_000 }),
    stone: fc.integer({ min: 0, max: 5_000 }),
    nectar: fc.integer({ min: 0, max: 5_000 }),
    workers: fc.integer({ min: 0, max: 200 }),
    nestCapacity: fc.integer({ min: 1, max: 500 }),
    jobs: fc.tuple(fc.nat(60), fc.nat(60), fc.nat(60), fc.nat(5)),
    chitin: fc.integer({ min: 0, max: 500 }),
    silk: fc.integer({ min: 0, max: 500 }),
  })
  .map((r) => {
    // Jobs never exceed the workers.
    let left = r.workers;
    const take = (n: number) => {
      const t = Math.min(n, left);
      left -= t;
      return t;
    };
    const [gather, tend, dig, guard] = r.jobs.map(take);
    return makeState({
      phase: r.phase,
      resources: { food: r.food, wood: r.wood, stone: r.stone, nectar: r.nectar, workers: r.workers, nestCapacity: r.nestCapacity },
      workersAssigned: { gather, tend, dig, guard },
      combatResources: { chitin: r.chitin, silk: r.silk },
    });
  });

describe('getReturnMove (Story 2.9)', () => {
  it('is the next-action suggestion when the rule has one', () => {
    const s = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1_000_000 } });
    const next = getNextAction(s);
    expect(next.kind).toBe('act');
    const move = getReturnMove(s);
    expect(move.kind).toBe('act');
    if (move.kind === 'act' && next.kind === 'act') {
      expect(move.key).toBe(next.key);
      expect(move.verb).toBe(next.verb);
      expect(move.panel).toBe(next.panel);
    }
  });

  it("is the rule's NEXT AFFORDABLE item when nothing is affordable but something is reachable", () => {
    const s = makeState({
      phase: Phase.COLONY,
      resources: { workers: 10, food: 0, nestCapacity: 1000 },
      workersAssigned: { gather: 10 },
    });
    const next = getNextAction(s);
    expect(next.kind === 'none' && next.nextAffordable).toBeTruthy();
    const move = getReturnMove(s);
    expect(move.kind).toBe('wait');
    if (move.kind === 'wait' && next.kind === 'none') {
      expect(move.name).toBe(next.nextAffordable!.name);
      expect(move.inSec).toBe(next.nextAffordable!.inSec);
    }
  });

  it('with nothing reachable and workers to move, offers an allocation change the action accepts', () => {
    // One guard, the minimum the rule keeps: no income, no fix, nothing affordable or reachable.
    const s = makeState({
      phase: Phase.COLONY,
      resources: { workers: 1, food: 0, nestCapacity: 1000 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 1 },
    });
    const next = getNextAction(s);
    expect(next.kind === 'none' && next.nextAffordable === null).toBe(true);
    const move = getReturnMove(s);
    expect(move.kind).toBe('act');
    if (move.kind !== 'act') return;
    expect(PANEL_PLACEMENT[move.panel].tab).toBe('wrkr');
    expect(move.intent).toBeDefined();
    expect(perform(s, move.intent!)).toEqual({ ok: true });
  });

  it('with nothing reachable and no worker to move, offers laying an egg on NEST', () => {
    const s = makeState({ phase: Phase.EGG_LAYING, resources: { workers: 0, food: 0 } });
    const move = getReturnMove(s);
    expect(move.kind).toBe('act');
    if (move.kind !== 'act') return;
    expect(PANEL_PLACEMENT[move.panel].tab).toBe('nest');
    expect(move.verb).toMatch(/\S/);
  });

  it('is never empty, for any state (property)', () => {
    fc.assert(
      fc.property(anyState, (s) => {
        const move = getReturnMove(s);
        if (move.kind === 'wait') {
          expect(move.name).toMatch(/\S/);
          expect(Number.isInteger(move.inSec) && move.inSec > 0).toBe(true);
          return;
        }
        expect(move.verb).toMatch(/\S/);
        expect(PANEL_PLACEMENT[move.panel]).toBeDefined();
        // An allocation change is offered only where workers can be moved, and the action takes it.
        if (move.intent && (move.intent.action === 'assignWorker' || move.intent.action === 'unassignWorker')) {
          expect(workersOpen(s)).toBe(true);
          expect(perform(s, move.intent)).toEqual({ ok: true });
        }
        if (move.rule === 'fallback' && move.intent?.action === 'assignWorker') {
          expect(s.resources.workers - getAssignedWorkers(s)).toBeGreaterThan(0);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('never changes the state', () => {
    const s = makeState({ phase: Phase.COLONY, resources: { workers: 3 } });
    const snap = JSON.stringify(s);
    getReturnMove(s);
    expect(JSON.stringify(s)).toBe(snap);
  });
});
