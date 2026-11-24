import { decisionBalance } from '../../../src/data/balance/decisions';
import { describe, it, expect } from 'vitest';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { crowdedPercent, getCrowding } from '../../../src/systems/Crowding';
import { computeResourceRates } from '../../../src/systems/ResourceSystem';
import { diggerPointsPerSec, nextRoom, pressChunk } from '../../../src/systems/Dig';
import { digBalance } from '../../../src/data/balance/dig';
import { isEligible } from '../../../src/systems/DecisionSystem';
import { DECISIONS } from '../../../src/data/content/decisions';
import { GameLoop } from '../../../src/engine/GameLoop';
import { Ticker } from '../../../src/engine/Ticker';
import { Phase } from '../../../src/phases/phases';
import { PERCENT } from '../../../src/data/constants';
import { crowdingBalance } from '../../../src/data/balance/crowding';

/**
 * Story 9.13: the crowding multiplier replaces the old worker-count scale
 * penalty wherever work is done, and also slows the diggers. Comparisons only:
 * a crowded nest against the same nest with room to spare.
 */

/** A Colony nest of `workers` on roles, with `eggs` brood; `capacity` rooms of space. */
function nest(workers: number, eggs: number, capacity: number): GameState {
  const s = createInitialState();
  const share = Math.floor(workers / 4);
  return {
    ...s,
    phase: Phase.COMBAT,
    resources: { ...s.resources, workers, eggs, nestCapacity: capacity, food: 1000 },
    eggPipeline: { count: eggs, progress: 0 },
    workersAssigned: { ...s.workersAssigned, gather: share, forage: share, dig: share },
  };
}

const roomy = nest(400, 0, 2000);
const crowded = nest(400, 600, 400);

describe('Story 9.13: crowding slows work', () => {
  it('the test nests are what they say', () => {
    expect(getCrowding(roomy).multiplier).toBe(1);
    expect(getCrowding(crowded).multiplier).toBeLessThan(1);
  });

  it('slows food, wood, stone and nectar from the roles', () => {
    const a = computeResourceRates(roomy);
    const b = computeResourceRates(crowded);
    expect(b.foodProducedPerSec).toBeLessThan(a.foodProducedPerSec);
    expect(b.woodPerSec).toBeLessThan(a.woodPerSec);
    expect(b.stonePerSec).toBeLessThan(a.stonePerSec);
    expect(b.nectarPerSec).toBeLessThan(a.nectarPerSec);
  });

  it('slows them by the crowding multiplier, exactly', () => {
    const a = computeResourceRates(roomy);
    const b = computeResourceRates(crowded);
    const m = getCrowding(crowded).multiplier;
    expect(b.foodProducedPerSec).toBeCloseTo(a.foodProducedPerSec * m, 9);
    expect(b.stonePerSec).toBeCloseTo(a.stonePerSec * m, 9);
  });

  it('never cuts the upkeep: a crowded colony eats as much', () => {
    expect(computeResourceRates(crowded).foodConsumedPerSec).toBe(computeResourceRates(roomy).foodConsumedPerSec);
  });

  it('a colony of thousands that fits its rooms works at full rate per worker (no scale penalty left)', () => {
    const small = nest(400, 0, 20_000);
    const big = nest(8000, 0, 20_000);
    const perWorker = (s: GameState) => computeResourceRates(s).stonePerSec / s.workersAssigned.dig;
    expect(perWorker(big)).toBeCloseTo(perWorker(small), 9);
  });

  it('slows the diggers’ own dig points', () => {
    expect(diggerPointsPerSec(crowded)).toBeLessThan(diggerPointsPerSec(roomy));
  });

  it('never slows a press’s own chunk, only the diggers’ share of it', () => {
    const noDiggers = (s: GameState): GameState => ({ ...s, workersAssigned: { ...s.workersAssigned, dig: 0 } });
    expect(pressChunk(noDiggers(crowded))).toBe(pressChunk(noDiggers(roomy)));
    expect(pressChunk(crowded)).toBeGreaterThanOrEqual(digBalance.pressPoints);
    expect(pressChunk(crowded)).toBeLessThan(pressChunk(roomy));
  });

  it('the Legacy worker-efficiency node still multiplies work', () => {
    const legacy: GameState = { ...crowded, prestigeTree: { ...crowded.prestigeTree, purchased: ['worker_efficiency_bonus'] } };
    expect(computeResourceRates(legacy).stonePerSec).toBeGreaterThan(computeResourceRates(crowded).stonePerSec);
  });

  it('GameLoop reports the crowding multiplier as the work rate', () => {
    const loop = new GameLoop(new Ticker());
    expect(loop.getWorkerEfficiency(crowded)).toBe(getCrowding(crowded).multiplier);
    expect(loop.getWorkerEfficiency(roomy)).toBe(1);
  });

  it('OVERCROWDING. may spawn only while crowding bites, and (Story 9.18) costs at least its share of the work', () => {
    const def = DECISIONS.find((d) => d.id === 'overcrowding');
    expect(def).toBeDefined();
    // Brood fifteen times the room space: crowding costs well over the share.
    const swamped = nest(400, 6_000, 400);
    expect(crowdedPercent(swamped)).toBeGreaterThanOrEqual(decisionBalance.overcrowdingMinWorkPercent);
    expect(isEligible(swamped, def!)).toBe(true);
    expect(isEligible(roomy, def!)).toBe(false);
    // A nest whose workers fill it but whose brood does not overflow it: crowding does not bite, so no event.
    expect(isEligible(nest(400, 0, 400), def!)).toBe(false);
    // Crowding that bites but costs little (the test nest `crowded`): no event either.
    const light = crowded;
    expect(crowdedPercent(light)).not.toBeNull();
    expect(crowdedPercent(light)!).toBeLessThan(decisionBalance.overcrowdingMinWorkPercent);
    expect(isEligible(light, def!)).toBe(false);
  });

  it('NEXT ROOM reads the work lost as a whole percent while crowded, and nothing otherwise', () => {
    expect(nextRoom(roomy).crowdedPercent).toBeNull();
    const pct = nextRoom(crowded).crowdedPercent;
    expect(pct).not.toBeNull();
    expect(Number.isInteger(pct)).toBe(true);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(PERCENT - crowdingBalance.floor * PERCENT);
    // More crowded, never a smaller loss.
    expect(nextRoom(nest(400, 1200, 400)).crowdedPercent).toBeGreaterThanOrEqual(pct!);
  });
});
