import type { GameState } from '../state/GameState';
import { EventBus } from '../engine/EventBus';
import { resume } from '../engine/resume';
import type { CatchUpDeps } from '../engine/catchUp';
import { createActions, type Actions } from '../actions';
import type { StateStore } from '../actions';
import { PhaseStateMachine } from '../phases/PhaseStateMachine';
import { ResourceSystem } from '../systems/ResourceSystem';
import { SoldierSystem } from '../systems/SoldierSystem';
import { BattleSystem } from '../systems/BattleSystem';
import { MapSystem } from '../systems/MapSystem';
import { TerritorySystem } from '../systems/TerritorySystem';
import { rngFromSeed } from '../utils/rng';
import { MS_PER_SEC } from '../data/constants';
import { simBalance } from '../data/balance/sim';
import { defaultPolicy, type PlayerPolicy, type SimMove } from './policy';
import { Probes, type ProbeReport } from './probes';
import type { CheckIn, CheckInSchedule } from './schedule';

export interface SimOptions {
  /** The state the run starts from (`createInitialState()` or a phase's entry state). */
  readonly state: GameState;
  /** The run's seed: it replaces the state's seed and restarts its generator. */
  readonly seed: number;
  readonly schedule: CheckInSchedule;
  /** Defaults to `defaultPolicy`. */
  readonly policy?: PlayerPolicy;
  /** Checked after every move and every resume: the run ends as soon as it holds. */
  readonly stopWhen?: (state: GameState) => boolean;
}

export interface SimResult {
  readonly state: GameState;
  readonly probes: ProbeReport;
  /** Real time simulated: every gap and every check-in played (up to the stop). */
  readonly elapsedMs: number;
  /** Time played (check-ins only). */
  readonly activeMs: number;
  /** Whether the run prestiged (the default policy never does). */
  readonly prestiged: boolean;
  /** Whether `stopWhen` ended the run before the schedule did. */
  readonly stopped: boolean;
}

/**
 * The headless simulated player (Story 3.7, AR15, architecture D12/N2). It
 * owns a `GameState` and plays the real game with no DOM:
 *
 * - time moves only through `resume(elapsedMs)` (D1/D2): each check-in's gap
 *   in one call (the offline path from 60 s on), and the check-in itself in
 *   `activeStepMs` calls, the gaps between the player's looks;
 * - moves go only through `actions/`, bound to real systems on its own bus
 *   and store, exactly as main binds them: nothing is mocked and nothing is
 *   skipped. Each look asks the policy for moves and applies them in order,
 *   then asks again while moves keep landing (at most `maxMovesPerTurn`);
 * - decision events never fire: resume runs the offline rules, which spawn
 *   none, and the runner never ticks the live decision clock.
 *
 * Its bus has no listeners but the caller's (`runner.bus`); nothing plays or
 * animates.
 */
export class SimRunner {
  readonly bus = new EventBus();
  private s: GameState;
  private readonly actions: Actions;
  private readonly catchUpDeps: CatchUpDeps;
  private readonly policy: PlayerPolicy;
  private readonly probes: Probes;
  private readonly startPrestiges: number;
  private clockMs = 0;
  private playedMs = 0;
  private halted = false;

  constructor(private readonly options: SimOptions) {
    this.s = { ...options.state, seed: options.seed, rng: rngFromSeed(options.seed) };
    this.startPrestiges = this.s.prestige.count;
    this.policy = options.policy ?? defaultPolicy;
    this.probes = new Probes(this.s);
    const store: StateStore = { get: () => this.s, set: (next) => (this.s = next) };
    const phases = new PhaseStateMachine();
    const resourceSystem = new ResourceSystem(this.bus);
    const soldierSystem = new SoldierSystem(this.bus);
    const territorySystem = new TerritorySystem();
    this.catchUpDeps = { resourceSystem, soldierSystem, mapSystem: new MapSystem(), territorySystem, latch: (s) => phases.latch(s) };
    this.actions = createActions({ bus: this.bus, resourceSystem, soldierSystem, battleSystem: new BattleSystem(this.bus), territorySystem, phases, store });
  }

