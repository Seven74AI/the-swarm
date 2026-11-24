// @vitest-environment node
/**
 * Story 3.9 (AR15 report, FR40 measurement): the pacing report. Its numbers
 * are computed by pure functions over the run's probes; these tests check the
 * computation on made-up probes and the report's shape on a real run, never a
 * duration or a share (those are what the report prints, and Story 3.11 tunes).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPacingReport,
  formatPacingReport,
  criticalMoments,
  starvationReport,
  crowdedShares,
  foodLostPerDay,
  idleCheckIns,
  judgeSpan,
  median,
  phaseSpans,
  runPacingReport,
  tapShare,
  idleGapGate,
  longestIdleGap,
  phaseEndGate,
  postWeekGate,
  type PacingTargets,
  type PhaseSpan,
} from '../../src/sim/report';
import type { CheckInRecord, EggSample, Payoff, ProbeReport } from '../../src/sim/probes';
import { runSim } from '../../src/sim/runner';
import { dailySchedule, firstWeekSchedule, repeatCheckIns } from '../../src/sim/schedule';
import { createInitialState } from '../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import { pacingTargets } from '../../src/data/balance/pacing';
import { simBalance } from '../../src/data/balance/sim';
import { DAY_MS, HOUR_MS } from '../../src/data/constants';
import { isCapacityCritical, isFoodCritical } from '../../src/systems/NextAction';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const MIN = 60_000;

function checkIn(index: number, over: Partial<CheckInRecord> = {}): CheckInRecord {
  return { index, startMs: index * HOUR_MS, activeMs: 5 * MIN, phase: Phase.COLONY, decisionsAvailable: 0, waitMs: 0, actions: 0, taps: 0, digs: 0, feeds: 0, refused: 0, byAction: {}, foodCritical: false, capacityCritical: false, startCrowded: false, starving: false, starvedTotal: 0, foodLostAtLimit: 0, ...over };
}

function egg(activeMs: number, phase: Phase, laid: number, tapped: number): EggSample {
  return { atMs: activeMs, activeMs, phase, laid, tapped };
}

/** Three phases entered at known times; the run ends later in the third. */
const probes: ProbeReport = {
  phaseEntries: [
    { phase: Phase.EGG_LAYING, atMs: 0, activeMs: 0, checkIn: 0 },
    { phase: Phase.COLONY, atMs: 4 * MIN, activeMs: 4 * MIN, checkIn: 0 },
    { phase: Phase.COMBAT, atMs: DAY_MS + 2 * HOUR_MS, activeMs: 30 * MIN, checkIn: 7 },
  ],
  checkIns: [checkIn(0), checkIn(1), checkIn(7)],
  eggs: [],
  payoffs: [],
};
const end = { atMs: 2 * DAY_MS + 5 * HOUR_MS, activeMs: 50 * MIN };

describe('phaseSpans (Story 3.9)', () => {
  const spans = phaseSpans(probes, end);

  it('gives one span per phase entered, in order, each lasting until the next entry', () => {
    expect(spans.map((s) => s.phase)).toEqual(probes.phaseEntries.map((e) => e.phase));
    for (let i = 0; i < spans.length - 1; i++) {
      expect(spans[i].completed).toBe(true);
      expect(spans[i].activeMs).toBe(probes.phaseEntries[i + 1].activeMs - probes.phaseEntries[i].activeMs);
      expect(spans[i].realMs).toBe(probes.phaseEntries[i + 1].atMs - probes.phaseEntries[i].atMs);
      expect(spans[i].endedAtMs).toBe(probes.phaseEntries[i + 1].atMs);
      expect(spans[i].endedInCheckIn).toBe(probes.phaseEntries[i + 1].checkIn);
    }
  });

  it('starts each span where its phase was entered', () => {
    spans.forEach((s, i) => {
      expect(s.startedAtMs).toBe(probes.phaseEntries[i].atMs);
      expect(s.startedActiveMs).toBe(probes.phaseEntries[i].activeMs);
    });
  });

  it('leaves the last phase open, lasting until the end of the run', () => {
    const last = spans[spans.length - 1];
    expect(last.completed).toBe(false);
    expect(last.endedAtMs).toBeNull();
    expect(last.activeMs).toBe(end.activeMs - probes.phaseEntries[2].activeMs);
    expect(last.realMs).toBe(end.atMs - probes.phaseEntries[2].atMs);
  });

  it('adds up to the whole run', () => {
    expect(spans.reduce((t, s) => t + s.activeMs, 0)).toBe(end.activeMs);
    expect(spans.reduce((t, s) => t + s.realMs, 0)).toBe(end.atMs);
  });

  it('names the day (from 1) each phase ended on', () => {
    expect(spans[0].endedOnDay).toBe(1);
    expect(spans[1].endedOnDay).toBe(2);
    expect(spans[2].endedOnDay).toBeNull();
  });
});

