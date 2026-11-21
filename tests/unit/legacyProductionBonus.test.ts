import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { PHASE_ORDER } from '../../src/phases/phases';
import { PRESTIGE_UPGRADES, type PrestigeUpgradeId } from '../../src/data/prestigeTree';
import { prestigeBalance } from '../../src/data/balance/prestige';
import { progressionBalance } from '../../src/data/balance/progression';
import { ENTROPY_MAX, calculateEntropyPrestigeBonus } from '../../src/systems/EntropySystem';
import {
  calculateLegacyPoints,
  getPhaseScore,
  legacyPointsAward,
  prestige,
  purchasePrestigeUpgrade,
} from '../../src/systems/PrestigeSystem';
import { productionMultiplier, productionMultiplierFor } from '../../src/engine/ProgressionCurve';
import { computeResourceRates } from '../../src/systems/ResourceSystem';
import { EventBus } from '../../src/engine/EventBus';
import { GameLoop } from '../../src/engine/GameLoop';
import { Ticker } from '../../src/engine/Ticker';
import { testActions } from './helpers/actions';

/**
 * Story 5.2 (FR29): the production bonus counts every Legacy Point ever
 * earned (`prestige.lifetimeLpEarned`), not the points still held, so buying a
 * Legacy upgrade never lowers it. No number here is spelled: constants come
 * from `data/balance/`.
 */

const IDS: PrestigeUpgradeId[] = PRESTIGE_UPGRADES.map((u) => u.id);
const costOf = (id: string): number => PRESTIGE_UPGRADES.find((u) => u.id === id)!.cost;
const maxCost = Math.max(...PRESTIGE_UPGRADES.map((u) => u.cost));

/** Any state a player could hold: a phase, LP held, LP spent on bought nodes, lifetime food, entropy. */
const anyState: fc.Arbitrary<GameState> = fc
  .record({
    phase: fc.constantFrom(...PHASE_ORDER),
    held: fc.integer({ min: 0, max: maxCost * 4 }),
    purchased: fc.subarray(IDS),
    food: fc.integer({ min: 0, max: 1e12 }),
    entropy: fc.integer({ min: 0, max: ENTROPY_MAX }),
    gather: fc.integer({ min: 0, max: 50 }),
    count: fc.integer({ min: 0, max: 20 }),
  })
  .map(({ phase, held, purchased, food, entropy, gather, count }) => {
    const base = createInitialState();
    const spent = purchased.reduce((sum, id) => sum + costOf(id), 0);
    return {
      ...base,
      phase,
      entropy,
      resources: { ...base.resources, workers: gather },
      workersAssigned: { ...base.workersAssigned, gather },
      prestige: { ...base.prestige, count, legacyPoints: held, lifetimeLpEarned: held + spent, totalFoodProduced: food },
      prestigeTree: { purchased },
    };
  });

describe('a Legacy purchase never changes the production multiplier', () => {
  it('holds for any state and any purchase sequence (system and action)', () => {
    let bought = 0;
    fc.assert(
      fc.property(anyState, fc.array(fc.constantFrom(...IDS), { maxLength: IDS.length }), (start, ids) => {
        let s = start;
        let viaAction = start;
        const actions = testActions(new EventBus(), () => viaAction, (n) => void (viaAction = n));
        for (const id of ids) {
          const before = productionMultiplierFor(s);
          const next = purchasePrestigeUpgrade(s, id);
          const viaBefore = viaAction;
          const r = actions.buyPrestigeUpgrade(id);
          if (next) {
            bought++;
            expect(next.prestige.legacyPoints).toBeLessThan(s.prestige.legacyPoints);
            expect(next.prestige.lifetimeLpEarned).toBe(s.prestige.lifetimeLpEarned);
            expect(productionMultiplierFor(next)).toBe(before);
            s = next;
          }
          if (r.ok) expect(productionMultiplierFor(viaAction)).toBe(productionMultiplierFor(viaBefore));
        }
      }),
      { numRuns: 300 },
    );
    expect(bought).toBeGreaterThan(0);
  });

  it('spending LP alone leaves every production rate unchanged', () => {
    fc.assert(
      fc.property(anyState, fc.integer({ min: 0, max: maxCost * 4 }), (s, other) => {
        const fewer = { ...s, prestige: { ...s.prestige, legacyPoints: Math.min(other, s.prestige.legacyPoints) } };
        expect(computeResourceRates(fewer)).toEqual(computeResourceRates(s));
      }),
      { numRuns: 100 },
    );
  });
});

