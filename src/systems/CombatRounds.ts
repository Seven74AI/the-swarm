import type { GameState } from '../state/GameState';
import { between, type RngStream } from '../utils/rng';
import { combatBalance } from '../data/balance/combat';
import { enemyBalance } from '../data/balance/enemies';
import { traitEffects, type EnemyDef } from './EnemySystem';
import { getSoldierDefense, getSoldierMaxHp, getSoldierSpeed, getSoldierStrength } from './SoldierSystem';
import { getPoisonDamagePerTick } from './VenomSystem';

/**
 * The rounds of one battle (Story 4.1): the army against one enemy, with the
 * enemy's trait applied. `BattleSystem` fights them with the game's
 * generator; the enemy card's hint plays them once with fixed rolls.
 */

export type BattleOutcome = 'victory' | 'defeat' | 'draw';

/** The army as the fight sees it. */
export interface Army {
  readonly soldiers: number;
  readonly strength: number;
  readonly defense: number;
  readonly speed: number;
  readonly maxHp: number;
  /** Venom damage each round (0 without a Venom Lab and venom in stock). */
  readonly poisonPerRound: number;
}

/** The army of `state`, or of `soldiers` soldiers with its equipment and mutations. */
export function armyOf(state: GameState, soldiers: number = state.combatSoldiers): Army {
  return {
    soldiers,
    strength: getSoldierStrength(state),
    defense: getSoldierDefense(state),
    speed: getSoldierSpeed(state),
    maxHp: getSoldierMaxHp(state),
    poisonPerRound: getPoisonDamagePerTick(state),
  };
}

export interface RoundsResult {
  readonly outcome: BattleOutcome;
  /** Rounds fought, 1 to `combatBalance.maxRounds`. */
  readonly rounds: number;
  readonly armyHp: number;
  readonly armyHpLeft: number;
  readonly poisonDealt: number;
}

/** What one soldier's hit lands against this trait. */
export function soldierHit(strength: number, enemy: EnemyDef): number {
  const fx = traitEffects(enemy.trait);
  let hit = fx.hitCap !== undefined ? Math.min(strength, fx.hitCap) : strength;
  if (fx.shell !== undefined) hit = Math.max(hit - fx.shell, hit * (fx.glanceShare ?? 0));
  return hit;
}

/** How many soldiers strike each round against this trait. */
export function strikers(army: Army, enemy: EnemyDef): number {
  const fx = traitEffects(enemy.trait);
  return fx.strikersMax !== undefined ? Math.min(army.soldiers, fx.strikersMax) : army.soldiers;
}

/** The army's damage in one strike, before the roll. */
export function armyHitPerRound(army: Army, enemy: EnemyDef): number {
  return (strikers(army, enemy) * soldierHit(army.strength, enemy)) / enemy.defense;
}

/** Venom damage that lands each round against this trait. */
export function poisonPerRound(army: Army, enemy: EnemyDef): number {
  return army.poisonPerRound * (traitEffects(enemy.trait).poisonShare ?? 1);
}

/** How often the enemy strikes each round. */
export function enemyStrikesPerRound(enemy: EnemyDef): number {
  return traitEffects(enemy.trait).strikesPerRound ?? 1;
}

/** Whether the army strikes before the enemy each round. */
export function armyStrikesFirst(army: Army, enemy: EnemyDef): boolean {
  return !traitEffects(enemy.trait).strikesFirst && army.speed >= enemy.speed;
}

/** Fight `enemy` (already scaled to the battles won) round by round. */
export function fightRounds(army: Army, enemy: EnemyDef, rng: RngStream): RoundsResult {
  const fx = traitEffects(enemy.trait);
  const roll = (): number => between(rng, combatBalance.damageRoll.min, combatBalance.damageRoll.max);
  const armyHit = armyHitPerRound(army, enemy);
  const enemyHit = enemy.strength / army.defense;
  const strikes = enemyStrikesPerRound(enemy);
  const poison = poisonPerRound(army, enemy);
  const armyFirst = armyStrikesFirst(army, enemy);

  const armyHp = army.soldiers * army.maxHp;
  let playerHp = armyHp;
  let enemyHp = enemy.hp;
  let poisonDealt = 0;
  const over = (): boolean => enemyHp <= 0 || playerHp <= 0;
  const armyStrikes = (): void => {
    enemyHp -= armyHit * roll();
  };
  const enemyStrikes = (): void => {
    for (let k = 0; k < strikes && playerHp > 0; k++) playerHp -= enemyHit * roll();
  };

  let round = 0;
  for (round = 0; round < combatBalance.maxRounds; round++) {
    let poisoned = false;
    if (poison > 0 && enemyHp > 0) {
      const dealt = Math.min(poison, enemyHp);
      enemyHp -= dealt;
      poisonDealt += dealt;
      poisoned = true;
    }
    if (over()) break;
    if (armyFirst) armyStrikes();
    else enemyStrikes();
    if (over()) break;
    if (armyFirst) enemyStrikes();
    else armyStrikes();
    if (over()) break;
    if (fx.regrowthPerRound !== undefined && !poisoned) enemyHp = Math.min(enemy.hp, enemyHp + fx.regrowthPerRound);
  }

  const victory = enemyHp <= 0 && playerHp > 0;
  const outcome: BattleOutcome = victory ? 'victory' : playerHp <= 0 ? 'defeat' : 'draw';
  // A break leaves `round` on the round being fought; running out leaves it at maxRounds.
  const rounds = Math.min(round + 1, combatBalance.maxRounds);
  return { outcome, rounds, armyHp, armyHpLeft: Math.max(0, playerHp), poisonDealt };
}

/** How the army looks against an enemy, before committing (the enemy card, Story 1.25). */
export type Matchup = 'favoured' | 'even' | 'dangerous';

/** Every roll at the hint's fixed value. */
const hintRolls: RngStream = { state: 0, float: () => enemyBalance.matchup.roll };

/**
 * A read of the fight before committing (Story 4.1): the rounds played out
 * once with fixed rolls, the trait included. A hint, never a promise
 * (the real fight rolls).
 */
export function assessMatchup(state: GameState, enemy: EnemyDef, soldiers: number = state.combatSoldiers): Matchup {
  if (soldiers <= 0) return 'dangerous';
  const r = fightRounds(armyOf(state, soldiers), enemy, hintRolls);
  if (r.outcome !== 'victory') return 'dangerous';
  return r.armyHpLeft >= r.armyHp * enemyBalance.matchup.favouredHpShare ? 'favoured' : 'even';
}