describe('judgeSpan (Story 3.9)', () => {
  const span = (over: Partial<PhaseSpan>): PhaseSpan => ({
    phase: Phase.COLONY, startedAtMs: 0, startedActiveMs: 0, activeMs: 10 * MIN, realMs: HOUR_MS, completed: true, endedAtMs: HOUR_MS, endedOnDay: 2, endedInCheckIn: 3, ...over,
  });
  const target = { phase: Phase.COLONY, label: 'X', activeMs: { min: 5 * MIN, max: 20 * MIN }, finish: { kind: 'days', fromDay: 2, toDay: 3, label: 'Days 2–3' } } as const;

  it('says fast below the active window, ok inside it and slow above it', () => {
    expect(judgeSpan(span({ activeMs: target.activeMs.min - 1 }), target).active).toBe('fast');
    expect(judgeSpan(span({ activeMs: target.activeMs.min }), target).active).toBe('ok');
    expect(judgeSpan(span({ activeMs: target.activeMs.max }), target).active).toBe('ok');
    expect(judgeSpan(span({ activeMs: target.activeMs.max + 1 }), target).active).toBe('slow');
  });

  it('judges real time by the day the phase ended on', () => {
    expect(judgeSpan(span({ endedOnDay: target.finish.fromDay - 1 }), target).realTime).toBe('fast');
    expect(judgeSpan(span({ endedOnDay: target.finish.fromDay }), target).realTime).toBe('ok');
    expect(judgeSpan(span({ endedOnDay: target.finish.toDay }), target).realTime).toBe('ok');
    expect(judgeSpan(span({ endedOnDay: target.finish.toDay + 1 }), target).realTime).toBe('slow');
  });

  it('judges a check-in target by the check-in the phase ended in', () => {
    const t = { ...target, finish: { kind: 'checkIns', within: 2, label: 'First session' } } as const;
    expect(judgeSpan(span({ endedInCheckIn: t.finish.within - 1 }), t).realTime).toBe('ok');
    expect(judgeSpan(span({ endedInCheckIn: t.finish.within }), t).realTime).toBe('slow');
  });

  it('calls an unfinished phase open, or slow once it has already run past the window', () => {
    const open = { completed: false, endedAtMs: null, endedOnDay: null, endedInCheckIn: null };
    expect(judgeSpan(span({ ...open, activeMs: target.activeMs.min }), target).active).toBe('open');
    expect(judgeSpan(span({ ...open, activeMs: target.activeMs.max + 1 }), target).active).toBe('slow');
    expect(judgeSpan(span({ ...open, realMs: 0, endedAtMs: null }), target, { atMs: 0, checkIns: 1 }).realTime).toBe('open');
    expect(judgeSpan(span({ ...open }), target, { atMs: target.finish.toDay * DAY_MS, checkIns: 1 }).realTime).toBe('slow');
    const t = { ...target, finish: { kind: 'checkIns', within: 2, label: 'First session' } } as const;
    expect(judgeSpan(span({ ...open }), t, { atMs: 0, checkIns: t.finish.within - 1 }).realTime).toBe('open');
    expect(judgeSpan(span({ ...open }), t, { atMs: 0, checkIns: t.finish.within }).realTime).toBe('slow');
  });

  it('has no verdict where the GDD has no target', () => {
    expect(judgeSpan(span({}), { ...target, activeMs: null }).active).toBe('none');
  });
});

