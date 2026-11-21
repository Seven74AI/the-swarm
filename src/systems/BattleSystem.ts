import { colonyLine } from '../data/content/colonyLines';
import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import { getEnemyDef, getRandomEnemy, scaleEnemy } from './EnemySystem';
import {
  getSoldierStrength,
  getSoldierDefense,
  getSoldierSpeed,
  getSoldierMaxHp,
} from './SoldierSystem';
import { getPoisonDamagePerTick, consumeVenom } from './VenomSystem';
import { between, intBetween, rngStream, type RngStream } from '../utils/rng';
import { combatBalance } from '../data/balance/combat';

export type BattleOutcome = 'victory' | 'defeat' | 'draw';

export interface BattleResult {
  victory: boolean;
  /** How it ended; the same value as `lastBattle.result`. A draw: the enemy fled after the last round. */
  outcome: BattleOutcome;
  /** Rounds fought (1 to `MAX_BATTLE_ROUNDS`), for the enemy card's round counter (Story 1.25). */
  rounds: number;
  soldiersLost: number;
  enemyType: string;
  foodGained: number;
  specialLoot: {
    chitin: number;
    silk: number;
    venom: number;
  };
  poisonDamageDealt: number;
  narrative: string;
}

/** A battle that lasts this many rounds is a draw: the enemy flees. */
export const MAX_BATTLE_ROUNDS = combatBalance.maxRounds;
const MAX_ROUNDS = MAX_BATTLE_ROUNDS;


export class BattleSystem {
  constructor(private bus: EventBus) {}

