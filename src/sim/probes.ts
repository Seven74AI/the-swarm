import type { GameState } from '../state/GameState';
import { getNextAction, isItemAffordable, listItems } from '../systems/NextAction';

/** The moment a phase was entered (Story 3.7). */
export interface PhaseEntry {
  readonly phase: string;
  /** Real time since the run started (gaps included). */
  readonly atMs: number;
  /** Time played since the run started (check-in time only). */
  readonly activeMs: number;
  /** The check-in it was entered in (0 for the start phase). */
  readonly checkIn: number;
}

/** What one check-in did (Story 3.7). */
export interface CheckInRecord {
  readonly index: number;
  /** Real time since the run started, when the player arrived. */
  readonly startMs: number;
  /** The phase on arrival. */
  readonly phase: string;
  /** Decisions open on arrival: every item affordable now, plus CONTINUE when the goal has latched. */
  readonly decisionsAvailable: number;
  /** Moves that landed, taps excluded. */
  readonly actions: number;
  /** LAY EGG taps that landed. */
  readonly taps: number;
  /** Moves the actions refused (the policy suggested something stale). */
  readonly refused: number;
  /** `actions`, by action name (`continuePhase`, `buyBuilding`, `trainSoldier`, `fight` …). */
  readonly byAction: Readonly<Record<string, number>>;
}

export interface ProbeReport {
  readonly phaseEntries: readonly PhaseEntry[];
  readonly checkIns: readonly CheckInRecord[];
}

/**
 * The choices a player has right now (Story 3.7's "decisions available"):
 * each item they can buy, plus CONTINUE when the goal has latched. Decision
 * events never fire in the harness, so they are not counted.
 */
export function decisionsAvailable(s: GameState): number {
  const items = listItems().filter((ref) => isItemAffordable(s, ref)).length;
  const next = getNextAction(s);
  return items + (next.kind === 'act' && next.rule === 'goal' ? 1 : 0);
}

interface OpenCheckIn {
  index: number;
  startMs: number;
  phase: string;
  decisionsAvailable: number;
  actions: number;
  taps: number;
  refused: number;
  byAction: Record<string, number>;
}

/**
 * The run's probes (Story 3.7, AR15): when each phase was entered, and per
 * check-in the actions taken and the decisions available. The runner feeds
 * them; they never change the game.
 */
export class Probes {
  private readonly entries: PhaseEntry[] = [];
  private readonly records: CheckInRecord[] = [];
  private open: OpenCheckIn | null = null;
  private lastPhase: string;

  constructor(start: GameState) {
    this.lastPhase = start.phase;
    this.entries.push({ phase: start.phase, atMs: 0, activeMs: 0, checkIn: 0 });
  }

  /** A check-in starts: the player has just arrived to `s`. */
  beginCheckIn(index: number, s: GameState, atMs: number): void {
    this.endCheckIn();
    this.open = { index, startMs: atMs, phase: s.phase, decisionsAvailable: decisionsAvailable(s), actions: 0, taps: 0, refused: 0, byAction: {} };
  }

  /** A move went through its action: `ok` says whether the action accepted it. */
  move(name: string, ok: boolean): void {
    if (!this.open) return;
    if (!ok) {
      this.open.refused += 1;
      return;
    }
    this.open.actions += 1;
    this.open.byAction[name] = (this.open.byAction[name] ?? 0) + 1;
  }

  /** `count` LAY EGG taps landed. */
  taps(count: number): void {
    if (this.open) this.open.taps += count;
  }

  /** After every move and every resume: records a phase change. */
  observe(s: GameState, atMs: number, activeMs: number): void {
    if (s.phase === this.lastPhase) return;
    this.lastPhase = s.phase;
    this.entries.push({ phase: s.phase, atMs, activeMs, checkIn: this.open?.index ?? 0 });
  }

  endCheckIn(): void {
    if (!this.open) return;
    this.records.push({ ...this.open, byAction: { ...this.open.byAction } });
    this.open = null;
  }

  report(): ProbeReport {
    this.endCheckIn();
    return { phaseEntries: [...this.entries], checkIns: [...this.records] };
  }
}
