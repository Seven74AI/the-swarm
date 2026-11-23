import type { GameState } from '../state/GameState';
import { Phase } from '../phases/phases';
import { conditionMet, goalFor } from '../state/queries';
import { getNextAction, isCapacityCritical, isFoodCritical, type ActionIntent } from '../systems/NextAction';
import { freeWorkers, getReallocation, moveWorkers, netFoodPerSec, roleCount, type MoveSource } from '../systems/Workforce';
import { getEnemyDef, scaleEnemy, type EnemyDef } from '../systems/EnemySystem';
import { assessMatchup } from '../systems/CombatRounds';
import { soldierBalance } from '../data/balance/soldiers';
import { combatBalance } from '../data/balance/combat';
import { isStarving, type WorkerRole } from '../systems/ResourceSystem';
import { TerritorySystem } from '../systems/TerritorySystem';
import type { RoleId } from '../data/content/roles';
import type { AutomationVerb } from '../data/content/automation';
import { automationCount, isAutomationActive, isAutomationShown, maxAutomationTarget } from '../systems/AutomationTargets';
import { getEffects } from '../systems/BuildingSystem';
import { feedRefusal, freeRooms } from '../systems/Brood';
import { canBuyAutoDig } from '../systems/Dig';

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
  /** `presses` presses of DIG (`actions.dig`, Story 9.2). */
  | { readonly kind: 'dig'; readonly presses: number }
  /** `taps` taps on the brood to FEED it (`actions.feed`, Story 9.4). */
  | { readonly kind: 'feed'; readonly taps: number }
  | { readonly kind: 'stepRole'; readonly role: RoleId; readonly delta: number }
  | { readonly kind: 'moveWorkers'; readonly from: MoveSource; readonly to: RoleId; readonly count: number }
  | { readonly kind: 'trainSoldier' }
  /** FIGHT the enemy on the card. */
  | { readonly kind: 'fight'; readonly enemyType: string }
  /** A target row's `[−] N [+]` (`actions.setAutomationTarget`, Story 4.10). */
  | { readonly kind: 'setAutomationTarget'; readonly verb: AutomationVerb; readonly target: number }
  /** A target row's `[AUTO]` (`actions.setAutomation`). */
  | { readonly kind: 'setAutomation'; readonly verb: AutomationVerb; readonly on: boolean };

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
 * Whether tapping still helps the phase goal (Story 3.11). LAY EGG stays on
 * NEST in every phase and, until automation opens (Story 4.10), it is the only
 * egg source, so a player whose goal lacks workers keeps tapping. In Egg
 * Laying tapping is the whole phase (every extra egg is one more that may
 * hatch early); later the player stops once the brood waiting (eggs and
 * larvae) already covers the workers the goal lacks.
 */
function needsWorkers(s: GameState): boolean {
  const c = goalFor(s.phase)?.conditions.find((x) => x.id === 'workers');
  if (!c || conditionMet(c, s)) return false;
  if (s.phase === Phase.EGG_LAYING) return true;
  // Once the queen lays on her own (Story 4.10), the player stops tapping.
  if (isAutomationActive(s, 'lay')) return false;
  return s.resources.workers + s.resources.eggs + s.resources.larvae < c.target(s);
}

/**
 * The fewest soldiers that make the enemy on the card no longer dangerous,
 * looking no further than what could be trained now; null if none would.
 */
function soldiersNeeded(s: GameState, enemy: EnemyDef, most: number): number | null {
  for (let n = 1; n <= most; n++) {
    if (assessMatchup(s, enemy, n) !== 'dangerous') return n;
  }
  return null;
}

/**
 * One more soldier (Story 4.10): TRAIN by hand until the training row
 * appears, then one more on its target (the colony trains it, and keeps the
 * army there after losses).
 */
function trainOne(s: GameState): SimMove[] {
  if (!isAutomationShown(s, 'train')) return [{ kind: 'trainSoldier' }];
  const row = s.automation.targets.train;
  const army = automationCount(s, 'train');
  // A target the colony is still working toward: wait for it.
  if (row.on && row.target > army) return [];
  return keep(s, 'train', army + 1);
}

/**
 * Combat (FR13): fight the enemy on the card once the army is not outmatched,
 * otherwise train soldiers up to the size that is; with nothing left to train
 * (no free worker, none in training), fight with what there is.
 */
function combatMoves(s: GameState): SimMove[] {
  if (s.phase !== Phase.COMBAT) return [];
  // The enemy on the card (Story 4.1), as the battle scales it.
  const enemy = scaleEnemy(getEnemyDef(s.nextEnemy), s.battlesWon);
  const army = s.combatSoldiers;
  const coming = army + s.soldierPipeline.count;
  const canTrain = freeWorkers(s) > 0 && s.resources.food >= soldierBalance.costFood && !isFoodCritical(s);
  if (army > 0 && assessMatchup(s, enemy) !== 'dangerous') return [{ kind: 'fight', enemyType: enemy.type }];
  const needed = soldiersNeeded(s, enemy, coming + freeWorkers(s));
  if (canTrain && (needed === null || coming < needed)) return trainOne(s);
  if (army > 0 && s.soldierPipeline.count === 0 && !canTrain) return [{ kind: 'fight', enemyType: enemy.type }];
  return [];
}

/**
 * A full nest that WRKR's reallocation cannot help (it takes only free and
 * TEND workers to DIG): move one gatherer to DIG while the food income stays
 * at or above zero without it (Story 4.4). The max-army player's army eats
 * every digger into GATHER; once fed, it digs again, as a player would,
 * instead of waiting on a full nest forever. The default player keeps its
 * Story 3.11 moves (its pacing is tuned on them).
 */
