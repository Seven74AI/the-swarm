import { describe, expect, it, vi } from 'vitest';
import { createResumePath, resume, type ResumePathDeps, type ResumeResult } from '../../../src/engine/resume';
import type { CatchUpDeps } from '../../../src/engine/catchUp';
import { EventBus } from '../../../src/engine/EventBus';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { RESUME_FULL_EFFICIENCY_MS } from '../../../src/data/constants';
import { getOfflineEfficiency } from '../../../src/systems/OfflineProgression';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';

/**
 * Story 2.3 (D1, ADR 0002): every way back goes through one `resume(elapsedMs)`.
 * Gaps under 60 s run at full efficiency with no summary; 60 s or more is
 * offline time at the save's offline efficiency.
 */

function catchUpDeps(): CatchUpDeps {
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

const colony = (over: Parameters<typeof makeState>[0] = {}): GameState =>
  makeState({
    phase: 'colony',
    resources: { workers: 10, food: 100, eggs: 20 },
    eggPipeline: { count: 20, progress: 0 },
    workersAssigned: { gather: 10 },
    ...over,
  });

describe('resume(elapsedMs)', () => {
  it('treats a negative or missing gap as no time at all', () => {
    const before = colony();
    for (const gap of [-5_000, 0, Number.NaN]) {
      const r = resume(before, gap, catchUpDeps());
      expect(r.state).toBe(before);
      expect(r.elapsedMs).toBe(0);
      expect(r.offline).toBeNull();
    }
  });

  it('runs a gap under 60 s at full efficiency, with no offline summary', () => {
    const before = colony();
    const gap = RESUME_FULL_EFFICIENCY_MS - 10_000;
    const r = resume(before, gap, catchUpDeps());
    expect(r.offline).toBeNull();
    expect(r.efficiency).toBe(1);
    // Full efficiency: the whole gap passes as game time (to the 50 ms step).
    expect(r.state.stats.playTimeMs - before.stats.playTimeMs).toBeGreaterThan(gap - 50);
    expect(r.state.stats.playTimeMs - before.stats.playTimeMs).toBeLessThanOrEqual(gap);
    expect(r.state.resources.food).toBeGreaterThan(before.resources.food);
  });

  it('hands 60 s or more to the offline path at the offline efficiency', () => {
    const before = colony();
    const gap = RESUME_FULL_EFFICIENCY_MS;
    const r = resume(before, gap, catchUpDeps());
    expect(r.offline).not.toBeNull();
    expect(r.offline!.elapsedMs).toBe(gap);
    expect(r.offline!.efficiency).toBe(getOfflineEfficiency(before));
    expect(r.efficiency).toBe(getOfflineEfficiency(before));
    // Reduced efficiency: fewer ticks than the gap holds.
    expect(r.offline!.offlineTicks).toBeLessThan(Math.floor(gap / 50));
    expect(r.offline!.offlineTicks).toBeGreaterThan(0);
  });

  it('never writes the state it was given', () => {
    const before = colony();
    const snapshot = JSON.stringify(before);
    resume(before, 30_000, catchUpDeps());
    resume(before, 120_000, catchUpDeps());
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('never commits a phase', () => {
    const before = colony();
    expect(resume(before, 3_600_000, catchUpDeps()).state.phase).toBe(before.phase);
  });
});

/** A controllable clock, state cell and ticker for the resume path. */
function harness(over: Partial<ResumePathDeps> = {}) {
  let now = 1_000_000;
  let state = colony();
  let running = true;
  const real = catchUpDeps();
  const resumeSpy = vi.fn((s: GameState, ms: number) => resume(s, ms, real));
  const writes: GameState[] = [];
  const saves: number[] = [];
  const resumed = vi.fn<(r: ResumeResult, before: GameState) => void>();
  const deps: ResumePathDeps = {
    now: () => now,
    read: () => state,
    write: (s) => {
      writes.push(s);
      state = s;
    },
    resume: resumeSpy,
    save: () => saves.push(path.seenAt()),
    ticker: {
      start: vi.fn(() => void (running = true)),
      stop: vi.fn(() => void (running = false)),
      isRunning: () => running,
    },
    onResumed: resumed,
    ...over,
  };
  const path = createResumePath(deps);
  return {
    path,
    deps,
    resumeSpy,
    resumed,
    writes,
    saves,
    advance: (ms: number) => void (now += ms),
    now: () => now,
    running: () => running,
    state: () => state,
  };
}

describe('createResumePath (the one way back)', () => {
  it('a cold load calls resume once, with the gap from lastSeenAt', () => {
    const h = harness();
    h.path.coldStart(h.now() - 20_000);
    expect(h.resumeSpy).toHaveBeenCalledTimes(1);
    expect(h.resumeSpy.mock.calls[0][1]).toBe(20_000);
    expect(h.writes).toHaveLength(1);
  });

  it('a cold load with a lastSeenAt in the future resumes 0 ms', () => {
    const h = harness();
    const before = h.state();
    h.path.coldStart(h.now() + 60_000);
    expect(h.resumeSpy).toHaveBeenCalledTimes(1);
    expect(h.resumed.mock.calls[0][0].elapsedMs).toBe(0);
    expect(h.state()).toBe(before);
  });

  it('a cold load with no save resumes 0 ms', () => {
    const h = harness();
    h.path.coldStart(null);
    expect(h.resumeSpy).toHaveBeenCalledTimes(1);
    expect(h.resumed.mock.calls[0][0].elapsedMs).toBe(0);
  });

  it('hiding saves with lastSeenAt = the moment of hiding and stops the ticker', () => {
    const h = harness();
    const hiddenAt = h.now();
    h.path.hide();
    expect(h.saves).toEqual([hiddenAt]);
    expect(h.running()).toBe(false);
    // Time passes while hidden: nothing is simulated and lastSeenAt stays put.
    h.advance(45_000);
    expect(h.path.seenAt()).toBe(hiddenAt);
    expect(h.resumeSpy).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
  });

  it('a second hide (visibilitychange then pagehide) saves once and keeps the first lastSeenAt', () => {
    const h = harness();
    const hiddenAt = h.now();
    h.path.hide();
    h.advance(1_000);
    h.path.hide();
    expect(h.saves).toEqual([hiddenAt]);
    expect(h.path.seenAt()).toBe(hiddenAt);
  });

  it('returning resumes once with the hidden time, then restarts the ticker', () => {
    const h = harness();
    h.path.hide();
    h.advance(30_000);
    h.path.show();
    expect(h.resumeSpy).toHaveBeenCalledTimes(1);
    expect(h.resumeSpy.mock.calls[0][1]).toBe(30_000);
    expect(h.running()).toBe(true);
    expect(h.path.seenAt()).toBe(h.now());
  });

  it('applies the gap once however many return signals arrive (visible, pageshow, focus)', () => {
    const h = harness();
    h.path.hide();
    h.advance(30_000);
    h.path.show();
    h.path.show();
    h.path.show();
    expect(h.resumeSpy).toHaveBeenCalledTimes(1);
    expect(h.writes).toHaveLength(1);
    expect(h.deps.ticker.start).toHaveBeenCalledTimes(1);
  });

  it('a return signal without a hide (a focus on a visible page) resumes nothing', () => {
    const h = harness();
    h.path.show();
    expect(h.resumeSpy).not.toHaveBeenCalled();
    expect(h.deps.ticker.start).not.toHaveBeenCalled();
  });

  it('a long return goes to the offline path and reports its summary', () => {
    const h = harness();
    h.path.hide();
    h.advance(5 * 60_000);
    h.path.show();
    const [result, before] = h.resumed.mock.calls[0];
    expect(result.offline).not.toBeNull();
    expect(result.offline!.elapsedMs).toBe(5 * 60_000);
    expect(before).not.toBe(h.state());
  });

  it('a frame gap goes to resume(gap)', () => {
    const h = harness();
    h.path.frameGap(4_000);
    expect(h.resumeSpy).toHaveBeenCalledTimes(1);
    expect(h.resumeSpy.mock.calls[0][1]).toBe(4_000);
    expect(h.writes).toHaveLength(1);
  });

  it('simulates nothing on return when the game was not running when hidden (waiting or paused)', () => {
    const h = harness();
    h.deps.ticker.stop();
    h.path.hide();
    h.advance(30_000);
    h.path.show();
    expect(h.resumeSpy).not.toHaveBeenCalled();
    expect(h.running()).toBe(false);
  });

  it('a halted simulation is never resumed (its last good snapshot stays the save)', () => {
    const h = harness({ halted: () => true });
    h.path.coldStart(h.now() - 20_000);
    h.path.frameGap(5_000);
    expect(h.resumeSpy).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
  });
});
