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
  idleCheckIns,
  judgeSpan,
  median,
  phaseSpans,
  runPacingReport,
  tapShare,
  type PacingTargets,
  type PhaseSpan,
} from '../../src/sim/report';
import type { CheckInRecord, EggSample, ProbeReport } from '../../src/sim/probes';
import { runSim } from '../../src/sim/runner';
import { dailySchedule, repeatCheckIns } from '../../src/sim/schedule';
import { createInitialState } from '../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import { pacingTargets } from '../../src/data/balance/pacing';
import { simBalance } from '../../src/data/balance/sim';
import { DAY_MS, HOUR_MS } from '../../src/data/constants';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const MIN = 60_000;

function checkIn(index: number, over: Partial<CheckInRecord> = {}): CheckInRecord {
  return { index, startMs: index * HOUR_MS, phase: Phase.COLONY, decisionsAvailable: 0, waitMs: 0, actions: 0, taps: 0, refused: 0, byAction: {}, ...over };
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
  });

  it('runPacingReport plays a fresh game over the day schedule it is given', () => {
    const r = runPacingReport({ seed: 1, days: 1 });
    expect(r.checkIns).toBe(schedule.length);
    expect(r.rows).toEqual(report.rows);
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