function digWhenFed(s: GameState): SimMove[] {
  if (getReallocation(s) || !isCapacityCritical(s) || roleCount(s, 'gather') < 1) return [];
  const moved = moveWorkers(s, 'gather', 'dig', 1);
  if (moved === s || netFoodPerSec(moved) < 0) return [];
  return [{ kind: 'moveWorkers', from: 'gather', to: 'dig', count: 1 }];
}

/** The effective nest capacity (dug rooms plus the warehouse). */
function nestCapacity(s: GameState): number {
  return s.resources.nestCapacity + (getEffects('warehouse', s.buildings.warehouse.level).nestCapacity ?? 0);
}

/** Set a row to `target` and turn it on: only the moves that change something (an unchanged row is no move). */
function keep(s: GameState, verb: AutomationVerb, target: number): SimMove[] {
  const row = s.automation.targets[verb];
  const out: SimMove[] = [];
  if (row.target !== target) out.push({ kind: 'setAutomationTarget', verb, target });
  if (!row.on) out.push({ kind: 'setAutomation', verb, on: true });
  return out;
}

/**
 * The laying row (Story 4.10): once it appears after Egg Laying, the player
 * hands the laying to the queen with a brood the size of the nest, so an
 * emptied nest can refill, and stops tapping (`needsWorkers`). In Egg Laying
 * tapping is the phase, so the row waits.
 */
function layAutomation(s: GameState): SimMove[] {
  if (s.phase === Phase.EGG_LAYING || !isAutomationShown(s, 'lay')) return [];
  return keep(s, 'lay', Math.min(nestCapacity(s), maxAutomationTarget()));
}

/**
 * Whether the nest needs another room (Story 9.2): from Colony on, when the
 * workers and the brood waiting to hatch (eggs and larvae) would not fit.
 */
function needsRoom(s: GameState): boolean {
  if (s.phase === Phase.EGG_LAYING) return false;
  return s.resources.workers + s.resources.eggs + s.resources.larvae >= nestCapacity(s);
}

/** Every move but Combat's: the same for each player below, so they differ only in how they fight. */
function baseMoves(s: GameState, turn: PolicyTurn): SimMove[] {
  const moves: SimMove[] = [...layAutomation(s)];
  // Auto-dig (Story 9.5): bought as soon as it can be; from then on the diggers dig and the player stops pressing DIG.
  if (canBuyAutoDig(s)) moves.push({ kind: 'intent', intent: { action: 'buyAutoDig' } });
  // The player's presses FEED larvae into free rooms (Story 9.4), else go to DIG while the nest is short of room
  // (Story 9.2), else to LAY EGG while the goal needs workers.
  if (turn.taps > 0 && feedRefusal(s) === null) moves.push({ kind: 'feed', taps: Math.min(turn.taps, freeRooms(s)) });
  else if (turn.taps > 0 && needsRoom(s) && !s.dig.auto) moves.push({ kind: 'dig', presses: turn.taps });
  else if (turn.taps > 0 && needsWorkers(s)) moves.push({ kind: 'layEgg', taps: turn.taps });
  const next = getNextAction(s);
  if (next.kind === 'act') moves.push({ kind: 'intent', intent: next.intent });
  const realloc = getReallocation(s);
  if (realloc) moves.push({ kind: 'moveWorkers', from: realloc.from, to: realloc.to, count: realloc.count });
  moves.push(...goalRoleMoves(s));
  return moves;
}

/**
 * The default player (Story 3.7, architecture N2): follow `getNextAction`
 * (which also taps CONTINUE once the goal has latched), rebalance roles with
 * WRKR's reallocation, and do the goal's verbs that are not purchases: lay
 * eggs while the goal still needs workers (tapping is the only egg source
 * before automation, in every phase: Story 3.11), put
 * a worker on a role a goal condition counts (GUARD), and train and fight in
 * Combat. It never prestiges and never answers a decision event (none fire
 * in the harness).
 */
export const defaultPolicy: PlayerPolicy = (s, turn) => [...baseMoves(s, turn), ...combatMoves(s)];

/** Whether TRAIN SOLDIER would be accepted now: a free worker per soldier, the food to start, and no starving (Story 4.4). */
function canTrainNow(s: GameState): boolean {
  return freeWorkers(s) >= combatBalance.army.workersPerSoldier
    && s.resources.food >= soldierBalance.costFood
    && !isStarving(s, new TerritorySystem().getBonuses(s));
}

/**
 * Combat for the max-army player (Story 4.4): train a soldier from every free
 * worker the colony can pay for, whatever the enemy and whatever the food,
 * and fight only once nothing more can be trained and the last trainee has
 * joined the army.
 */
function maxArmyCombatMoves(s: GameState): SimMove[] {
  if (s.phase !== Phase.COMBAT) return [];
  if (canTrainNow(s)) return [{ kind: 'trainSoldier' }];
  if (s.combatSoldiers > 0 && s.soldierPipeline.count === 0) return [{ kind: 'fight', enemyType: s.nextEnemy }];
  return [];
}

/**
 * The max-army player (Story 4.4, FR12): plays like the default player
 * everywhere but Combat, where it follows "train the maximum, then fight":
 * training comes before any other move, so every free worker it can pay for
 * becomes a soldier before WRKR's reallocation can give it a job.
 * The pacing report sets it against the default player from the same seed:
 * its bigger army eats the colony into food-critical moments the default
 * player never meets.
 */
export const maxArmyPolicy: PlayerPolicy = (s, turn) => [...maxArmyCombatMoves(s), ...baseMoves(s, turn), ...(s.phase === Phase.COMBAT ? digWhenFed(s) : [])];