  /**
   * Fight one battle now. `enemyType` is the enemy the player saw on the enemy
   * card (Story 1.25); without it a random enemy is drawn.
   *
   * Every roll comes from `rng`, by default a stream of the game's generator
   * (`state.rng`, Story 3.1): the same state fights the same battle, and the
   * result carries the advanced generator state.
   */
  resolveBattle(state: GameState, enemyType?: string, rng: RngStream = rngStream(state.rng)): {
    newState: GameState;
    result: BattleResult;
  } {
    // Cannot fight without soldiers
    if (state.combatSoldiers <= 0) {
      return {
        newState: state,
        result: {
          victory: false,
          outcome: 'defeat',
          rounds: 0,
          soldiersLost: 0,
          enemyType: 'none',
          foodGained: 0,
          specialLoot: { chitin: 0, silk: 0, venom: 0 },
          poisonDamageDealt: 0,
          narrative: colonyLine('battle_no_soldiers'),
        },
      };
    }

    // Pick and scale enemy
    const baseEnemy = enemyType ? getEnemyDef(enemyType) : getRandomEnemy(state.battlesWon, rng);
    const enemy = scaleEnemy(baseEnemy, state.battlesWon);

    // Poison DoT: activate if Venom Lab Lv.1+ and venom in stock
    const poisonDamagePerRound = getPoisonDamagePerTick(state);
    let workingState = poisonDamagePerRound > 0 ? consumeVenom(state) : state;

    // Player stats
    const soldierStrength = getSoldierStrength(workingState);
    const soldierDefense = getSoldierDefense(workingState);
    const soldierSpeed = getSoldierSpeed(workingState);
    const soldierMaxHp = getSoldierMaxHp(workingState);

    const totalSoldierStrength = workingState.combatSoldiers * soldierStrength;
    let playerHp = workingState.combatSoldiers * soldierMaxHp;
    let enemyHp = enemy.hp;
    let poisonDamageDealt = 0;

    // Determine attack order: faster side goes first
    const playerFirst = soldierSpeed >= enemy.speed;

    let round = 0;
    for (round = 0; round < MAX_ROUNDS; round++) {
      // Poison damage applies each round before regular attacks
      if (poisonDamagePerRound > 0 && enemyHp > 0) {
        const actualPoison = Math.min(poisonDamagePerRound, enemyHp);
        enemyHp -= actualPoison;
        poisonDamageDealt += actualPoison;
      }

      // Check if poison killed target
      if (enemyHp <= 0 || playerHp <= 0) break;

      // First attacker
      if (playerFirst) {
        const damage = (totalSoldierStrength / enemy.defense) * between(rng, combatBalance.damageRoll.min, combatBalance.damageRoll.max);
        enemyHp -= damage;
      } else {
        const damage = (enemy.strength / soldierDefense) * between(rng, combatBalance.damageRoll.min, combatBalance.damageRoll.max);
        playerHp -= damage;
      }

      // Check if first attack killed target
      if (enemyHp <= 0 || playerHp <= 0) break;

      // Second attacker
      if (playerFirst) {
        const damage = (enemy.strength / soldierDefense) * between(rng, combatBalance.damageRoll.min, combatBalance.damageRoll.max);
        playerHp -= damage;
      } else {
        const damage = (totalSoldierStrength / enemy.defense) * between(rng, combatBalance.damageRoll.min, combatBalance.damageRoll.max);
        enemyHp -= damage;
      }

      // Check if second attack killed target
      if (enemyHp <= 0 || playerHp <= 0) break;
    }

    const victory = enemyHp <= 0 && playerHp > 0;
    const defeat = playerHp <= 0;
    const outcome: BattleOutcome = victory ? 'victory' : defeat ? 'defeat' : 'draw';
    // A break leaves `round` on the round being fought; running out leaves it at MAX_ROUNDS.
    const rounds = Math.min(round + 1, MAX_ROUNDS);

    // Calculate soldiers lost
    let soldiersLost: number;
    if (defeat) {
      soldiersLost = workingState.combatSoldiers;
    } else {
      soldiersLost = Math.round(
        (enemy.strength / Math.max(soldierDefense, combatBalance.minDefense)) * between(rng, combatBalance.lossRoll.min, combatBalance.lossRoll.max),
      );
      soldiersLost = Math.max(0, Math.min(soldiersLost, workingState.combatSoldiers));
    }

    const survivingSoldiers = workingState.combatSoldiers - soldiersLost;

    // Loot (only on victory)
    let foodGained = 0;
    let chitinGained = 0;
    let silkGained = 0;
    let venomGained = 0;

    if (victory) {
      foodGained = intBetween(rng, enemy.loot.foodMin, enemy.loot.foodMax);

      if (enemy.loot.specialResource) {
        const res = enemy.loot.specialResource;
        const amount = intBetween(rng, res.min, res.max);
        if (res.type === 'chitin') chitinGained = amount;
        else if (res.type === 'silk') silkGained = amount;
        else if (res.type === 'venom') venomGained = amount;
      }

      // Scorpion gives extra chitin on top of venom
      if (enemy.type === 'scorpion') {
        chitinGained = intBetween(rng, combatBalance.scorpionChitin.min, combatBalance.scorpionChitin.max);
      }
    }

    // Build narrative
    let narrative: string;
    if (victory) {
      const soldiers = workingState.combatSoldiers;
      narrative = colonyLine('battle_victory', { soldiers, enemy: enemy.name, lost: soldiersLost, food: foodGained });
      if (poisonDamageDealt > 0) {
        narrative += ` ${colonyLine('battle_venom', { damage: Math.floor(poisonDamageDealt) })}`;
      }
      const specialParts: string[] = [];
      if (chitinGained > 0) specialParts.push(`${chitinGained} chitin`);
      if (silkGained > 0) specialParts.push(`${silkGained} silk`);
      if (venomGained > 0) specialParts.push(`${venomGained} venom`);
      if (specialParts.length > 0) {
        narrative += ` ${colonyLine('battle_salvage', { loot: specialParts.join(', '), enemy: enemy.name })}`;
      }
    } else if (defeat) {
      narrative = colonyLine('battle_defeat', { enemy: enemy.name, soldiers: workingState.combatSoldiers });
    } else {
      // Draw: max rounds exceeded, enemy flees
      narrative = colonyLine('battle_draw', { enemy: enemy.name, lost: soldiersLost });
    }

    const result: BattleResult = {
      victory,
      outcome,
      rounds,
      soldiersLost,
      enemyType: enemy.type,
      foodGained,
      specialLoot: { chitin: chitinGained, silk: silkGained, venom: venomGained },
      poisonDamageDealt,
      narrative,
    };

    // Apply to state
    const newState: GameState = {
      ...workingState,
      rng: rng.state,
      resources: {
        ...workingState.resources,
        food: workingState.resources.food + foodGained,
      },
      combatSoldiers: survivingSoldiers,
      combatResources: {
        chitin: workingState.combatResources.chitin + chitinGained,
        silk: workingState.combatResources.silk + silkGained,
        venom: workingState.combatResources.venom + venomGained,
      },
      battlesWon: workingState.battlesWon + (victory ? 1 : 0),
      battlesLost: workingState.battlesLost + (defeat ? 1 : 0),
      lastBattle: {
        status: 'done',
        enemyType: enemy.type,
        result: outcome,
        soldiersLost,
        foodGained,
        atMs: state.stats.playTimeMs,
      },
    };

    // Emit event
    this.bus.emit('battle_completed', result);

    return { newState, result };
  }
}
