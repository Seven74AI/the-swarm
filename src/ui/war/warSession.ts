import { signal, type ReadonlySignal } from '@preact/signals-core';
import type { ActionResult } from '../../actions';
import { selectBattlesWon } from '../../state/selectors';
import { getRandomEnemy, scaleEnemy, type BattleResult, type EnemyDef } from '../../state/queries';

/** The replay of a battle that has already been resolved (Story 1.25, UX-DR26). */
export type BattleReplay =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly round: number; readonly rounds: number };

/** One battle fought this session, for the combat log. */
export interface FoughtBattle {
  readonly result: BattleResult;
  readonly enemy: EnemyDef;
}

/** How long one round shows on the counter, when the battle is short enough. */
export const ROUND_MS = 150;
/** The whole replay never takes longer than this, however many rounds it had. */
export const MAX_REPLAY_MS = 1200;
/** ...and never less, so a one-round battle still shows its counter. */
export const MIN_REPLAY_MS = 800;
/** Battles the combat log keeps for the session. */
export const HISTORY_SIZE = 5;

export interface WarSession {
  /** The enemy on the enemy card: the one `> FIGHT` fights. */
  readonly enemy: ReadonlySignal<EnemyDef>;
  readonly battle: ReadonlySignal<BattleReplay>;
  /** Battles of this session, newest first. */
  readonly history: ReadonlySignal<readonly FoughtBattle[]>;
  /** The longest a replay takes (tests wait it out). */
  readonly maxReplayMs: number;
  /** Fight the enemy on the card. Refuses while a replay runs. */
  fight(): ActionResult<BattleResult>;
  dispose(): void;
}

export interface WarSessionDeps {
  actions: { fight(enemyType?: string): ActionResult<BattleResult> };
  /** Runs when the replay ends: main opens the battle summary sheet here. */
  onBattleDone(result: BattleResult, enemy: EnemyDef): void;
  /** The next enemy. Default: a random one, scaled to the battles won. */
  drawEnemy?: () => EnemyDef;
}

/** The next enemy, scaled like the battle itself scales it (Story 4.1 seeds this). */
function drawScaledEnemy(): EnemyDef {
  const won = selectBattlesWon.peek();
  return scaleEnemy(getRandomEnemy(won), won);
}

/**
 * The WAR segment's session state (Story 1.25): UI state only, never saved.
 * The enemy card and `> FIGHT` sit in different hosts, so they share this.
 *
 * A battle resolves at once through `actions.fight` (one write). The round
 * counter is a presentational replay of the rounds it took (the UX
 * feasibility review: battles resolve synchronously); the summary opens when
 * it ends, and the next enemy is drawn.
 */
export function createWarSession({ actions, onBattleDone, drawEnemy = drawScaledEnemy }: WarSessionDeps): WarSession {
  const enemy = signal<EnemyDef>(drawEnemy());
  const battle = signal<BattleReplay>({ status: 'idle' });
  const history = signal<readonly FoughtBattle[]>([]);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function finish(result: BattleResult, fought: EnemyDef): void {
    timer = null;
    battle.value = { status: 'idle' };
    history.value = [{ result, enemy: fought }, ...history.value].slice(0, HISTORY_SIZE);
    enemy.value = drawEnemy();
    onBattleDone(result, fought);
  }

  function replay(result: BattleResult, fought: EnemyDef): void {
    const rounds = Math.max(1, result.rounds);
    const total = Math.min(MAX_REPLAY_MS, Math.max(MIN_REPLAY_MS, rounds * ROUND_MS));
    const step = Math.max(1, Math.floor(total / rounds));
    battle.value = { status: 'running', round: 1, rounds };
    const next = (): void => {
      const b = battle.peek();
      if (b.status !== 'running' || b.round >= b.rounds) {
        finish(result, fought);
        return;
      }
      battle.value = { ...b, round: b.round + 1 };
      timer = setTimeout(next, step);
    };
    timer = setTimeout(next, step);
  }

  return {
    enemy,
    battle,
    history,
    maxReplayMs: MAX_REPLAY_MS,
    fight() {
      if (battle.peek().status === 'running') return { ok: false, reason: 'already_running' };
      const fought = enemy.peek();
      const r = actions.fight(fought.type);
      if (r.ok) replay(r.value, fought);
      return r;
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