describe('tapShare (Story 3.9)', () => {
  const eggs = [egg(0, Phase.EGG_LAYING, 10, 10), egg(MIN, Phase.EGG_LAYING, 10, 5), egg(3 * MIN, Phase.COLONY, 40, 0)];

  it('is the percentage of the eggs laid in the window that came from tapping', () => {
    const all = tapShare(eggs, () => true)!;
    expect(all).toBeGreaterThanOrEqual(0);
    expect(all).toBeLessThanOrEqual(100);
    const tapped = eggs.reduce((t, e) => t + e.tapped, 0);
    const laid = eggs.reduce((t, e) => t + e.laid, 0);
    expect(all).toBe(Math.floor((tapped * 100) / laid));
  });

  it('counts only the samples the window holds', () => {
    expect(tapShare(eggs, (e) => e.phase === Phase.COLONY)).toBe(0);
    expect(tapShare(eggs, (e) => e.activeMs === 0)).toBe(100);
  });

  it('is null when no egg was laid in the window', () => {
    expect(tapShare(eggs, () => false)).toBeNull();
    expect(tapShare([], () => true)).toBeNull();
  });
});

describe('median (Story 3.9)', () => {
  it('is the middle value, or the mean of the middle two', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([])).toBeNull();
  });
});

describe('idleCheckIns (Story 3.9)', () => {
  const limit = 4 * HOUR_MS;

  it('lists every check-in where nothing could be done within the limit, or ever', () => {
    const list = [checkIn(0, { waitMs: 0 }), checkIn(1, { waitMs: limit }), checkIn(2, { waitMs: limit + 1 }), checkIn(3, { waitMs: null })];
    expect(idleCheckIns(list, limit).map((c) => c.index)).toEqual([2, 3]);
  });

  it('does not count a check-in whose own play opened a move (Phase 1 taps make things affordable)', () => {
    const list = [checkIn(0, { waitMs: null, actions: 1 }), checkIn(1, { waitMs: limit + 1, actions: 2 }), checkIn(2, { waitMs: null, taps: 5 })];
    expect(idleCheckIns(list, limit).map((c) => c.index)).toEqual([2]);
  });
});

describe('criticalMoments (Story 3.11)', () => {
  it('counts the check-ins of a phase where food, and where capacity, was critical', () => {
    const list = [
      checkIn(0, { phase: Phase.EGG_LAYING, foodCritical: true, capacityCritical: true }),
      checkIn(1, { foodCritical: true }),
      checkIn(2, { capacityCritical: true }),
      checkIn(3, { foodCritical: true, capacityCritical: true }),
      checkIn(4),
    ];
    expect(criticalMoments(list, Phase.COLONY)).toEqual({ food: 2, capacity: 2 });
    expect(criticalMoments(list, Phase.COMBAT)).toEqual({ food: 0, capacity: 0 });
  });
});

