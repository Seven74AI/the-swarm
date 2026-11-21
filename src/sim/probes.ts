import type { GameState } from '../state/GameState';
import { getNextAction, isCapacityCritical, isFoodCritical, isItemAffordable, listItems } from '../systems/NextAction';
import { MS_PER_SEC } from '../data/constants';

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
  /**
   * On arrival, how long until the player can do something (Story 3.9): 0 when
   * a decision is open or NEXT suggests a move, else the wait for the soonest
   * affordable item at the current rates; null when waiting never gets there.
   */
  readonly waitMs: number | null;
  /** Moves that landed, taps excluded. */
  readonly actions: number;
  /** LAY EGG taps that landed. */
  readonly taps: number;
  /** Moves the actions refused (the policy suggested something stale). */
  readonly refused: number;
  /** `actions`, by action name (`continuePhase`, `buyBuilding`, `trainSoldier`, `fight` …). */
  readonly byAction: Readonly<Record<string, number>>;
  /** Food was critical (`isFoodCritical`) on arrival or after any move or step of play (Story 3.11). */
  readonly foodCritical: boolean;
  /** The nest was full (`isCapacityCritical`) on arrival or after any move or step of play (Story 3.11). */
  readonly capacityCritical: boolean;
}

/** Eggs laid since the previous sample (Story 3.9): `tapped` of the `laid` came from LAY EGG taps. */
export interface EggSample {
  /** Real time and time played when the eggs were counted. */
  readonly atMs: number;
  readonly activeMs: number;
  /** The phase they were laid in. */
  readonly phase: string;
  readonly laid: number;
  readonly tapped: number;
}

export interface ProbeReport {
  readonly phaseEntries: readonly PhaseEntry[];
  readonly checkIns: readonly CheckInRecord[];
  /** Every egg laid in the run, in order (Story 3.9's tap share). */
  readonly eggs: readonly EggSample[];
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

/** On arrival, the wait until something can be done (see `CheckInRecord.waitMs`). */
export function waitMs(s: GameState): number | null {
  if (decisionsAvailable(s) > 0) return 0;
  const next = getNextAction(s);
  if (next.kind === 'act') return 0;
  return next.nextAffordable ? next.nextAffordable.inSec * MS_PER_SEC : null;
}

interface OpenCheckIn {
  index: number;
  startMs: number;
  phase: string;
  decisionsAvailable: number;
  waitMs: number | null;
  actions: number;
  taps: number;
  refused: number;
  byAction: Record<string, number>;
  foodCritical: boolean;
  capacityCritical: boolean;
}

/**
 * The run's probes (Story 3.7, AR15): when each phase was entered, per
 * check-in the actions taken, the decisions available and the wait until one
 * opens, whether food or capacity was critical in it (Story 3.11), and every
 * egg laid, tapped or not (Story 3.9). The runner feeds
 * them; they never change the game.
 */
export class Probes {
  private readonly entries: PhaseEntry[] = [];
  private readonly records: CheckInRecord[] = [];
  private open: OpenCheckIn | null = null;
  private readonly eggSamples: EggSample[] = [];
  private lastPhase: string;
  private lastLaid: number;
  private tappedEggs = 0;

  constructor(start: GameState) {
    this.lastPhase = start.phase;
    this.lastLaid = start.stats.totalEggsLaid;
    this.entries.push({ phase: start.phase, atMs: 0, activeMs: 0, checkIn: 0 });
  }

  /** A check-in starts: the player has just arrived to `s`. */
  beginCheckIn(index: number, s: GameState, atMs: number): void {
    this.endCheckIn();
    this.open = {
      index, startMs: atMs, phase: s.phase, decisionsAvailable: decisionsAvailable(s), waitMs: waitMs(s), actions: 0, taps: 0, refused: 0, byAction: {},
      foodCritical: false, capacityCritical: false,
    };
    this.critical(s);
  }

  /** Raise the open check-in's critical-moment flags that hold in `s` (only in the phase it started in). */
  private critical(s: GameState): void {
    const o = this.open;
    if (!o || s.phase !== o.phase) return;
    if (!o.foodCritical && isFoodCritical(s)) o.foodCritical = true;
    if (!o.capacityCritical && isCapacityCritical(s)) o.capacityCritical = true;
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

  /** `count` LAY EGG taps landed and laid `eggs` eggs. */
  taps(count: number, eggs: number): void {
    if (this.open) this.open.taps += count;
    this.tappedEggs += eggs;
  }

  /** After every move and every resume: records the eggs laid since the last look, then a phase change. */
  observe(s: GameState, atMs: number, activeMs: number): void {
    const laid = s.stats.totalEggsLaid - this.lastLaid;
    if (laid > 0 || this.tappedEggs > 0) {
      this.eggSamples.push({ atMs, activeMs, phase: this.lastPhase, laid: Math.max(0, laid), tapped: this.tappedEggs });
    }
    this.lastLaid = s.stats.totalEggsLaid;
    this.tappedEggs = 0;
    this.critical(s);
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
    return { phaseEntries: [...this.entries], checkIns: [...this.records], eggs: [...this.eggSamples] };
  }
}
