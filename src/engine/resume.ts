import type { GameState } from '../state/GameState';
import { RESUME_FULL_EFFICIENCY_MS } from '../data/constants';
import { getOfflineEfficiency, planOffline, type OfflinePlan } from '../systems/OfflineProgression';
import { log } from '../utils/log';
import { catchUp, catchUpWithReport, type CatchUpDeps } from './catchUp';

/**
 * What an offline resume (60 s or more) simulated: the offline summary's numbers.
 * The `OfflinePlan` from `planOffline` (time away, ms simulated, ticks, the cap
 * that applied and whether it was reached, Story 2.4) plus the efficiency.
 */
export interface OfflineLoadInfo extends OfflinePlan {
  /** The offline efficiency used (`getOfflineEfficiency(state)`, Story 2.8). */
  efficiency: number;
  /** Ms of the absence during which food stood at zero (Story 2.9, measured by catch-up). */
  starvedMs: number;
}

export interface ResumeResult {
  state: GameState;
  /** The gap resumed, after clamping (negative or not a number → 0). */
  elapsedMs: number;
  /** 1 under 60 s; the offline efficiency from 60 s on. */
  efficiency: number;
  /** Set for a gap of 60 s or more (the offline path); null otherwise. */
  offline: OfflineLoadInfo | null;
}

/** The game tick length the catch-up steps by. */
const TICK_MS = 50;

/**
 * Resume after `elapsedMs` away (Story 2.3, D1, ADR 0002). Pure: returns the
 * state after the gap.
 *
 * - `elapsedMs ≤ 0` (clock skew) or not a number: nothing is simulated.
 * - Under 60 s: simulated at full efficiency, no summary.
 * - 60 s or more: the offline path at the state's offline efficiency; `offline`
 *   holds the summary's numbers.
 *
 * The offline cap (Story 2.4, `getOfflineCapMs`) bounds every gap here and in
 * `catchUp`. Macro-steps (2.6), offline-only rules (2.7) and the
 * efficiency from research and Legacy nodes (2.8) build on this function; it stays the only entry point.
 */
export function resume(state: GameState, elapsedMs: number, deps: CatchUpDeps): ResumeResult {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  if (elapsed === 0) return { state, elapsedMs: 0, efficiency: 1, offline: null };

  if (elapsed < RESUME_FULL_EFFICIENCY_MS) {
    const ticks = Math.floor(elapsed / TICK_MS);
    const ms = ticks * TICK_MS;
    return { state: ticks > 0 ? catchUp(state, ms, ticks, deps) : state, elapsedMs: elapsed, efficiency: 1, offline: null };
  }

  const efficiency = getOfflineEfficiency(state);
  // At most getOfflineCapMs(state) of the gap is simulated (Story 2.4).
  const plan = planOffline(state, elapsed, efficiency);
  const { state: after, report } = catchUpWithReport(state, plan.effectiveMs, plan.offlineTicks, deps);
  return {
    state: after,
    elapsedMs: elapsed,
    efficiency,
    offline: { ...plan, efficiency, starvedMs: report.starvedMs },
  };
}