  get state(): GameState {
    return this.s;
  }

  /** Whether `stopWhen` has held: once it has, check-ins do nothing. */
  get stopped(): boolean {
    return this.halted;
  }

  /** Play the whole schedule, or until `stopWhen` holds. */
  run(): SimResult {
    this.options.schedule.forEach((c, i) => {
      if (!this.halted) this.checkIn(c, i);
    });
    return this.result();
  }

  /**
   * The run so far. A caller driving `checkIn` itself (Story 3.8 checks
   * progress day by day) reads its result here; `run()` returns the same.
   */
  result(): SimResult {
    return {
      state: this.s,
      probes: this.probes.report(),
      elapsedMs: this.clockMs,
      activeMs: this.playedMs,
      prestiged: this.s.prestige.count > this.startPrestiges,
      stopped: this.halted,
    };
  }

  /** One check-in: resume the gap, then play `activeMs`, looking every `activeStepMs`. */
  checkIn(c: CheckIn, index: number): void {
    if (this.halted) return;
    if (this.advance(c.awayMs, false)) return;
    this.probes.beginCheckIn(index, this.s, this.clockMs);
    const step = simBalance.activeStepMs;
    let left = Math.floor(c.activeMs);
    if (this.look(step)) return;
    while (left > 0) {
      const ms = left < step ? left : step;
      left -= ms;
      if (this.advance(ms, true) || this.look(ms)) return;
    }
    this.probes.endCheckIn();
  }

  /** Simulate `ms` through resume (the only way time moves). True when the run stops. */
  private advance(ms: number, playing: boolean): boolean {
    if (ms > 0) {
      this.s = resume(this.s, ms, this.catchUpDeps).state;
      this.clockMs += ms;
      if (playing) this.playedMs += ms;
    }
    return this.check();
  }

  /** One look: ask the policy, apply its moves, ask again while moves land. True when the run stops. */
  private look(sinceLastMs: number): boolean {
    let taps = Math.floor((sinceLastMs * simBalance.tapsPerSec) / MS_PER_SEC);
    let budget = simBalance.maxMovesPerTurn;
    while (budget > 0) {
      const moves = this.policy(this.s, { taps });
      taps = 0;
      let landed = false;
      for (const move of moves) {
        if (move.kind === 'layEgg') {
          this.tap(move.taps);
        } else {
          if (budget <= 0) break;
          budget -= 1;
          const ok = this.apply(move).ok;
          this.probes.move(moveName(move), ok);
          landed ||= ok;
        }
        if (this.check()) return true;
      }
      if (!landed) break;
    }
    return false;
  }

  private tap(count: number): void {
    let landed = 0;
    for (let i = 0; i < count; i++) if (this.actions.layEgg().ok) landed += 1;
    this.probes.taps(landed);
  }

  private apply(move: Exclude<SimMove, { kind: 'layEgg' }>): { readonly ok: boolean } {
    switch (move.kind) {
      case 'intent':
        return this.actions.perform(move.intent);
      case 'stepRole':
        return this.actions.stepRole(move.role, move.delta);
      case 'moveWorkers':
        return this.actions.moveWorkers(move.from, move.to, move.count);
      case 'trainSoldier':
        return this.actions.trainSoldier();
      case 'fight':
        return this.actions.fight(move.enemyType);
    }
  }

  /** Record a phase change; true (and the run stops) once `stopWhen` holds. */
  private check(): boolean {
    this.probes.observe(this.s, this.clockMs, this.playedMs);
    if (this.options.stopWhen?.(this.s)) {
      this.halted = true;
      this.probes.endCheckIn();
    }
    return this.halted;
  }
}

/** The action a move goes through, by name. */
function moveName(move: Exclude<SimMove, { kind: 'layEgg' }>): string {
  return move.kind === 'intent' ? move.intent.action : move.kind;
}

/** Run one simulated player over a schedule (Story 3.7). */
export function runSim(options: SimOptions): SimResult {
  return new SimRunner(options).run();
}
