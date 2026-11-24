// @vitest-environment node
/**
 * Story 3.8 (FR33, FR39, NFR12): CI proves every MVP phase goal is reachable.
 *
 * For each of Egg Laying, Colony and Combat, the default simulated player
 * (Story 3.7) starts at that phase's entry state and plays a check-in
 * schedule with a fixed seed. The phase goal must be met (the goal latches
 * and the player taps CONTINUE into the next phase) within a generous
 * ceiling, without prestige, and the run must never stall: across every full
 * simulated day at least one guard condition reaches a new best.
 *
 * Entry states are real: Egg Laying starts from `createInitialState()`, and
 * each later phase starts from the state the previous phase's run committed
 * into, so every entry state passed the real guards in `transitions.ts`.
 * Guard conditions are read from `transitions.ts` (`goalFor`), never restated.
 *
 * The ceilings below are 10× the GDD's pacing targets (GDD "Progression and
 * pacing"; Story 3.9 reports the real durations). They are deliberately
 * loose: this test catches soft-locks, not pacing drift.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimRunner, type SimResult } from '../../src/sim/runner';
import { defaultPolicy, maxArmyPolicy, type PlayerPolicy } from '../../src/sim/policy';
import { dailySchedule, type CheckIn } from '../../src/sim/schedule';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { Phase } from '../../src/phases/phases';
import { goalFor, type Transition } from '../../src/phases/transitions';
import { simBalance } from '../../src/data/balance/sim';
import { pacingTargets } from '../../src/data/balance/pacing';
import { DAY_MS } from '../../src/data/constants';


// catch-up logs one info line per resume; keep the test output readable.
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** The fixed seed every run uses. */
const SEED = 288;
/** How far past the GDD target a run may go before it counts as a soft-lock. */
const CEILING_FACTOR = 10;

/**
 * The GDD's pacing targets, at their slow end, read from `pacingTargets`
 * (Story 9.1: the first-week Difficulty Curve): each phase's most active play,
 * and the last day it should end on.
 */
type MvpPhase = Phase.EGG_LAYING | Phase.COLONY | Phase.COMBAT;
function gddTarget(phase: MvpPhase): { readonly activeMs?: number; readonly realMs?: number } {
  const t = pacingTargets.phases.find((p) => p.phase === phase)!;
  return {
    ...(t.activeMs ? { activeMs: t.activeMs.max } : {}),
    ...(t.finish.kind === 'days' ? { realMs: t.finish.toDay * DAY_MS } : {}),
  };
}

interface Ceiling {
  readonly activeMs: number;
  readonly realMs: number;
}

function ceilingFor(phase: MvpPhase): Ceiling {
  const t = gddTarget(phase);
  const dailyActive = simBalance.checkInsPerDay * simBalance.checkInActiveMs;
  const activeMs = t.activeMs === undefined ? Infinity : t.activeMs * CEILING_FACTOR;
  // Without a real-time target, give the schedule the days the active ceiling needs.
  const realMs = t.realMs !== undefined ? t.realMs * CEILING_FACTOR : Math.ceil(activeMs / dailyActive) * DAY_MS;
  return { activeMs, realMs };
}

interface Reach {
  /** The phase goal was met and the player committed into the next phase. */
  readonly reached: boolean;
  readonly prestiged: boolean;
  /** A full simulated day passed with no guard condition reaching a new best. */
  readonly stalled: boolean;
  readonly result: SimResult;
  /** The state the run ended in: the next phase's entry state when `reached`. */
  readonly end: GameState;
  /** Every `phase_committed` the run raised (only CONTINUE on a latched goal raises one). */
  readonly commits: readonly { from: Phase; to: Phase }[];
}

/** Each condition's current value, by condition id. */
const conditionValues = (goal: Transition, s: GameState): number[] => goal.conditions.map((c) => c.current(s));

/**
 * Play from `entry` until the phase's goal commits into the next phase, the
 * ceiling runs out, or a whole day passes without progress on any condition.
 */