describe('foodLostPerDay (Story 9.15)', () => {
  it('gives the food lost at the limit in each day, from the running count on arrival', () => {
    const at = (day: number, h: number) => day * DAY_MS + h * HOUR_MS;
    const list = [
      checkIn(0, { startMs: at(0, 1), foodLostAtLimit: 0 }),
      checkIn(1, { startMs: at(0, 9), foodLostAtLimit: 40 }),
      checkIn(2, { startMs: at(1, 2), foodLostAtLimit: 100 }),
      checkIn(3, { startMs: at(2, 3), foodLostAtLimit: 100 }),
    ];
    const days = foodLostPerDay(list);
    expect(days.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(days.reduce((n, d) => n + d.lost, 0)).toBe(100);
    expect(days[0].lost).toBe(40);
    expect(days[2].lost).toBe(0);
    for (const d of days) expect(d.lost).toBeGreaterThanOrEqual(0);
  });
});

describe('crowdedShares (Story 9.13)', () => {
  it('gives, per phase, the whole percent of its check-ins that started crowded', () => {
    const list = [
      checkIn(0, { phase: Phase.EGG_LAYING }),
      checkIn(1, { startCrowded: true }),
      checkIn(2),
      checkIn(3, { phase: Phase.COMBAT, startCrowded: true }),
    ];
    const shares = crowdedShares(list);
    expect(shares.map((x) => x.phase)).toEqual([Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT]);
    const colony = shares.find((x) => x.phase === Phase.COLONY)!;
    expect(colony.checkIns).toBe(2);
    expect(colony.crowded).toBe(1);
    expect(colony.percent).toBeLessThan(shares.find((x) => x.phase === Phase.COMBAT)!.percent);
    expect(shares.find((x) => x.phase === Phase.EGG_LAYING)!.percent).toBe(0);
    for (const x of shares) expect(Number.isInteger(x.percent)).toBe(true);
  });
});

describe('starvationReport (Story 9.16)', () => {
  const t = pacingTargets.starvation;
  const at = (day: number, h: number) => day * DAY_MS + h * HOUR_MS;

  it('gives each check-in its deaths, from the running count, and every starving stretch with its length', () => {
    const list = [
      checkIn(0, { startMs: at(0, 0), starvedTotal: 0 }),
      checkIn(1, { startMs: at(1, 1), starving: true, starvedTotal: 3 }),
      checkIn(2, { startMs: at(1, 5), starving: true, starvedTotal: 5 }),
      checkIn(3, { startMs: at(1, 9), starvedTotal: 5 }),
      checkIn(4, { startMs: at(2, 1), starving: true, starvedTotal: 6 }),
    ];
    const r = starvationReport(list, t);
    expect(r.deathsPerCheckIn).toEqual([0, 3, 2, 0, 1]);
    expect(r.stretches.map((s) => s.checkIns)).toEqual([2, 1]);
    expect(r.stretches[0]).toMatchObject({ from: 1, to: 2 });
  });

  it('passes with no death in session 1 and no long stretch in days 2–7, and fails otherwise', () => {
    const calm = [checkIn(0, { startMs: 0 }), checkIn(1, { startMs: at(2, 0), starving: true, starvedTotal: 1 })];
    const r = starvationReport(calm, t);
    expect(r.session1).toBe('pass');
    expect(r.stretch).toBe('pass');
    const early = [checkIn(0, { startMs: 0, starvedTotal: 1 })];
    expect(starvationReport(early, t).session1).toBe('fail');
    const long = Array.from({ length: t.maxStretchCheckIns + 1 }, (_, i) => checkIn(i + 1, { startMs: at(t.fromDay - 1, i), starving: true }));
    expect(starvationReport([checkIn(0, { startMs: 0 }), ...long], t).stretch).toBe('fail');
  });
});

describe('the pacing report on a real run (Story 3.9)', () => {
  const targets: PacingTargets = pacingTargets;
  const schedule = dailySchedule(1);
  const result = runSim({ state: createInitialState(), seed: 1, schedule });
  const report = buildPacingReport(result, { seed: 1, days: 1, targets });

  it('has one row per MVP target phase, in target order', () => {
    expect(report.rows.map((r) => r.target.phase)).toEqual(targets.phases.map((t) => t.phase));
  });

  it('measures every row against the run: no phase longer than the run', () => {
    for (const row of report.rows) {
      if (!row.span) continue;
      expect(row.span.activeMs).toBeLessThanOrEqual(result.activeMs);
      expect(row.span.realMs).toBeLessThanOrEqual(result.elapsedMs);
    }
    expect(report.rows[0].span).not.toBeNull();
  });

  it('reports tap shares as percentages, the median actions and the idle check-ins', () => {
    for (const share of [report.tapShareFirst, report.tapShareAfterColony]) {
      if (share !== null) {
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(100);
      }
    }
    expect(report.tapShareFirst).not.toBeNull();
    const actions = result.probes.checkIns.map((c) => c.actions);
    expect(report.medianActions).toBeGreaterThanOrEqual(Math.min(...actions));
    expect(report.medianActions).toBeLessThanOrEqual(Math.max(...actions));
    expect(report.idle).toEqual(idleCheckIns(result.probes.checkIns, targets.idleCheckInMaxMs));
  });

  it('prints a line per phase with its target, and every idle check-in', () => {
    const text = formatPacingReport(report);
    for (const t of targets.phases) {
      const line = text.split('\n').find((l) => l.includes(t.label));
      expect(line).toBeDefined();
      expect(line).toContain(t.finish.label);
    }
    expect(text).toMatch(/tapping/i);
    expect(text).toMatch(/median/i);
    expect(text).toContain(`${report.idle.length}`);
    expect(text).toMatch(/food-critical/i);
    expect(text).toMatch(/capacity-critical/i);
  });

  it('prints the food lost at the limit per day (Story 9.15)', () => {
    expect(report.foodLost).toEqual(foodLostPerDay(result.probes.checkIns));
    expect(formatPacingReport(report)).toMatch(/lost at the limit/i);
  });

  it('prints the share of check-ins that started crowded, per phase (Story 9.13)', () => {
    expect(report.crowded).toEqual(crowdedShares(result.probes.checkIns));
    const text = formatPacingReport(report);
    expect(text).toMatch(/started crowded/i);
    for (const x of report.crowded) expect(text).toContain(`${x.phase} ${x.percent}%`);
  });

  it('prints the starvation deaths per check-in, the stretches and their bounds (Story 9.16)', () => {
    expect(report.starvation).toEqual(starvationReport(result.probes.checkIns, targets.starvation));
    const text = formatPacingReport(report);
    expect(text).toMatch(/starvation deaths/i);
    expect(text).toMatch(/starving stretch/i);
  });

  it('counts the critical moments of the target phase from the probes (Story 3.11)', () => {
    expect(report.critical).toEqual(criticalMoments(result.probes.checkIns, targets.criticalMoments.phase));
  });

  // Runs two full first-week simulations (~6s) — over vitest's default 5s
  // timeout. Bump it so a slow CI runner can't flake this test.
  it('runPacingReport plays a fresh game over the first-week schedule (Story 9.1)', { timeout: 20000 }, () => {
    const r = runPacingReport({ seed: 1, days: 1 });
    const own = runSim({ state: createInitialState(), seed: 1, schedule: firstWeekSchedule(1) });
    expect(r.checkIns).toBe(firstWeekSchedule(1).length);
    expect(r.rows).toEqual(buildPacingReport(own, { seed: 1, days: 1 }).rows);
    expect(r.gates).toEqual(buildPacingReport(own, { seed: 1, days: 1 }).gates);
  });

  it('prints the three gates, each with its target and a pass or fail (Story 9.1)', () => {
    const text = formatPacingReport(report);
    expect(report.gates).toHaveLength(3);
    for (const g of report.gates) {
      const line = text.split('\n').find((l) => l.includes(g.label));
      expect(line).toBeDefined();
      expect(line).toContain(g.target);
      expect(line).toMatch(/PASS|FAIL|open/);
    }
  });
});

describe('pacing targets (Story 3.9)', () => {
  it('cover the MVP phases in phase order, with sane windows', () => {
    const phases = pacingTargets.phases.map((t) => t.phase);
    expect(phases).toEqual(expect.arrayContaining([Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT]));
    const order = phases.map((p) => PHASE_ORDER.indexOf(p));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const t of pacingTargets.phases) {
      if (t.activeMs) expect(t.activeMs.min).toBeLessThanOrEqual(t.activeMs.max);
      if (t.finish.kind === 'days') expect(t.finish.fromDay).toBeLessThanOrEqual(t.finish.toDay);
      else expect(t.finish.within).toBeGreaterThan(0);
    }
  });
});

