import { createInitialState } from '../state/GameState';
import { Phase, PHASE_ORDER } from '../phases/phases';
import { DAY_MS } from '../data/constants';
import { simBalance } from '../data/balance/sim';
import { pacingReportDefaults, pacingTargets, type PacingTargets, type PhaseTarget } from '../data/balance/pacing';
import { formatTime } from '../utils/format';
import { runSim, type SimResult } from './runner';
import { dailySchedule } from './schedule';
import type { CheckInRecord, EggSample, ProbeReport } from './probes';

export type { PacingTargets, PhaseTarget } from '../data/balance/pacing';

/** How long one phase lasted in a run (Story 3.9). */
export interface PhaseSpan {
  readonly phase: string;
  /** Real time and time played since the run started, when the phase was entered. */
  readonly startedAtMs: number;
  readonly startedActiveMs: number;
  /** Time played in the phase. */
  readonly activeMs: number;
  /** Real time in the phase, gaps included. */
  readonly realMs: number;
  /** False for the phase the run ended in: its times are lower bounds. */
  readonly completed: boolean;
  /** Real time since the run started when the next phase was entered; null while open. */
  readonly endedAtMs: number | null;
  /** The day (from 1) it ended on; null while open. */
  readonly endedOnDay: number | null;
  /** The check-in (from 0) it ended in; null while open. */
  readonly endedInCheckIn: number | null;
}

/** Against a target: `fast` (done before the window), `ok`, `slow` (after it), `open` (not done yet, window not passed), `none` (no target). */
export type Verdict = 'fast' | 'ok' | 'slow' | 'open' | 'none';

/** Where the run ended: how judging an open phase knows the window has passed. */
export interface RunEnd {
  readonly atMs: number;
  /** Check-ins played. */
  readonly checkIns: number;
}

/** Every phase entered, from its entry to the next one's (or to the end of the run). Pure. */
export function phaseSpans(probes: ProbeReport, end: { readonly atMs: number; readonly activeMs: number }): PhaseSpan[] {
  const entries = probes.phaseEntries;
  return entries.map((e, i) => {
    const next = entries[i + 1];
    if (!next) {
      return { phase: e.phase, startedAtMs: e.atMs, startedActiveMs: e.activeMs, activeMs: end.activeMs - e.activeMs, realMs: end.atMs - e.atMs, completed: false, endedAtMs: null, endedOnDay: null, endedInCheckIn: null };
    }
    return {
      phase: e.phase,
      startedAtMs: e.atMs,
      startedActiveMs: e.activeMs,
      activeMs: next.activeMs - e.activeMs,
      realMs: next.atMs - e.atMs,
      completed: true,
      endedAtMs: next.atMs,
      endedOnDay: Math.floor(next.atMs / DAY_MS) + 1,
      endedInCheckIn: next.checkIn,
    };
  });
}

function judgeActive(span: PhaseSpan, target: PhaseTarget): Verdict {
  if (!target.activeMs) return 'none';
  if (span.activeMs > target.activeMs.max) return 'slow';
  if (!span.completed) return 'open';
  return span.activeMs < target.activeMs.min ? 'fast' : 'ok';
}

function judgeRealTime(span: PhaseSpan, target: PhaseTarget, run: RunEnd): Verdict {
  const t = target.finish;
  if (t.kind === 'checkIns') {
    if (span.endedInCheckIn === null) return run.checkIns >= t.within ? 'slow' : 'open';
    return span.endedInCheckIn < t.within ? 'ok' : 'slow';
  }
  if (span.endedOnDay === null) return run.atMs >= t.toDay * DAY_MS ? 'slow' : 'open';
  if (span.endedOnDay < t.fromDay) return 'fast';
  return span.endedOnDay > t.toDay ? 'slow' : 'ok';
}

/** A phase's span against its GDD target (Story 3.9). Pure. */
export function judgeSpan(span: PhaseSpan, target: PhaseTarget, run: RunEnd = { atMs: 0, checkIns: 0 }): { active: Verdict; realTime: Verdict } {
  return { active: judgeActive(span, target), realTime: judgeRealTime(span, target, run) };
}

/** The share (whole %, floored) of the eggs in the samples `inWindow` keeps that came from tapping; null when none were laid. Pure. */
export function tapShare(eggs: readonly EggSample[], inWindow: (e: EggSample) => boolean): number | null {
  let laid = 0;
  let tapped = 0;
  for (const e of eggs) {
    if (!inWindow(e)) continue;
    laid += e.laid;
    tapped += e.tapped;
  }
  return laid > 0 ? Math.floor((tapped * 100) / laid) : null;
}

