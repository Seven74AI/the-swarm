import type { GameState } from '../state/GameState';
import { Phase } from '../phases/phases';
import { conditionMet, goalFor } from '../state/queries';
import { getNextAction, isFoodCritical, type ActionIntent } from '../systems/NextAction';
import { freeWorkers, getReallocation, roleCount, type MoveSource } from '../systems/Workforce';
import { assessMatchup, peekEnemy } from '../systems/EnemySystem';
import { soldierBalance } from '../data/balance/soldiers';
import type { RoleId } from '../data/content/roles';
import type { WorkerRole } from '../systems/ResourceSystem';

/**
 * One move of the simulated player (Story 3.7, AR15). Each names the action
 * in `actions/` the runner calls for it, the same one a button calls: the
 * runner validates nothing itself.
 */
export type SimMove =
  /** A next-action suggestion, run through `actions.perform`. */
  | { readonly kind: 'intent'; readonly intent: ActionIntent }
  /** `taps` presses of LAY EGG (`actions.layEgg`). */
  | { readonly kind: 'layEgg'; readonly taps: number }
  | { readonly kind: 'stepRole'; readonly role: RoleId; readonly delta: number }
  | { readonly kind: 'moveWorkers'; readonly from: MoveSource; readonly to: RoleId; readonly count: number }
  | { readonly kind: 'trainSoldier' }
  /** FIGHT the enemy on the card. */
  | { readonly kind: 'fight'; readonly enemyType: string };

/** What the runner tells the policy about this look: the taps it has time for (only on its first look of a step). */
export interface PolicyTurn {
  readonly taps: number;
}

/**
 * A player: a pure function from the state to the moves it makes now, in
 * order (architecture N2). The runner applies them one by one through the
 * actions, then asks again while moves keep landing.
 */
export type PlayerPolicy = (state: GameState, turn: PolicyTurn) => readonly SimMove[];

const WORKER_ROLES: readonly WorkerRole[] = ['gather', 'forage', 'tend', 'dig', 'guard'];
const isWorkerRole = (id: string): id is WorkerRole => (WORKER_ROLES as readonly string[]).includes(id);
/** Where a goal role takes a worker from when none is free: jobs that bring no food first. */
const DONORS: readonly WorkerRole[] = ['tend', 'forage', 'dig', 'gather'];

/** A goal condition that counts a role (the Colony goal's GUARD): one more worker on it. */
function goalRoleMoves(s: GameState): SimMove[] {
  const goal = goalFor(s.phase);
  if (!goal) return [];
  const out: SimMove[] = [];
  for (const c of goal.conditions) {
    if (!isWorkerRole(c.id) || conditionMet(c, s)) continue;
    const role = c.id;
    if (freeWorkers(s) > 0) {
      out.push({ kind: 'stepRole', role, delta: 1 });
      continue;
    }
    const from = DONORS.find((d) => d !== role && roleCount(s, d) > 0);
    if (from) out.push({ kind: 'moveWorkers', from, to: role, count: 1 });
  }
  return out;
}

/**
 * The fewest soldiers that make the enemy on the card no longer dangerous,
 * looking no further than what could be trained now; null if none would.
 */
function soldiersNeeded(s: GameState, enemyType: ReturnType<typeof peekEnemy>, most: number): number | null {
  for (let n = 1; n <= most; n++) {
    if (assessMatchup({ combatSoldiers: n, equipment: s.equipment }, enemyType) !== 'dangerous') return n;
  }
  return null;
}

/**
 * Combat (FR13): fight the enemy on the card once the army is not outmatched,
 * otherwise train soldiers up to the size that is; with nothing left to train
 * (no free worker, none in training), fight with what there is.
 */
function combatMoves(s: GameState): SimMove[] {
  if (s.phase !== Phase.COMBAT) return [];
  const enemy = peekEnemy(s.rng, s.battlesWon);
  const army = s.combatSoldiers;
  const coming = army + s.soldierPipeline.count;
  const canTrain = freeWorkers(s) > 0 && s.resources.food >= soldierBalance.costFood && !isFoodCritical(s);
  if (army > 0 && assessMatchup(s, enemy) !== 'dangerous') return [{ kind: 'fight', enemyType: enemy.type }];
  const needed = soldiersNeeded(s, enemy, coming + freeWorkers(s));
  if (canTrain && (needed === null || coming < needed)) return [{ kind: 'trainSoldier' }];
  if (army > 0 && s.soldierPipeline.count === 0 && !canTrain) return [{ kind: 'fight', enemyType: enemy.type }];
  return [];
}

/**
 * The default player (Story 3.7, architecture N2): follow `getNextAction`
 * (which also taps CONTINUE once the goal has latched), rebalance roles with
 * WRKR's reallocation, and do the goal's verbs that are not purchases: lay
 * eggs in Egg Laying (tapping is the only egg source before automation), put
 * a worker on a role a goal condition counts (GUARD), and train and fight in
 * Combat. It never prestiges and never answers a decision event (none fire
 * in the harness).
 */
export const defaultPolicy: PlayerPolicy = (s, turn) => {
  const moves: SimMove[] = [];
  if (s.phase === Phase.EGG_LAYING && turn.taps > 0) moves.push({ kind: 'layEgg', taps: turn.taps });
  const next = getNextAction(s);
  if (next.kind === 'act') moves.push({ kind: 'intent', intent: next.intent });
  const realloc = getReallocation(s);
  if (realloc) moves.push({ kind: 'moveWorkers', from: realloc.from, to: realloc.to, count: realloc.count });
  moves.push(...goalRoleMoves(s), ...combatMoves(s));
  return moves;
};
