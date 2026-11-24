import type { GameState } from '../state/GameState';
import { getNextAction, isCapacityCritical, isFoodCritical, isItemAffordable, itemKey, listItems } from '../systems/NextAction';
import { conditionMet, goalFor } from '../state/queries';
import { MS_PER_SEC } from '../data/constants';
import { crowdingBites } from '../systems/Crowding';

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
  /** How long the check-in was played (Story 9.1): measured for an `untilIdle` check-in. */
  readonly activeMs: number;
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
  /** DIG presses that landed (Story 9.2); like taps, not counted as actions. */
  readonly digs: number;
  /** FEED taps that landed (Story 9.4); like taps, not counted as actions. */
  readonly feeds: number;
  /** Moves the actions refused (the policy suggested something stale). */
  readonly refused: number;
  /** `actions`, by action name (`continuePhase`, `buyBuilding`, `trainSoldier`, `fight` …). */
  readonly byAction: Readonly<Record<string, number>>;
  /** Food was critical (`isFoodCritical`) on arrival or after any move or step of play (Story 3.11). */
  readonly foodCritical: boolean;
  /** The nest was full (`isCapacityCritical`) on arrival or after any move or step of play (Story 3.11). */
  readonly capacityCritical: boolean;
  /** Crowding bit on arrival (Story 9.13, `crowdingBites`). */
  readonly startCrowded: boolean;
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

/**
 * What can give the player something new (Story 9.1, FR65): a room opened (the
 * nest gained room), an item newly affordable, a goal condition newly met, a
 * phase entered. A stretch of play with none is an **idle gap**.
 */
export type PayoffKind = 'room' | 'affordable' | 'goal' | 'phase';

export interface Payoff {
  readonly kind: PayoffKind;
  /** Real time and time played since the run started. */
  readonly atMs: number;
  readonly activeMs: number;
  /** The check-in it came in (0 before the first). */
  readonly checkIn: number;
}

export interface ProbeReport {
  readonly phaseEntries: readonly PhaseEntry[];
  readonly checkIns: readonly CheckInRecord[];
  /** Every egg laid in the run, in order (Story 3.9's tap share). */
  readonly eggs: readonly EggSample[];
  /** Every payoff, in time order (Story 9.1). */
  readonly payoffs: readonly Payoff[];
}

/** The items affordable now, by `itemKey`. */
function affordableKeys(s: GameState): Set<string> {
  return new Set(listItems().filter((ref) => isItemAffordable(s, ref)).map(itemKey));
}

/** The conditions of the phase's goal met now, by id. */
function metConditions(s: GameState): Set<string> {
  return new Set((goalFor(s.phase)?.conditions ?? []).filter((c) => conditionMet(c, s)).map((c) => c.id));
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
  startActiveMs: number;
  phase: string;
  decisionsAvailable: number;
  waitMs: number | null;
  actions: number;
  taps: number;
  digs: number;
  feeds: number;
  refused: number;
  byAction: Record<string, number>;
  foodCritical: boolean;
  capacityCritical: boolean;
  startCrowded: boolean;
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
  private readonly payoffList: Payoff[] = [];
  private lastRoom: number;
  private lastAffordable: Set<string>;
  private lastMet: Set<string>;
  /** Time played at the last observation, and the check-in it was in. */
  private nowActiveMs = 0;
  private lastCheckIn = 0;

  constructor(start: GameState) {
    this.lastPhase = start.phase;
    this.lastLaid = start.stats.totalEggsLaid;
    this.lastRoom = start.resources.nestCapacity;
    this.lastAffordable = affordableKeys(start);
    this.lastMet = metConditions(start);
    this.entries.push({ phase: start.phase, atMs: 0, activeMs: 0, checkIn: 0 });
  }

  /** A check-in starts: the player has just arrived to `s`. */
  beginCheckIn(index: number, s: GameState, atMs: number): void {
    this.endCheckIn();
    this.lastCheckIn = index;
    this.open = {
      index, startMs: atMs, startActiveMs: this.nowActiveMs, phase: s.phase, decisionsAvailable: decisionsAvailable(s), waitMs: waitMs(s), actions: 0, taps: 0, digs: 0, feeds: 0, refused: 0, byAction: {},
      foodCritical: false, capacityCritical: false, startCrowded: crowdingBites(s),
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

  /** `count` FEED taps landed (Story 9.4). */
  feeds(count: number): void {
    if (this.open) this.open.feeds += count;
  }

  /** `count` DIG presses landed (Story 9.2). */
  digs(count: number): void {
    if (this.open) this.open.digs += count;
  }

  /** After every move and every resume: records the eggs laid since the last look, then a phase change. */
  observe(s: GameState, atMs: number, activeMs: number): void {
    const laid = s.stats.totalEggsLaid - this.lastLaid;
    if (laid > 0 || this.tappedEggs > 0) {
      this.eggSamples.push({ atMs, activeMs, phase: this.lastPhase, laid: Math.max(0, laid), tapped: this.tappedEggs });
    }
    this.lastLaid = s.stats.totalEggsLaid;
    this.tappedEggs = 0;
    this.nowActiveMs = activeMs;
    this.critical(s);
    this.payoffs(s, atMs, activeMs);
    if (s.phase === this.lastPhase) return;
    this.lastPhase = s.phase;
    this.entries.push({ phase: s.phase, atMs, activeMs, checkIn: this.open?.index ?? 0 });
  }

  /** Record the payoffs `s` brings since the last observation (Story 9.1). */
  private payoffs(s: GameState, atMs: number, activeMs: number): void {
    const at = { atMs, activeMs, checkIn: this.lastCheckIn };
    const kinds: PayoffKind[] = [];
    if (s.resources.nestCapacity > this.lastRoom) kinds.push('room');
    this.lastRoom = s.resources.nestCapacity;
    const affordable = affordableKeys(s);
    for (const key of affordable) {
      if (!this.lastAffordable.has(key)) {
        kinds.push('affordable');
        break;
      }
    }
    this.lastAffordable = affordable;
    const met = metConditions(s);
    if (s.phase !== this.lastPhase) {
      // A new goal: its conditions already met on entry are not news; entering is.
      kinds.push('phase');
    } else {
      for (const id of met) {
        if (!this.lastMet.has(id)) {
          kinds.push('goal');
          break;
        }
      }
    }
    this.lastMet = met;
    for (const kind of kinds) this.payoffList.push({ kind, ...at });
  }

  endCheckIn(): void {
    if (!this.open) return;
    const { startActiveMs, ...open } = this.open;
    this.records.push({ ...open, activeMs: this.nowActiveMs - startActiveMs, byAction: { ...open.byAction } });
    this.open = null;
  }

  report(): ProbeReport {
    this.endCheckIn();
    return { phaseEntries: [...this.entries], checkIns: [...this.records], eggs: [...this.eggSamples], payoffs: [...this.payoffList] };
  }
}