describe('the multiplier counts lifetime LP', () => {
  it('is productionMultiplier at lifetimeLpEarned, whatever is held', () => {
    fc.assert(
      fc.property(anyState, (s) => {
        expect(productionMultiplierFor(s)).toBe(productionMultiplier(s.phase, s.prestige.lifetimeLpEarned));
        expect(new GameLoop(new Ticker()).getProductionMultiplier(s)).toBe(productionMultiplierFor(s));
      }),
      { numRuns: 100 },
    );
  });

  it('each lifetime LP adds productionPerLegacyPoint of the phase base', () => {
    for (const phase of PHASE_ORDER) {
      const base = productionMultiplier(phase, 0);
      for (const lp of [0, 1, 7, 40]) {
        const step = productionMultiplier(phase, lp + 1) - productionMultiplier(phase, lp);
        expect(step / base).toBeCloseTo(progressionBalance.productionPerLegacyPoint, 9);
      }
    }
  });

  it('more lifetime LP means more food from the same gatherers', () => {
    const s = createInitialState();
    const worked = { ...s, resources: { ...s.resources, workers: 10 }, workersAssigned: { ...s.workersAssigned, gather: 10 } };
    const earned = { ...worked, prestige: { ...worked.prestige, lifetimeLpEarned: 5 } };
    expect(computeResourceRates(earned).foodProducedPerSec).toBeGreaterThan(computeResourceRates(worked).foodProducedPerSec);
  });
});

describe('a prestige raises lifetimeLpEarned by its award', () => {
  it('the award is the food formula plus the entropy bonus, added to held and lifetime alike', () => {
    fc.assert(
      fc.property(anyState, (s) => {
        const award = legacyPointsAward(s);
        expect(award).toBe(
          calculateLegacyPoints(s.prestige.totalFoodProduced, getPhaseScore(s.phase)) + calculateEntropyPrestigeBonus(s),
        );
        expect(Number.isInteger(award) && award >= 0).toBe(true);
        const next = prestige(s);
        expect(next.prestige.lifetimeLpEarned - s.prestige.lifetimeLpEarned).toBe(award);
        expect(next.prestige.legacyPoints - s.prestige.legacyPoints).toBe(award);
      }),
      { numRuns: 200 },
    );
  });

  it('food LP is floor(log10(food) × phaseScore / divisor), none below the minimum food', () => {
    const { minFood, phaseScoreDivisor } = prestigeBalance.lp;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e12 }), fc.constantFrom(...PHASE_ORDER), (food, phase) => {
        const score = getPhaseScore(phase);
        const expected = food < minFood ? 0 : Math.floor((Math.log10(food) * score) / phaseScoreDivisor);
        expect(calculateLegacyPoints(food, score)).toBe(expected);
      }),
    );
  });

  it('entropy adds LP only at full entropy, entropyLpPerPoint per point', () => {
    const s = createInitialState();
    expect(calculateEntropyPrestigeBonus({ ...s, entropy: ENTROPY_MAX - 1 })).toBe(0);
    expect(calculateEntropyPrestigeBonus({ ...s, entropy: ENTROPY_MAX })).toBe(
      Math.floor(ENTROPY_MAX * prestigeBalance.lp.entropyLpPerPoint),
    );
  });

  it('a later phase or more food never awards less', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e11 }), fc.integer({ min: 0, max: 1e11 }), (a, b) => {
        for (let i = 0; i < PHASE_ORDER.length; i++) {
          const score = getPhaseScore(PHASE_ORDER[i]);
          expect(calculateLegacyPoints(a + b, score)).toBeGreaterThanOrEqual(calculateLegacyPoints(a, score));
          if (i > 0) expect(calculateLegacyPoints(a, score)).toBeGreaterThanOrEqual(calculateLegacyPoints(a, getPhaseScore(PHASE_ORDER[i - 1])));
        }
      }),
    );
  });
});

describe('lifetime LP is every LP held plus every LP spent', () => {
  it('stays equal through any run of prestiges and purchases from a fresh game', () => {
    const op = fc.oneof(
      fc.record({ kind: fc.constant('prestige' as const), food: fc.integer({ min: 0, max: 1e10 }), phase: fc.constantFrom(...PHASE_ORDER) }),
      fc.record({ kind: fc.constant('buy' as const), id: fc.constantFrom(...IDS) }),
    );
    fc.assert(
      fc.property(fc.array(op, { maxLength: 20 }), (ops) => {
        let s = createInitialState();
        for (const o of ops) {
          if (o.kind === 'prestige') {
            s = prestige({ ...s, phase: o.phase, prestige: { ...s.prestige, totalFoodProduced: s.prestige.totalFoodProduced + o.food } });
          } else {
            s = purchasePrestigeUpgrade(s, o.id) ?? s;
          }
          const spent = s.prestigeTree.purchased.reduce((sum, id) => sum + costOf(id), 0);
          expect(s.prestige.lifetimeLpEarned).toBe(s.prestige.legacyPoints + spent);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('a fresh game has earned none', () => {
    expect(createInitialState().prestige.lifetimeLpEarned).toBe(0);
  });
});
