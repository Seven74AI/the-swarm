/**
 * Story 9.12 (FR66, UX-DR51): where the food comes from and where it goes.
 * The parts add up: IN − EATEN is the net WRKR shows.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { foodParts } from '../../../src/systems/ResourceSystem';
import { netFoodPerSec } from '../../../src/systems/Workforce';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';

const state = fc
  .record({
    gather: fc.integer({ min: 0, max: 300 }),
    tend: fc.integer({ min: 0, max: 300 }),
    dig: fc.integer({ min: 0, max: 300 }),
    free: fc.integer({ min: 0, max: 300 }),
    soldiers: fc.integer({ min: 0, max: 200 }),
    garden: fc.integer({ min: 0, max: 5 }),
    lean: fc.integer({ min: 0, max: 3 }),
  })
  .map((r) =>
    makeState({
      phase: Phase.COMBAT,
      resources: { workers: r.gather + r.tend + r.dig + r.free },
      workersAssigned: { gather: r.gather, tend: r.tend, dig: r.dig },
      combatSoldiers: r.soldiers,
      buildings: { fungus_garden: { level: r.garden } },
      upgrades: { lean_rations: r.lean },
    }),
  );

describe('foodParts', () => {
  it('IN − EATEN equals the net food rate WRKR shows (property)', () => {
    fc.assert(
      fc.property(state, (s) => {
        const p = foodParts(s);
        expect(p.in.total - p.eaten.total).toBeCloseTo(netFoodPerSec(s), 9);
      }),
    );
  });

  it('each side is the sum of its parts, and names its counts', () => {
    fc.assert(
      fc.property(state, (s) => {
        const p = foodParts(s);
        expect(p.in.gatherers + p.in.idle + p.in.territory).toBeCloseTo(p.in.total, 9);
        expect(p.eaten.workers + p.eaten.soldiers).toBeCloseTo(p.eaten.total, 9);
        expect(p.counts.gatherers).toBe(s.workersAssigned.gather);
        expect(p.counts.workers).toBe(s.resources.workers);
        for (const v of [p.in.gatherers, p.in.idle, p.eaten.workers, p.eaten.soldiers]) expect(v).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('one gatherer feeds a whole number of eaters, at least one', () => {
    const p = foodParts(makeState({ phase: Phase.COLONY, resources: { workers: 10 }, workersAssigned: { gather: 5 } }));
    expect(Number.isInteger(p.oneGathererFeeds)).toBe(true);
    expect(p.oneGathererFeeds).toBeGreaterThanOrEqual(1);
  });
});