describe('Probes for the report (Story 3.9)', () => {
  const schedule = repeatCheckIns(2, { awayMs: 0, activeMs: simBalance.checkInActiveMs });
  const start = createInitialState();
  const r = runSim({ state: start, seed: 1, schedule });

  it('ledger every egg laid, tapped ones included, with the phase it was laid in', () => {
    const laid = r.probes.eggs.reduce((t, e) => t + e.laid, 0);
    const tapped = r.probes.eggs.reduce((t, e) => t + e.tapped, 0);
    expect(laid).toBe(r.state.stats.totalEggsLaid - start.stats.totalEggsLaid);
    expect(tapped).toBeGreaterThan(0);
    for (const e of r.probes.eggs) {
      expect(e.tapped).toBeLessThanOrEqual(e.laid);
      expect(PHASE_ORDER).toContain(e.phase);
    }
  });

  it('record on arrival how long until something can be done: 0 when a decision is open', () => {
    for (const c of r.probes.checkIns) {
      if (c.waitMs !== null) {
        expect(Number.isInteger(c.waitMs)).toBe(true);
        expect(c.waitMs).toBeGreaterThanOrEqual(0);
      }
      if (c.decisionsAvailable > 0) expect(c.waitMs).toBe(0);
    }
  });
});

describe('critical-moment probes (Story 3.11)', () => {
  it('flag a check-in whose arrival state is food-critical and capacity-critical', () => {
    const base = createInitialState();
    // Colony, nest full, a stock under the upkeep window and no food income.
    const s = {
      ...base,
      phase: Phase.COLONY,
      resources: { ...base.resources, workers: 20, nestCapacity: 20, food: 0 },
      workersAssigned: { ...base.workersAssigned, dig: 20 },
    };
    expect(isFoodCritical(s)).toBe(true);
    expect(isCapacityCritical(s)).toBe(true);
    const run = runSim({ state: s, seed: 1, schedule: repeatCheckIns(1, { awayMs: 0, activeMs: simBalance.activeStepMs }) });
    expect(run.probes.checkIns[0].foodCritical).toBe(true);
    expect(run.probes.checkIns[0].capacityCritical).toBe(true);
  });

  it('leave both flags down in a check-in where neither ever bites', () => {
    const run = runSim({ state: createInitialState(), seed: 1, schedule: repeatCheckIns(1, { awayMs: 0, activeMs: simBalance.activeStepMs }) });
    expect(run.probes.checkIns[0].foodCritical).toBe(false);
    expect(run.probes.checkIns[0].capacityCritical).toBe(false);
  });
});

