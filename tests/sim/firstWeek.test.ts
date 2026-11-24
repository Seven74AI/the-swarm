// @vitest-environment node
/**
 * Story 9.1 (FR54, FR65, AR15): the simulated player plays the first week.
 * A check-in after the week is played until the player has nothing useful
 * left (its length is measured), and the probes record payoffs, the moments
 * that give the player something new. These check what a run records, never
 * how long anything takes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSim } from '../../src/sim/runner';
import { Probes } from '../../src/sim/probes';
import type { PlayerPolicy } from '../../src/sim/policy';
import { repeatCheckIns, scheduleMs, type CheckIn } from '../../src/sim/schedule';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { Phase } from '../../src/phases/phases';
import { goalFor } from '../../src/phases/transitions';
import { simBalance } from '../../src/data/balance/sim';
import { MS_PER_SEC, OFFLINE_CAP_BASE_MS, RESUME_FULL_EFFICIENCY_MS } from '../../src/data/constants';
import { diggerPointsPerSec, roomCost } from '../../src/systems/Dig';
import { isItemAffordable, listItems } from '../../src/systems/NextAction';
import { getCrowding } from '../../src/systems/Crowding';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const step = simBalance.activeStepMs;
const ceiling = step * 6;
const measured: CheckIn = { awayMs: RESUME_FULL_EFFICIENCY_MS * 3, activeMs: ceiling, untilIdle: true };
const idlePolicy: PlayerPolicy = () => [];
const tapper: PlayerPolicy = (_s, turn) => (turn.taps > 0 ? [{ kind: 'layEgg', taps: turn.taps }] : []);

describe('a measured check-in (untilIdle)', () => {
  it('ends after the first look that lands nothing', () => {
    const r = runSim({ state: createInitialState(), seed: 1, schedule: [measured], policy: idlePolicy });
    expect(r.probes.checkIns[0].activeMs).toBeGreaterThan(0);
    expect(r.probes.checkIns[0].activeMs).toBeLessThan(ceiling);
    expect(r.activeMs).toBe(r.probes.checkIns[0].activeMs);
  });

  it('runs to its ceiling while something useful keeps landing', () => {
    const r = runSim({ state: createInitialState(), seed: 1, schedule: [measured], policy: tapper });
    expect(r.probes.checkIns[0].activeMs).toBe(ceiling);
  });

  it('keeps the next check-in on its planned start: time left unplayed joins the gap', () => {
    const schedule = repeatCheckIns(3, measured);
    const r = runSim({ state: createInitialState(), seed: 1, schedule, policy: idlePolicy });
    r.probes.checkIns.forEach((c, i) => expect(c.startMs).toBe(scheduleMs(schedule.slice(0, i)) + schedule[i].awayMs));
  });

  it('a fixed check-in records its whole length as played', () => {
    const r = runSim({ state: createInitialState(), seed: 1, schedule: repeatCheckIns(1, { awayMs: 0, activeMs: ceiling }), policy: idlePolicy });
    expect(r.probes.checkIns[0].activeMs).toBe(ceiling);
  });
});

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

describe('the crowded probe (Story 9.13)', () => {
  it('records whether a check-in started with crowding biting', () => {
    const start = createInitialState();
    const packed = (s: GameState): GameState => {
      const brood = s.resources.nestCapacity * 3;
      return { ...s, phase: Phase.COLONY, resources: { ...s.resources, eggs: brood }, eggPipeline: { count: brood, progress: 0 } };
    };
    const p = new Probes(start);
    p.beginCheckIn(0, start, 0);
    p.beginCheckIn(1, packed(start), 1000);
    const [roomy, crowded] = p.report().checkIns;
    expect(getCrowding(start).multiplier).toBe(1);
    expect(roomy.startCrowded).toBe(false);
    expect(crowded.startCrowded).toBe(true);
  });
});

describe('the food-lost probe (Story 9.15)', () => {
  it('records the food lost at the limit by the end of the check-in, losses during play included', () => {
    const start = createInitialState();
    const p = new Probes(start);
    p.beginCheckIn(0, start, 0);
    p.observe({ ...start, foodLostAtLimit: start.foodLostAtLimit + 50 }, 1000, 1000);
    p.endCheckIn();
    const [c] = p.report().checkIns;
    expect(c.foodLostAtLimit).toBeGreaterThan(start.foodLostAtLimit);
  });
});

describe('payoff probes', () => {
  const start = createInitialState();

  function observed(next: GameState) {
    const p = new Probes(start);
    p.beginCheckIn(0, start, 0);
    p.observe(next, 1000, 1000);
    return p.report().payoffs;
  }

  it('record nothing when nothing changed', () => {
    expect(observed(start)).toEqual([]);
  });

  it('record a room opened when the nest gains room', () => {
    const next = { ...start, resources: { ...start.resources, nestCapacity: start.resources.nestCapacity + 1 } };
    expect(observed(next).map((p) => p.kind)).toContain('room');
  });

  it('record an item newly affordable, at the time and check-in it became so', () => {
    const rich = { ...start, phase: Phase.COLONY, resources: { ...start.resources, food: 10_000_000, wood: 10_000_000, stone: 10_000_000, nectar: 10_000_000 } };
    expect(listItems().some((ref) => isItemAffordable(rich, ref) && !isItemAffordable(start, ref))).toBe(true);
    const p = observed(rich).find((x) => x.kind === 'affordable');
    expect(p).toMatchObject({ atMs: 1000, activeMs: 1000, checkIn: 0 });
  });

  it('record a goal condition newly met, and a phase entered', () => {
    const r = runSim({ state: colonyWithoutGuard(), seed: 2, schedule: repeatCheckIns(1, { awayMs: 0, activeMs: simBalance.checkInActiveMs }) });
    const kinds = r.probes.payoffs.map((p) => p.kind);
    expect(kinds).toContain('goal');
    expect(kinds).toContain('phase');
    const phase = r.probes.payoffs.find((p) => p.kind === 'phase')!;
    expect(phase.atMs).toBe(r.probes.phaseEntries[1].atMs);
  });

  it('are in time order and never change the game', () => {
    const schedule = repeatCheckIns(2, { awayMs: RESUME_FULL_EFFICIENCY_MS * 3, activeMs: simBalance.checkInActiveMs });
    const r = runSim({ state: createInitialState(), seed: 1, schedule });
    for (let i = 1; i < r.probes.payoffs.length; i++) {
      expect(r.probes.payoffs[i].activeMs).toBeGreaterThanOrEqual(r.probes.payoffs[i - 1].activeMs);
      expect(r.probes.payoffs[i].atMs).toBeGreaterThanOrEqual(r.probes.payoffs[i - 1].atMs);
    }
    expect(r.probes.payoffs.length).toBeGreaterThan(0);
  });
});

/** Story 9.2: the simulated player digs through the same action a player uses; diggers dig alone. */
describe('digging in the sim (Story 9.2)', () => {
  function fullColony(diggers: number): GameState {
    const s = colonyWithoutGuard();
    return {
      ...s,
      resources: { ...s.resources, nestCapacity: s.resources.workers, larvae: 20 },
      workersAssigned: { ...s.workersAssigned, guard: 1, dig: diggers },
    };
  }

  it('a check-in in a full nest presses DIG and opens rooms', () => {
    const s = fullColony(0);
    const r = runSim({ state: s, seed: 1, schedule: repeatCheckIns(1, { awayMs: 0, activeMs: simBalance.checkInActiveMs }) });
    expect(r.probes.checkIns[0].digs).toBeGreaterThan(0);
    expect(r.state.dig.roomsDug).toBeGreaterThan(s.dig.roomsDug);
    expect(r.state.resources.nestCapacity).toBeGreaterThan(s.resources.nestCapacity);
  });

  it('with no presses, diggers still open a room within a generous ceiling', () => {
    const s = fullColony(10);
    // Four times a digger-only room, in gaps well under the offline cap (offline digs at its efficiency).
    const ceilingMs = Math.ceil(roomCost(s.dig.roomsDug) / diggerPointsPerSec(s)) * MS_PER_SEC * 4;
    const gapMs = Math.floor(OFFLINE_CAP_BASE_MS / 2);
    const r = runSim({
      state: s,
      seed: 1,
      policy: idlePolicy,
      schedule: repeatCheckIns(Math.ceil(ceilingMs / gapMs), { awayMs: gapMs, activeMs: step }),
      stopWhen: (x) => x.dig.roomsDug > s.dig.roomsDug,
    });
    expect(r.stopped).toBe(true);
    expect(r.probes.checkIns.every((c) => c.digs === 0)).toBe(true);
  });
});