/** The median; null for no values. Pure. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The check-ins where nothing was affordable within `limitMs` (GDD: a pacing
 * defect): on arrival the soonest move was more than `limitMs` away (or never
 * came at the current rates), and the check-in's own play opened none either
 * (no move landed). Taps alone don't count as a move. Pure.
 */
export function idleCheckIns(checkIns: readonly CheckInRecord[], limitMs: number): CheckInRecord[] {
  return checkIns.filter((c) => c.actions === 0 && (c.waitMs === null || c.waitMs > limitMs));
}

/** In how many of a phase's check-ins food, and capacity, was critical (Story 3.11). Pure. */
export function criticalMoments(checkIns: readonly CheckInRecord[], phase: string): { food: number; capacity: number } {
  const inPhase = checkIns.filter((c) => c.phase === phase);
  return { food: inPhase.filter((c) => c.foodCritical).length, capacity: inPhase.filter((c) => c.capacityCritical).length };
}

export interface PacingRow {
  readonly target: PhaseTarget;
  /** Null when the run never reached the phase. */
  readonly span: PhaseSpan | null;
  readonly verdict: { readonly active: Verdict; readonly realTime: Verdict };
}

export interface PacingReport {
  readonly seed: number;
  readonly days: number;
  readonly checkIns: number;
  readonly activeMs: number;
  readonly elapsedMs: number;
  readonly targets: PacingTargets;
  readonly rows: readonly PacingRow[];
  /** Every phase the run entered, the MVP ones included. */
  readonly spans: readonly PhaseSpan[];
  /** % of eggs from tapping in the first `tapWindowMs` of play, and from Colony on; null when no egg was laid there. */
  readonly tapShareFirst: number | null;
  readonly tapShareAfterColony: number | null;
  readonly medianActions: number | null;
  readonly idle: readonly CheckInRecord[];
  /** Check-ins of `targets.criticalMoments.phase` where food, and capacity, was critical (Story 3.11). */
  readonly critical: { readonly food: number; readonly capacity: number };
}

/** The report's numbers for one run (Story 3.9). Pure. */
export function buildPacingReport(result: SimResult, opts: { readonly seed: number; readonly days: number; readonly targets?: PacingTargets }): PacingReport {
  const targets = opts.targets ?? pacingTargets;
  const { probes } = result;
  const spans = phaseSpans(probes, { atMs: result.elapsedMs, activeMs: result.activeMs });
  const run: RunEnd = { atMs: result.elapsedMs, checkIns: probes.checkIns.length };
  const rows = targets.phases.map((target): PacingRow => {
    const span = spans.find((s) => s.phase === target.phase) ?? null;
    return { target, span, verdict: span ? judgeSpan(span, target, run) : { active: 'open', realTime: 'open' } };
  });
  const colony = PHASE_ORDER.indexOf(Phase.COLONY);
  return {
    seed: opts.seed,
    days: opts.days,
    checkIns: probes.checkIns.length,
    activeMs: result.activeMs,
    elapsedMs: result.elapsedMs,
    targets,
    rows,
    spans,
    tapShareFirst: tapShare(probes.eggs, (e) => e.activeMs <= targets.tapWindowMs),
    tapShareAfterColony: tapShare(probes.eggs, (e) => PHASE_ORDER.indexOf(e.phase as Phase) >= colony),
    medianActions: median(probes.checkIns.map((c) => c.actions)),
    idle: idleCheckIns(probes.checkIns, targets.idleCheckInMaxMs),
    critical: criticalMoments(probes.checkIns, targets.criticalMoments.phase),
  };
}

/** Play a fresh game over `days` of check-ins and measure it (architecture N2's `runPacingReport`). */
export function runPacingReport(opts: { readonly seed?: number; readonly days?: number } = {}): PacingReport {
  const seed = opts.seed ?? pacingReportDefaults.seed;
  const days = opts.days ?? pacingReportDefaults.days;
  const result = runSim({ state: createInitialState(), seed, schedule: dailySchedule(days) });
  return buildPacingReport(result, { seed, days });
}

