import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { getCrowding, roomSpace } from '../../../src/systems/Crowding';
import { crowdingBalance } from '../../../src/data/balance/crowding';
import { getEffects } from '../../../src/systems/BuildingSystem';
import { Phase } from '../../../src/phases/phases';

/**
 * Story 9.13 (FR60): crowding. Every creature that takes up room (workers,
 * researchers, soldiers, scouts, warriors, eggs, larvae; never the queen)
 * against the room space (the effective nest capacity). Work runs at 1 while
 * they fit, then falls with the overfill share, never below the floor.
 */

interface Counts {
  workers: number;
  researchers: number;
  soldiers: number;
  training: number;
  scouts: number;
  warriors: number;
  eggs: number;
  larvae: number;
  capacity: number;
  warehouse: number;
}

function stateOf(c: Counts): GameState {
  const s = createInitialState();
  return {
    ...s,
    phase: Phase.COMBAT,
    resources: { ...s.resources, workers: c.workers, eggs: c.eggs, larvae: c.larvae, nestCapacity: c.capacity },
    eggPipeline: { count: c.eggs, progress: 0 },
    larvaPipeline: { count: c.larvae, progress: 0 },
    workersAssigned: { ...s.workersAssigned, researchers: c.researchers },
    combatSoldiers: c.soldiers,
    soldierPipeline: { count: c.training, progress: 0 },
    soldiers: { ...s.soldiers, scouts: c.scouts, warriors: c.warriors },
    buildings: { ...s.buildings, warehouse: { level: c.warehouse } },
  };
}

const n = (max: number) => fc.integer({ min: 0, max });
const arbCounts: fc.Arbitrary<Counts> = fc.record({
  workers: n(3000),
  researchers: n(200),
  soldiers: n(500),
  training: n(100),
  scouts: n(50),
  warriors: n(50),
  eggs: n(1000),
  larvae: n(1000),
  capacity: n(4000),
  warehouse: n(3),
});
const KINDS: (keyof Counts)[] = ['workers', 'researchers', 'soldiers', 'training', 'scouts', 'warriors', 'eggs', 'larvae'];
const OPTS = { seed: 913, numRuns: 300 };

describe('Story 9.13: getCrowding', () => {
  it('counts every creature that takes up room, never the queen', () => {
    fc.assert(
      fc.property(arbCounts, (c) => {
        const crowd = getCrowding(stateOf(c));
        expect(crowd.creatures).toBe(KINDS.reduce((sum, k) => sum + c[k], 0));
      }),
      OPTS,
    );
  });

  it('reads the room space as the effective nest capacity, the Warehouse included', () => {
    fc.assert(
      fc.property(arbCounts, (c) => {
        const s = stateOf(c);
        expect(roomSpace(s)).toBe(c.capacity + (getEffects('warehouse', c.warehouse).nestCapacity ?? 0));
        expect(getCrowding(s).space).toBe(roomSpace(s));
      }),
      OPTS,
    );
  });

  it('keeps the multiplier in [floor, 1], and exactly 1 while the creatures fit', () => {
    fc.assert(
      fc.property(arbCounts, (c) => {
        const crowd = getCrowding(stateOf(c));
        expect(crowd.multiplier).toBeGreaterThanOrEqual(crowdingBalance.floor);
        expect(crowd.multiplier).toBeLessThanOrEqual(1);
        if (crowd.creatures <= crowd.space) {
          expect(crowd.multiplier).toBe(1);
          expect(crowd.overfill).toBe(0);
        } else {
          expect(crowd.multiplier).toBeLessThan(1);
          expect(crowd.overfill).toBe(crowd.creatures - crowd.space);
        }
      }),
      OPTS,
    );
  });

  it('never rises when a creature of any kind is added', () => {
    fc.assert(
      fc.property(arbCounts, fc.constantFrom(...KINDS), fc.integer({ min: 1, max: 500 }), (c, kind, more) => {
        const before = getCrowding(stateOf(c)).multiplier;
        const after = getCrowding(stateOf({ ...c, [kind]: c[kind] + more })).multiplier;
        expect(after).toBeLessThanOrEqual(before);
      }),
      OPTS,
    );
  });

  it('never falls when room space is added (a room, or a Warehouse level)', () => {
    fc.assert(
      fc.property(arbCounts, fc.integer({ min: 1, max: 500 }), (c, rooms) => {
        const before = getCrowding(stateOf(c)).multiplier;
        expect(getCrowding(stateOf({ ...c, capacity: c.capacity + rooms })).multiplier).toBeGreaterThanOrEqual(before);
        expect(getCrowding(stateOf({ ...c, warehouse: c.warehouse + 1 })).multiplier).toBeGreaterThanOrEqual(before);
      }),
      OPTS,
    );
  });

  it('reaches the floor for a nest packed far past its rooms, and no lower', () => {
    const packed = getCrowding(stateOf({ workers: 10, researchers: 0, soldiers: 0, training: 0, scouts: 0, warriors: 0, eggs: 100_000, larvae: 0, capacity: 10, warehouse: 0 }));
    expect(packed.multiplier).toBe(crowdingBalance.floor);
  });
});