/** What the resume path drives: the game loop's start/stop. */
export interface ResumeTicker {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface ResumePathDeps {
  /** Wall clock (ms). Used only for gaps (D1). */
  now: () => number;
  read: () => GameState;
  /** One write per resume. */
  write: (state: GameState) => void;
  /** The resume function: `resume` with main's catch-up deps bound. */
  resume: (state: GameState, elapsedMs: number) => ResumeResult;
  /** A forced save; it reads `seenAt()` for its lastSeenAt. */
  save: () => void;
  ticker: ResumeTicker;
  /** True once the simulation has halted (Story 1.17): nothing is resumed then. */
  halted?: () => boolean;
  /** After each resume, with the state before it (main opens the summary for `offline`). */
  onResumed?: (result: ResumeResult, before: GameState) => void;
  /** Each time the pause starts or ends (Story 2.10): main shows the PAUSED overlay from it. */
  onPausedChange?: (paused: boolean) => void;
}

export interface ResumePath {
  /** Cold load: resume once from the save's lastSeenAt (null: no save, 0 ms). */
  coldStart(lastSeenAt: number | null): void;
  /** The page is hidden (visibilitychange, pagehide): save with lastSeenAt, stop the ticker. */
  hide(): void;
  /** A return signal (visible, pageshow, focus): resume the hidden time once, restart the ticker. */
  show(): void;
  /** A visible frame gap over 1 s (Ticker.onGap). */
  frameGap(gapMs: number): void;
  /** Wall-clock time the game state was last simulated to: the hide moment while hidden, else now. */
  seenAt(): number;
  isHidden(): boolean;
  /**
   * Pause while watched (Story 2.10): stop the ticker. Does nothing while
   * hidden, halted or not running (a game waiting behind a sheet).
   */
  pause(): void;
  /** End the pause: restart the ticker. The paused time is never simulated. */
  unpause(): void;
  isPaused(): boolean;
}

/**
 * The one way back (Story 2.3, D1). Cold load, return from hidden and long
 * frames all go through `apply`, which calls `resume` once and writes once.
 *
 * Hide and return signals arrive in bursts (visibilitychange + pagehide;
 * visible + pageshow + focus), so the first hide records the moment and the
 * first return after it consumes it: each gap is applied exactly once. A
 * return with no hide before it (a focus on a visible page) does nothing; a
 * stall without a hide reaches `frameGap` from the ticker instead.
 *
 * Time hidden is simulated only if the game was running when it hid: a game
 * waiting behind the unreadable-save sheet stays as it was.
 *
 * Pause is in-session only (Story 2.10, FR25, D1, ADR 0002). It lives here,
 * never in the save, so every new session starts unpaused. A pause stops the
 * ticker, and that time is never simulated. Hiding (or closing) a paused game
 * ends the pause first, so the game counts as running when it hid: the time
 * away comes back through `apply` like any other absence (full efficiency
 * under 60 s, the offline path and its summary from 60 s on).
 */
export function createResumePath(deps: ResumePathDeps): ResumePath {
  let hiddenAt: number | null = null;
  let wasRunning = false;
  let paused = false;

  const setPaused = (next: boolean): void => {
    paused = next;
    deps.onPausedChange?.(next);
  };

  const apply = (elapsedMs: number): void => {
    if (deps.halted?.()) return;
    const before = deps.read();
    const result = deps.resume(before, elapsedMs);
    log.info('resume', `resumed ${Math.round(result.elapsedMs)} ms`, {
      elapsedMs: result.elapsedMs,
      efficiency: result.efficiency,
      offline: result.offline !== null,
    });
    if (result.state !== before) deps.write(result.state);
    deps.onResumed?.(result, before);
  };

  return {
    coldStart(lastSeenAt) {
      apply(lastSeenAt === null ? 0 : deps.now() - lastSeenAt);
    },
    hide() {
      if (hiddenAt !== null) return;
      hiddenAt = deps.now();
      // Hiding ends a pause: the time away is then resumed as normal offline time.
      wasRunning = paused || deps.ticker.isRunning();
      if (paused) setPaused(false);
      if (deps.ticker.isRunning()) deps.ticker.stop();
      deps.save();
    },
    show() {
      if (hiddenAt === null) return;
      const elapsed = deps.now() - hiddenAt;
      hiddenAt = null;
      if (!wasRunning) return;
      apply(elapsed);
      deps.ticker.start();
    },
    frameGap(gapMs) {
      if (hiddenAt !== null) return;
      apply(gapMs);
    },
    seenAt() {
      return hiddenAt ?? deps.now();
    },
    isHidden() {
      return hiddenAt !== null;
    },
    pause() {
      if (paused || hiddenAt !== null || deps.halted?.() || !deps.ticker.isRunning()) return;
      deps.ticker.stop();
      setPaused(true);
    },
    unpause() {
      if (!paused) return;
      setPaused(false);
      deps.ticker.start();
    },
    isPaused() {
      return paused;
    },
  };
}
