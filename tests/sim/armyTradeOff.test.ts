// @vitest-environment node
/**
 * Story 4.4 (FR12): a bigger army has a real cost, in the pacing harness.
 *
 * The max-army player ("train the maximum, then fight") and the default
 * player play Combat from the same entry state, seed and schedule. Soldiers
 * eat (`combatBalance.army`), so the max-army colony spends more Combat
 * check-ins food-critical than the default one (restated by Story 9.15 once
 * food has a limit, #478). Reachability for both players is in
 * reachability.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPolicy, maxArmyPolicy, type SimMove } from '../../src/sim/policy';
import { combatEntry, compareArmies, formatArmyComparison, foodCriticalInCombat, runArmyComparison, type ArmyComparison } from '../../src/sim/report';
import type { CheckInRecord } from '../../src/sim/probes';
import { firstWeekSchedule } from '../../src/sim/schedule';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { Phase } from '../../src/phases/phases';
import { soldierBalance } from '../../src/data/balance/soldiers';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const kinds = (moves: readonly SimMove[]) => moves.map((m) => m.kind);

/** A Combat colony: `free` workers without a job, food to train them all. */
function combat(over: { free?: number; soldiers?: number; training?: number; food?: number } = {}): GameState {
  const s = createInitialState();
  const free = over.free ?? 5;
  const guard = 1;
  return {
    ...s,
    phase: Phase.COMBAT,
    resources: { ...s.resources, workers: free + guard, nestCapacity: 1_000, food: over.food ?? 100_000 },
    workersAssigned: { gather: 0, forage: 0, tend: 0, dig: 0, guard, researchers: 0 },
    combatSoldiers: over.soldiers ?? 0,
    soldierPipeline: { count: over.training ?? 0, progress: 0 },
  };
}

describe('maxArmyPolicy (Story 4.4)', () => {
  it('trains first while a free worker and the food are there, whatever the enemy', () => {
    const moves = maxArmyPolicy(combat({ soldiers: 500 }), { taps: 0 });
    expect(moves[0]).toEqual({ kind: 'trainSoldier' });
  });

  it('trains where the default player, already strong enough, fights instead', () => {
    const s = combat({ soldiers: 500 });
    expect(kinds(defaultPolicy(s, { taps: 0 }))).not.toContain('trainSoldier');
    expect(kinds(maxArmyPolicy(s, { taps: 0 }))).toContain('trainSoldier');
  });

  it('fights once nothing more can be trained and training is over', () => {
    const s = combat({ free: 0, soldiers: 3 });
    expect(maxArmyPolicy(s, { taps: 0 })).toContainEqual({ kind: 'fight', enemyType: s.nextEnemy });
  });

  it('waits for the trainees before it fights', () => {
    const s = combat({ free: 0, soldiers: 3, training: 2 });
    expect(kinds(maxArmyPolicy(s, { taps: 0 }))).not.toContain('fight');
  });

  it('cannot train without the food to start', () => {
    const s = combat({ food: soldierBalance.costFood - 1, soldiers: 2 });
    expect(kinds(maxArmyPolicy(s, { taps: 0 }))).not.toContain('trainSoldier');
  });

  it('plays like the default player outside Combat', () => {
    const s = { ...combat(), phase: Phase.COLONY };
    expect(maxArmyPolicy(s, { taps: 4 })).toEqual(defaultPolicy(s, { taps: 4 }));
  });
});

describe('foodCriticalInCombat', () => {
  const rec = (index: number, foodCritical: boolean, phase: string = Phase.COMBAT): CheckInRecord => ({
    index, startMs: 0, activeMs: 0, phase, decisionsAvailable: 0, waitMs: 0, actions: 0, taps: 0, digs: 0, feeds: 0, refused: 0, byAction: {}, foodCritical, capacityCritical: false, starving: false, starvedTotal: 0, startCrowded: false, foodLostAtLimit: 0,
  });

  it('counts the Combat check-ins a run arrived at food-critical, and no other phase', () => {
    const run = [rec(4, true), rec(5, false), rec(6, true), rec(7, true, Phase.EXPANSION)];
    expect(foodCriticalInCombat(run)).toBe(2);
    expect(foodCriticalInCombat([])).toBe(0);
  });
});

describe('the army trade-off in the pacing harness (Story 4.4)', () => {
  const SEED = 1;
  const DAYS = 7;
  let comparison: ArmyComparison;
  beforeEach(() => {
    comparison ??= runArmyComparison({ seed: SEED, days: DAYS })!;
  });

  it('both players start Combat from the same state', () => {
    const schedule = firstWeekSchedule(DAYS);
    const entry = combatEntry(SEED, schedule);
    expect(entry?.state.phase).toBe(Phase.COMBAT);
    // The same entry, seed and schedule replay the same run.
    const again = compareArmies(entry!.state, { seed: SEED, schedule, first: entry!.nextCheckIn });
    expect(again.default.checkIns).toEqual(comparison.default.checkIns);
    expect(again.maxArmy.checkIns).toEqual(comparison.maxArmy.checkIns);
    expect(comparison.default.checkIns[0].index).toBe(comparison.maxArmy.checkIns[0].index);
  });

  it('the max-army colony spends more Combat check-ins food-critical than the default one (Story 9.15)', () => {
    expect(comparison.foodCriticalInCombat.maxArmy).toBeGreaterThan(comparison.foodCriticalInCombat.default);
  });

  it('the max-army player trains more soldiers in the check-ins both play', () => {
    const trained = (checkIns: readonly CheckInRecord[], upTo: number) =>
      checkIns.filter((c) => c.index <= upTo).reduce((n, c) => n + (c.byAction.trainSoldier ?? 0), 0);
    const last = Math.min(...[comparison.default, comparison.maxArmy].map((r) => r.checkIns[r.checkIns.length - 1].index));
    expect(trained(comparison.maxArmy.checkIns, last)).toBeGreaterThan(trained(comparison.default.checkIns, last));
  });

  it('both players spend Combat loot on Phase 3 purchasables, and the report lists what each bought (Story 4.8)', () => {
    for (const run of [comparison.default, comparison.maxArmy]) {
      expect(run.bought.length).toBeGreaterThan(0);
      for (const item of run.bought) expect(item).toMatch(/^[A-Z][A-Z .0-9–]*$/);
    }
    const text = formatArmyComparison(comparison).join('\n');
    for (const item of comparison.default.bought) expect(text).toContain(item);
  });

  it('the report prints the comparison', () => {
    const text = formatArmyComparison(comparison).join('\n');
    expect(text).toMatch(/max-army/);
    expect(text).toMatch(/Combat check-ins food-critical: default \d+, max-army \d+/);
  });
});
