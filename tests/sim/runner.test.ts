// @vitest-environment node
/**
 * Story 3.7 (AR15, D12): the headless simulated player. The runner plays the
 * real game, with no DOM: time moves only through `resume(elapsedMs)` and
 * moves only through `actions/` (tests/arch/simBoundary.test.ts holds the
 * import rules). These tests check what a run does, never how fast: pacing
 * numbers belong to the report (Story 3.9), not to tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimRunner, runSim } from '../../src/sim/runner';
import { repeatCheckIns, scheduleMs } from '../../src/sim/schedule';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import { goalFor } from '../../src/phases/transitions';
import { rngFromSeed } from '../../src/utils/rng';
import { simBalance } from '../../src/data/balance/sim';
import { RESUME_FULL_EFFICIENCY_MS } from '../../src/data/constants';

// catch-up logs one info line per resume; keep the test output readable.
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const active = simBalance.checkInActiveMs;
const shortGap = RESUME_FULL_EFFICIENCY_MS / 2;

function colonyWithoutGuard(): GameState {
  const base = createInitialState();
  const s: GameState = { ...base, phase: Phase.COLONY };
  const workers = goalFor(Phase.COLONY)!.conditions.find((c) => c.id === 'workers')!.target(s);
  return {
    ...s,
    resources: { ...s.resources, workers: workers + 5, nestCapacity: workers * 4, food: 1_000_000 },
    workersAssigned: { ...s.workersAssigned, guard: 0 },
  };
}

function combatStart(): GameState {
  const base = createInitialState();
  const s: GameState = { ...base, phase: Phase.COMBAT };
  const workers = goalFor(Phase.COMBAT)!.conditions.find((c) => c.id === 'workers')!.target(s);
  return {
    ...s,
    resources: { ...s.resources, workers: workers * 3, nestCapacity: workers * 12, food: 1_000_000 },
    workersAssigned: { ...s.workersAssigned, guard: 1, gather: workers },
  };
}

describe('SimRunner (Story 3.7)', () => {
  it('starts from the given seed', () => {
    const runner = new SimRunner({ state: createInitialState(), seed: 42, schedule: [] });
    expect(runner.state.seed).toBe(42);
    expect(runner.state.rng).toBe(rngFromSeed(42));
  });

  it('is deterministic: the same seed and state give the same run', () => {
    const schedule = repeatCheckIns(2, { awayMs: shortGap, activeMs: active });
    const a = runSim({ state: combatStart(), seed: 7, schedule });
    const b = runSim({ state: combatStart(), seed: 7, schedule });
    expect(b.probes).toEqual(a.probes);
    expect(b.state).toEqual(a.state);
  });

  it('simulates exactly the scheduled time, away and active', () => {
    const schedule = repeatCheckIns(3, { awayMs: RESUME_FULL_EFFICIENCY_MS * 3, activeMs: active });
    const r = runSim({ state: createInitialState(), seed: 1, schedule });
    expect(r.elapsedMs).toBe(scheduleMs(schedule));
    expect(r.activeMs).toBe(schedule.reduce((t, c) => t + c.activeMs, 0));
    expect(r.stopped).toBe(false);
  });

  it('in Egg Laying lays eggs during each check-in, and the eggs grow the colony', () => {
    const before = createInitialState();
    const schedule = repeatCheckIns(2, { awayMs: shortGap, activeMs: active });
    const r = runSim({ state: before, seed: 1, schedule });
    for (const c of r.probes.checkIns.filter((x) => x.phase === Phase.EGG_LAYING)) expect(c.taps).toBeGreaterThan(0);
    expect(r.state.stats.totalClicks).toBeGreaterThan(before.stats.totalClicks);
    expect(r.state.resources.workers).toBeGreaterThan(before.resources.workers);
  });

  it('assigns a GUARD when the goal needs one and taps CONTINUE when the goal is met', () => {
    const r = runSim({ state: colonyWithoutGuard(), seed: 1, schedule: repeatCheckIns(1, { awayMs: 0, activeMs: active }) });
    expect(r.probes.phaseEntries.map((e) => e.phase)).toContain(Phase.COMBAT);
    expect(r.probes.checkIns[0].byAction.continuePhase).toBeGreaterThan(0);
    expect(r.state.workersAssigned.guard).toBeGreaterThan(0);
  });

  it('in Combat trains soldiers and fights', () => {
    const before = combatStart();
    const r = runSim({ state: before, seed: 3, schedule: repeatCheckIns(3, { awayMs: shortGap, activeMs: active }) });
    const sum = (k: string) => r.probes.checkIns.reduce((t, c) => t + (c.byAction[k] ?? 0), 0);
    expect(sum('trainSoldier')).toBeGreaterThan(0);
    expect(sum('fight')).toBeGreaterThan(0);
    expect(r.state.battlesWon + r.state.battlesLost).toBeGreaterThan(before.battlesWon + before.battlesLost);
  });

  it('fires no decision event and never prestiges', () => {
    const runner = new SimRunner({
      state: colonyWithoutGuard(),
      seed: 5,
      schedule: repeatCheckIns(3, { awayMs: RESUME_FULL_EFFICIENCY_MS * 10, activeMs: active }),
    });
    const spawned: unknown[] = [];
    runner.bus.subscribe('decision_spawned', (e) => spawned.push(e));
    const r = runner.run();
    expect(spawned).toEqual([]);
    expect(r.state.decision.open).toBeNull();
    expect(r.prestiged).toBe(false);
  });

  it('driven check-in by check-in, result() reports the run so far, as run() would', () => {
    const schedule = repeatCheckIns(2, { awayMs: shortGap, activeMs: active });
    const whole = runSim({ state: combatStart(), seed: 4, schedule });
    const runner = new SimRunner({ state: combatStart(), seed: 4, schedule });
    schedule.forEach((c, i) => runner.checkIn(c, i));
    expect(runner.stopped).toBe(false);
    const r = runner.result();
    expect(r.elapsedMs).toBe(whole.elapsedMs);
    expect(r.activeMs).toBe(whole.activeMs);
    expect(r.probes).toEqual(whole.probes);
    expect(r.state).toEqual(whole.state);
  });

  it('stops as soon as stopWhen holds', () => {
    const r = runSim({
      state: colonyWithoutGuard(),
      seed: 1,
      schedule: repeatCheckIns(5, { awayMs: shortGap, activeMs: active }),
      stopWhen: (s) => s.phase === Phase.COMBAT,
    });
    expect(r.stopped).toBe(true);
    expect(r.state.phase).toBe(Phase.COMBAT);
    expect(r.probes.checkIns).toHaveLength(1);
  });
});

describe('Probes (Story 3.7)', () => {
  const schedule = repeatCheckIns(3, { awayMs: shortGap, activeMs: active });
  const r = () => runSim({ state: colonyWithoutGuard(), seed: 2, schedule });

  it('record the time each phase was entered, in phase order, starting with the start phase at 0', () => {
    const { phaseEntries } = r().probes;
    expect(phaseEntries[0]).toMatchObject({ phase: Phase.COLONY, atMs: 0, activeMs: 0, checkIn: 0 });
    const order = phaseEntries.map((e) => PHASE_ORDER.indexOf(e.phase as Phase));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (let i = 1; i < phaseEntries.length; i++) {
      expect(phaseEntries[i].atMs).toBeGreaterThanOrEqual(phaseEntries[i - 1].atMs);
      expect(phaseEntries[i].activeMs).toBeGreaterThanOrEqual(phaseEntries[i - 1].activeMs);
    }
  });

  it('record, per check-in, the actions taken and the decisions available', () => {
    const { checkIns } = r().probes;
    expect(checkIns).toHaveLength(schedule.length);
    checkIns.forEach((c, i) => {
      expect(c.index).toBe(i);
      for (const n of [c.actions, c.taps, c.refused, c.decisionsAvailable]) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
      }
      const byAction = Object.values(c.byAction).reduce((t, n) => t + n, 0);
      expect(byAction).toBe(c.actions);
    });
    // The first check-in opens on a met-but-for-a-guard goal: something can be done.
    expect(checkIns[0].actions).toBeGreaterThan(0);
  });

  it('count a latched goal as an available decision', () => {
    const s = colonyWithoutGuard();
    const latched = { ...s, workersAssigned: { ...s.workersAssigned, guard: 1 } };
    const run = runSim({ state: latched, seed: 1, schedule: repeatCheckIns(1, { awayMs: shortGap, activeMs: active }) });
    expect(run.probes.checkIns[0].decisionsAvailable).toBeGreaterThan(0);
  });
});