/** Real time as `2d 3h 4m` from a day on, else `formatTime`. */
function span(ms: number): string {
  if (ms < DAY_MS) return formatTime(ms);
  const days = Math.floor(ms / DAY_MS);
  return `${days}d ${formatTime(ms - days * DAY_MS)}`;
}

function activeTarget(t: PhaseTarget): string {
  return t.activeMs ? `${formatTime(t.activeMs.min)}–${formatTime(t.activeMs.max)}` : 'TBD';
}

function ended(s: PhaseSpan | null): string {
  if (!s) return 'not reached';
  if (!s.completed) return `open (≥ ${span(s.realMs)})`;
  return `day ${s.endedOnDay}, check-in ${(s.endedInCheckIn ?? 0) + 1}`;
}

const VERDICT: Record<Verdict, string> = { fast: 'FAST', ok: 'ok', slow: 'SLOW', open: '…', none: '' };

function pad(cells: readonly string[], widths: readonly number[]): string {
  return cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
}

function pct(n: number | null): string {
  return n === null ? 'n/a (no eggs laid)' : `${n}%`;
}

/** The label of the phase the critical moments are counted in. */
function phaseLabel(r: PacingReport): string {
  const p = r.targets.criticalMoments.phase;
  return `Phase ${r.targets.phases.find((t) => t.phase === p)?.label ?? p}`;
}

/** Phases the run reached past the targets' (Expansion, Space …): where each started. */
function laterPhases(r: PacingReport): string[] {
  const listed = new Set<string>(r.targets.phases.map((t) => t.phase));
  return r.spans
    .filter((s) => !listed.has(s.phase))
    .map((s) => `  - ${s.phase}: entered day ${Math.floor(s.startedAtMs / DAY_MS) + 1} after ${formatTime(s.startedActiveMs)} of play; ${s.completed ? `lasted ${formatTime(s.activeMs)} played, ${span(s.realMs)} real` : 'run ended in it'}`);
}

/** The report as a plain-text table (what `pnpm sim` prints). Pure. */
export function formatPacingReport(r: PacingReport): string {
  const t = r.targets;
  const head = ['Phase', 'Active', 'Target', '', 'Real time', 'Ended', 'Target', ''];
  const body = r.rows.map((row) => [
    row.target.label,
    row.span ? `${row.span.completed ? '' : '≥ '}${formatTime(row.span.activeMs)}` : '-',
    activeTarget(row.target),
    VERDICT[row.verdict.active],
    row.span ? `${row.span.completed ? '' : '≥ '}${span(row.span.realMs)}` : '-',
    ended(row.span),
    row.target.finish.label,
    VERDICT[row.verdict.realTime],
  ]);
  const widths = head.map((_, i) => Math.max(...[head, ...body].map((l) => l[i].length)));
  const lines = [
    `THE SWARM pacing report: seed ${r.seed}, ${r.days} day(s), ${r.checkIns} check-ins (${simBalance.checkInsPerDay} a day, ${formatTime(simBalance.checkInActiveMs)} each)`,
    `Played ${formatTime(r.activeMs)} over ${span(r.elapsedMs)} of real time.`,
    '',
    pad(head, widths),
    ...body.map((l) => pad(l, widths)),
    '',
    `Eggs from tapping, first ${formatTime(t.tapWindowMs)} of play: ${pct(r.tapShareFirst)} (target ≥ ${t.tapShareFirstMinPercent}%)`,
    `Eggs from tapping, from Colony on: ${pct(r.tapShareAfterColony)} (target < ${t.tapShareAfterColonyMaxPercent}%)`,
    `Actions per check-in (taps excluded): median ${r.medianActions ?? 'n/a'}`,
    `${phaseLabel(r)} check-ins food-critical: ${r.critical.food}, capacity-critical: ${r.critical.capacity} (target ≥ ${t.criticalMoments.min} each)`,
    ...(laterPhases(r).length > 0 ? ['Later phases (no GDD target in the MVP):', ...laterPhases(r)] : []),
    `Check-ins with nothing affordable within ${formatTime(t.idleCheckInMaxMs)} (pacing defects): ${r.idle.length}`,
    ...r.idle.map((c) => `  - check-in ${c.index + 1} (day ${Math.floor(c.startMs / DAY_MS) + 1}, ${c.phase}): ${c.waitMs === null ? 'nothing ever affordable at current rates' : `next in ${span(c.waitMs)}`}`),
  ];
  return lines.join('\n');
}