/** Story 9.1 (FR65): the three first-week gates are pure verdicts over probe data. */
describe('first-week gates (Story 9.1)', () => {
  const gates = pacingTargets.gates;
  const payoff = (activeMs: number): Payoff => ({ kind: 'affordable', atMs: activeMs, activeMs, checkIn: 0 });

  describe('longestIdleGap', () => {
    it('is the longest stretch of play with no payoff, counted to the window end', () => {
      expect(longestIdleGap([payoff(0), payoff(1 * MIN), payoff(4 * MIN)], 5 * MIN)).toBe(3 * MIN);
      expect(longestIdleGap([payoff(1 * MIN)], 5 * MIN)).toBe(4 * MIN);
    });

    it('ignores payoffs past the window and is the whole window with none', () => {
      expect(longestIdleGap([payoff(20 * MIN)], 5 * MIN)).toBe(5 * MIN);
      expect(longestIdleGap([], 5 * MIN)).toBe(5 * MIN);
    });
  });

  describe('gate 1: idle gaps in session 1', () => {
    const over = gates.idleGap.maxMs + MIN;
    const under = Math.floor(gates.idleGap.maxMs / 2);
    const every = (gap: number) => Array.from({ length: Math.ceil(gates.idleGap.windowMs / gap) + 1 }, (_, i) => payoff(i * gap));

    it('fails a gap over the limit and passes gaps under it', () => {
      expect(idleGapGate(every(over), gates.idleGap.windowMs, gates.idleGap).verdict).toBe('fail');
      expect(idleGapGate(every(under), gates.idleGap.windowMs, gates.idleGap).verdict).toBe('pass');
    });

    it('measures only as far as session 1 was played', () => {
      const short = Math.floor(gates.idleGap.windowMs / 2);
      const g = idleGapGate([payoff(0)], short, gates.idleGap);
      expect(g.valueMs).toBe(short);
    });
  });

  describe('gate 2: when Phase 3 ends', () => {
    const span = (endedOnDay: number | null): PhaseSpan => ({
      phase: gates.phaseEnd.phase, startedAtMs: 0, startedActiveMs: 0, activeMs: 0, realMs: 0,
      completed: endedOnDay !== null, endedAtMs: endedOnDay === null ? null : (endedOnDay - 1) * DAY_MS, endedOnDay, endedInCheckIn: endedOnDay === null ? null : 0,
    });
    const after = { atMs: (gates.phaseEnd.toDay + 1) * DAY_MS };

    it('passes inside the window, fails before or after it', () => {
      expect(phaseEndGate([span(gates.phaseEnd.fromDay)], after, gates.phaseEnd).verdict).toBe('pass');
      expect(phaseEndGate([span(gates.phaseEnd.toDay)], after, gates.phaseEnd).verdict).toBe('pass');
      expect(phaseEndGate([span(gates.phaseEnd.fromDay - 1)], after, gates.phaseEnd).verdict).toBe('fail');
      expect(phaseEndGate([span(gates.phaseEnd.toDay + 1)], after, gates.phaseEnd).verdict).toBe('fail');
    });

    it('fails a phase still open past the window (or never reached), and is open before it', () => {
      expect(phaseEndGate([span(null)], after, gates.phaseEnd).verdict).toBe('fail');
      expect(phaseEndGate([], after, gates.phaseEnd).verdict).toBe('fail');
      expect(phaseEndGate([span(null)], { atMs: DAY_MS }, gates.phaseEnd).verdict).toBe('open');
    });
  });

  describe('gate 3: post-week check-ins', () => {
    const late = (i: number, activeMs: number, decisionsAvailable: number): CheckInRecord =>
      checkIn(i, { startMs: gates.postWeek.afterDay * DAY_MS + i * HOUR_MS, activeMs, decisionsAvailable });
    const inRange = Math.floor((gates.postWeek.medianMs.min + gates.postWeek.medianMs.max) / 2);

    it('passes a median inside the range with a decision in every check-in', () => {
      const g = postWeekGate([late(0, inRange, 1), late(1, inRange, 2), late(2, inRange, 1)], gates.postWeek);
      expect(g.verdict).toBe('pass');
    });

    it('fails a median outside the range', () => {
      const long = gates.postWeek.medianMs.max + MIN;
      expect(postWeekGate([late(0, long, 1), late(1, long, 1)], gates.postWeek).verdict).toBe('fail');
      const short = Math.floor(gates.postWeek.medianMs.min / 2);
      expect(postWeekGate([late(0, short, 1), late(1, short, 1)], gates.postWeek).verdict).toBe('fail');
    });

    it('fails when a check-in offers no decision', () => {
      expect(postWeekGate([late(0, inRange, 1), late(1, inRange, 0)], gates.postWeek).verdict).toBe('fail');
    });

    it('counts only check-ins after the week, and is open with none', () => {
      const early = checkIn(0, { startMs: 0, activeMs: inRange, decisionsAvailable: 0 });
      expect(postWeekGate([early, late(1, inRange, 1)], gates.postWeek).verdict).toBe('pass');
      expect(postWeekGate([early], gates.postWeek).verdict).toBe('open');
    });
  });
});

describe('phase targets follow the first-week Difficulty Curve (Story 9.1)', () => {
  const colony = pacingTargets.phases.find((t) => t.phase === Phase.COLONY)!;

  it('Colony ends on day 1 but in a later session than the first: ending in session 1 is fast', () => {
    expect(colony.finish.kind).toBe('days');
    const ended = (checkInIndex: number): PhaseSpan => ({
      phase: Phase.COLONY, startedAtMs: 0, startedActiveMs: 0, activeMs: 0, realMs: 0, completed: true,
      endedAtMs: HOUR_MS, endedOnDay: 1, endedInCheckIn: checkInIndex,
    });
    expect(judgeSpan(ended(0), colony).realTime).toBe('fast');
    expect(judgeSpan(ended(2), colony).realTime).toBe('ok');
  });
});
