import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { catchUp, catchUpWithReport, type CatchUpDeps } from '../../../src/engine/catchUp';
import { resume } from '../../../src/engine/resume';
import { EventBus } from '../../../src/engine/EventBus';
import { ResourceSystem, computeResourceRates } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { RESUME_FULL_EFFICIENCY_MS } from '../../../src/data/constants';
import { getOfflineCapMs } from '../../../src/systems/OfflineProgression';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';

/**
 * Story 2.9: catch-up records how long upkeep outran food (the summary's
 * `UPKEEP OUTRAN FOOD FOR <time>.` line). The measure lives inside catch-up,
 * not at its call sites, and the state it returns is the same as `catchUp`'s.
 */

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

/** Every worker tends: nothing gathers, upkeep eats the stock. */
function hungry(food: number, workers = 20): GameState {
  return makeState({
    phase: 'colony',
    resources: { workers, food, nestCapacity: 1000 },
    workersAssigned: { gather: 0, tend: workers, dig: 0, guard: 0 },
  });
}

/** Every worker gathers: food only grows. */
function fed(food: number, workers = 20): GameState {
  return makeState({
    phase: 'colony',
    resources: { workers, food, nestCapacity: 1000 },
    workersAssigned: { gather: workers, tend: 0, dig: 0, guard: 0 },
  });
}

/** Ms until `s`'s stock runs out at its starting rates (Infinity when it never does). */
function msToEmpty(s: GameState): number {
  const r = computeResourceRates(s, new TerritorySystem().getBonuses(s));
  const net = r.foodProducedPerSec - r.foodConsumedPerSec;
  return net < 0 ? ((s.resources.food + s.resourceRemainder.food) / -net) * 1000 : Infinity;
}

const HOUR = 3_600_000;

describe('catch-up measures how long food stayed at zero (Story 2.9)', () => {
  it('returns the same state as catchUp', () => {
    const s = hungry(100);
    // The map is drawn at random on the first step (until Story 3.1 seeds it): compare the rest.
    const { mapTiles: _a, ...state } = catchUpWithReport(s, HOUR, HOUR / 50, deps()).state;
    const { mapTiles: _b, ...plain } = catchUp(s, HOUR, HOUR / 50, deps());
    expect(state).toEqual(plain);
  });

  it('is zero while food never runs out', () => {
    const { report } = catchUpWithReport(fed(10), HOUR, HOUR / 50, deps());
    expect(report.starvedMs).toBe(0);
  });

  it('is the time after the stock ran out, when upkeep outran it', () => {
    const s = hungry(100);
    const { state, report } = catchUpWithReport(s, HOUR, HOUR / 50, deps());
    expect(state.resources.food).toBe(0);
    expect(report.starvedMs).toBeGreaterThan(0);
    expect(report.starvedMs).toBeLessThan(HOUR);
    // Within a second of "the absence minus the time the stock lasted".
    expect(Math.abs(report.starvedMs - (HOUR - msToEmpty(s)))).toBeLessThanOrEqual(1000);
  });

  it('is the whole absence when there was nothing to eat from the start', () => {
    const { report } = catchUpWithReport(hungry(0), HOUR, HOUR / 50, deps());
    expect(report.starvedMs).toBe(HOUR);
  });

  it('is zero when the stock outlasts the absence', () => {
    const s = hungry(1_000_000);
    expect(msToEmpty(s)).toBeGreaterThan(HOUR);
    expect(catchUpWithReport(s, HOUR, HOUR / 50, deps()).report.starvedMs).toBe(0);
  });

  it('is a whole number of ms, never negative, never more than the simulated absence, and grows with it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 30 * HOUR }),
        (food, tend, gather, ms) => {
          const s = makeState({
            phase: 'colony',
            resources: { workers: tend + gather, food, nestCapacity: 1000 },
            workersAssigned: { gather, tend, dig: 0, guard: 0 },
          });
          const capped = Math.min(ms, getOfflineCapMs(s));
          const a = catchUpWithReport(s, ms, 0, deps()).report.starvedMs;
          const b = catchUpWithReport(s, ms + HOUR, 0, deps()).report.starvedMs;
          expect(Number.isInteger(a)).toBe(true);
          expect(a).toBeGreaterThanOrEqual(0);
          expect(a).toBeLessThanOrEqual(capped);
          expect(b).toBeGreaterThanOrEqual(a);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('reaches the summary through resume, on the offline path only', () => {
    const offline = resume(hungry(10), 2 * HOUR, deps());
    expect(offline.offline?.starvedMs).toBeGreaterThan(0);
    const short = resume(hungry(10), RESUME_FULL_EFFICIENCY_MS - 1000, deps());
    expect(short.offline).toBeNull();
  });
});
