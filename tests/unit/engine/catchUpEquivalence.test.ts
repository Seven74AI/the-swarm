// @ts-nocheck — fast-check type inference weak with noImplicitAny
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { catchUp, type CatchUpDeps } from '../../../src/engine/catchUp';
import { EventBus } from '../../../src/engine/EventBus';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { CATCH_UP_STEP_MS } from '../../../src/data/constants';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';

/**
 * Story 2.6 (AR4): the macro-stepped catch-up (`CATCH_UP_STEP_MS` steps) ends
 * where the fine-stepped one (50 ms game ticks) ends, within the step-length
 * tolerance Story 2.5 states for rates, on seeded random colonies.
 */

/** Relative tolerance for rate-driven amounts (Story 2.5's stated tolerance). */
const REL_TOLERANCE = 0.05;
/** Absolute slack for small amounts (one item either way of a floor). */
const ABS_TOLERANCE = 2;
const FINE_STEP_MS = 50;

function deps(): CatchUpDeps {
  const bus = new EventBus();
  const fsm = new PhaseStateMachine(TRANSITIONS);
  return {
    resourceSystem: new ResourceSystem(bus),
    soldierSystem: new SoldierSystem(bus),
    mapSystem: new MapSystem(),
    territorySystem: new TerritorySystem(),
    latch: (s) => fsm.latch(s),
  };
}

function arbitraryColony(): fc.Arbitrary<GameState> {
  return fc
    .record({
      workers: fc.integer({ min: 0, max: 60 }),
      food: fc.integer({ min: 0, max: 20_000 }),
      eggs: fc.integer({ min: 0, max: 60 }),
      larvae: fc.integer({ min: 0, max: 60 }),
      gatherShare: fc.integer({ min: 0, max: 100 }),
      tendShare: fc.integer({ min: 0, max: 100 }),
    })
    .map((r) => {
      const gather = Math.floor((r.workers * r.gatherShare) / 100);
      const tend = Math.floor(((r.workers - gather) * r.tendShare) / 100);
      return makeState({
        phase: 'colony',
        resources: { workers: r.workers, food: r.food, eggs: r.eggs, larvae: r.larvae },
        eggPipeline: { count: r.eggs, progress: 0 },
        larvaPipeline: { count: r.larvae, progress: 0 },
        workersAssigned: { gather, tend },
      });
    });
}

const close = (macro: number, fine: number): boolean =>
  Math.abs(macro - fine) <= Math.max(ABS_TOLERANCE, REL_TOLERANCE * Math.abs(fine));

describe('macro-stepped catch-up matches fine-stepped (Story 2.6)', () => {
  it('ends within tolerance on rates and keeps every integer invariant', () => {
    fc.assert(
      fc.property(arbitraryColony(), fc.integer({ min: 2, max: 30 }), (before, minutes) => {
        const ms = minutes * 60_000;
        const ticks = Math.floor(ms / FINE_STEP_MS);
        const macro = catchUp(before, ms, ticks, deps());
        const fine = catchUp(before, ms, ticks, deps(), FINE_STEP_MS);

        // Same game time passes either way.
        expect(macro.stats.playTimeMs).toBeCloseTo(fine.stats.playTimeMs, 3);

        for (const key of ['workers', 'food', 'eggs', 'larvae'] as const) {
          expect(close(macro.resources[key], fine.resources[key]), `${key}: macro ${macro.resources[key]} vs fine ${fine.resources[key]}`).toBe(true);
        }
        expect(close(macro.eggPipeline.count, fine.eggPipeline.count)).toBe(true);
        expect(close(macro.larvaPipeline.count, fine.larvaPipeline.count)).toBe(true);

        // Integer invariants hold on the macro-stepped result.
        for (const key of ['workers', 'eggs', 'larvae'] as const) {
          expect(Number.isInteger(macro.resources[key])).toBe(true);
          expect(macro.resources[key]).toBeGreaterThanOrEqual(0);
        }
        expect(macro.resources.food).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(macro.eggPipeline.count)).toBe(true);
        expect(Number.isInteger(macro.larvaPipeline.count)).toBe(true);
        expect(macro.phase).toBe(before.phase);
      }),
      { numRuns: 25, seed: 0x2606 },
    );
  });

  it('the macro-step is much longer than a game tick', () => {
    expect(CATCH_UP_STEP_MS / FINE_STEP_MS).toBeGreaterThanOrEqual(100);
  });
});