function reach(entry: GameState, ceiling: Ceiling, policy: PlayerPolicy): Reach {
  const goal = goalFor(entry.phase);
  if (!goal) throw new Error(`no goal for ${entry.phase}`);
  const days = Math.ceil(ceiling.realMs / DAY_MS);
  const schedule = dailySchedule(days);
  const runner = new SimRunner({ state: entry, seed: SEED, schedule, policy, stopWhen: (s) => s.phase === goal.to });
  const commits: { from: Phase; to: Phase }[] = [];
  runner.bus.subscribe('phase_committed', (e) => commits.push(e));
  let best = conditionValues(goal, runner.state);
  let stalled = false;
  let i = 0;
  for (let day = 0; day < days && !runner.stopped && !stalled; day++) {
    const today: CheckIn[] = schedule.slice(i, i + simBalance.checkInsPerDay) as CheckIn[];
    let progressed = false;
    for (const c of today) {
      runner.checkIn(c, i++);
      const now = conditionValues(goal, runner.state);
      if (now.some((v, k) => v > best[k])) progressed = true;
      best = best.map((b, k) => Math.max(b, now[k]));
      if (runner.stopped) break;
    }
    if (!progressed && !runner.stopped) stalled = true;
  }
  const result = runner.result();
  return { reached: result.state.phase === goal.to, prestiged: result.prestiged, stalled, result, end: result.state, commits };
}

/**
 * Story 4.4: the max-army player ("train the maximum, then fight") must reach
 * every goal too: a bigger army costs food, never the run.
 */
const POLICIES: readonly (readonly [string, PlayerPolicy])[] = [
  ['default player', defaultPolicy],
  ['max-army player', maxArmyPolicy],
];

for (const [name, policy] of POLICIES) describe(`every MVP phase goal is reachable (Story 3.8), ${name}`, () => {
  // Each phase starts where the one before committed: computed once, in order.
  const runs = new Map<MvpPhase, Reach>();
  const entryOf = (phase: MvpPhase): GameState => {
    if (phase === Phase.EGG_LAYING) return createInitialState();
    const before = phase === Phase.COLONY ? Phase.EGG_LAYING : Phase.COLONY;
    const prev = runOf(before);
    if (!prev.reached) throw new Error(`${before} never reached ${phase}: no entry state`);
    return prev.end;
  };
  const runOf = (phase: MvpPhase): Reach => {
    let r = runs.get(phase);
    if (!r) {
      r = reach(entryOf(phase), ceilingFor(phase), policy);
      runs.set(phase, r);
    }
    return r;
  };

  for (const phase of [Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT] as const) {
    // Story 9.18 stretched Combat over the first week: playing it to its goal takes seconds, more on a slow CI runner.
    it(`${phase}: the goal is met within ${CEILING_FACTOR}× the GDD target, without prestige or a stalled day`, { timeout: 30_000 }, () => {
      const entry = entryOf(phase);
      expect(entry.phase).toBe(phase);
      const r = runOf(phase);
      const ceiling = ceilingFor(phase);
      expect(r.stalled, 'stalled: a full simulated day with no guard condition reaching a new best').toBe(false);
      expect(r.reached, 'the goal was not met within the ceiling').toBe(true);
      expect(r.prestiged).toBe(false);
      expect(r.result.activeMs, 'active play over the ceiling').toBeLessThanOrEqual(ceiling.activeMs);
      expect(r.result.elapsedMs, 'real time over the ceiling').toBeLessThanOrEqual(ceiling.realMs);
      // The run committed through the real flow: the guard latched, then CONTINUE committed it.
      expect(r.commits).toEqual([{ from: phase, to: goalFor(phase)!.to }]);
    });
  }

  it('each entry state after Egg Laying is where the previous phase committed', () => {
    for (const [before, phase] of [[Phase.EGG_LAYING, Phase.COLONY], [Phase.COLONY, Phase.COMBAT]] as const) {
      const prev = runOf(before);
      expect(prev.commits).toEqual([{ from: before, to: phase }]);
      expect(entryOf(phase)).toBe(prev.end);
    }
  });
});

/**
 * Story 9.9 (#438's capacity rebalance): a player who never taps (no LAY EGG,
 * no DIG, no FEED) still reaches the Colony goal: the queen lays on her own
 * once AUTO is on, and the diggers dig alone.
 */
describe('the Colony goal without a single tap (Story 9.9)', () => {
  const noTaps: PlayerPolicy = (s, turn) => defaultPolicy(s, { ...turn, taps: 0 });

  it('is reached within the ceiling, without prestige or a stalled day', () => {
    const egg = reach(createInitialState(), ceilingFor(Phase.EGG_LAYING), defaultPolicy);
    expect(egg.reached).toBe(true);
    const r = reach(egg.end, ceilingFor(Phase.COLONY), noTaps);
    const presses = r.result.probes.checkIns.reduce((n, c) => n + c.taps + c.digs + c.feeds, 0);
    expect(presses).toBe(0);
    expect(r.stalled, 'stalled: a full simulated day with no progress').toBe(false);
    expect(r.reached, 'the Colony goal was not met within the ceiling').toBe(true);
    expect(r.prestiged).toBe(false);
    expect(r.result.elapsedMs).toBeLessThanOrEqual(ceilingFor(Phase.COLONY).realMs);
  });
});
