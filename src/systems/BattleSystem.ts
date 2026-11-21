import { colonyLine } from '../data/content/colonyLines';
import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import { getEnemyDef, getRandomEnemy, scaleEnemy } from './EnemySystem';
import { armyOf, fightRounds, type BattleOutcome } from './CombatRounds';
import { battleCause } from './BattleCauses';
import type { BattleCause } from './Counters';
import { consumeVenom } from './VenomSystem';
import { between, intBetween, rngStream, type RngStream } from '../utils/rng';
import { combatBalance } from '../data/balance/combat';
import type { EnemyType } from '../data/content/enemies';

export type { BattleOutcome } from './CombatRounds';

export interface BattleResult {
  victory: boolean;
  /** How it ended; the same value as `lastBattle.result`. A draw: the enemy fled after the last round. */
  outcome: BattleOutcome;
  /** Rounds fought (1 to `MAX_BATTLE_ROUNDS`), for the enemy card's round counter (Story 1.25). */
  rounds: number;
  /** Why it went this way (Story 4.3): the summary's cause line and `> CHANGE → <card>` read it. */
  cause: BattleCause;
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


export class BattleSystem {
  constructor(private bus: EventBus) {}

  /**
   * Fight one battle now. `enemyType` is the enemy the player saw on the enemy
   * card (Story 1.25); without it, `state.nextEnemy`, the one the card shows
   * (Story 4.1). After the battle the next enemy is drawn into state.
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
      const facing = scaleEnemy(getEnemyDef(enemyType ?? state.nextEnemy), state.battlesWon);
      return {
        newState: state,
        result: {
          victory: false,
          outcome: 'defeat',
          rounds: 0,
          cause: battleCause(state, facing, 'defeat'),
          soldiersLost: 0,
          enemyType: 'none',
          foodGained: 0,
          specialLoot: { chitin: 0, silk: 0, venom: 0 },
          poisonDamageDealt: 0,
          narrative: colonyLine('battle_no_soldiers'),
        },
      };
    }

    // The enemy on the card (Story 4.1: drawn into state by the battle before), scaled to the battles won
    const enemy = scaleEnemy(getEnemyDef(enemyType ?? state.nextEnemy), state.battlesWon);

    // Poison DoT: activate if Venom Lab Lv.1+ and venom in stock
    const army = armyOf(state);
    const workingState = army.poisonPerRound > 0 ? consumeVenom(state) : state;
    const soldierDefense = army.defense;

    const fought = fightRounds(army, enemy, rng);
    const { outcome, rounds } = fought;
    const poisonDamageDealt = fought.poisonDealt;
    const victory = outcome === 'victory';
    const defeat = outcome === 'defeat';

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
      cause: battleCause(state, enemy, outcome),
      soldiersLost,
      enemyType: enemy.type,
      foodGained,
      specialLoot: { chitin: chitinGained, silk: silkGained, venom: venomGained },
      poisonDamageDealt,
      narrative,
    };

    // Apply to state
    const battlesWon = workingState.battlesWon + (victory ? 1 : 0);
    // The next enemy is drawn now, after this battle's rolls (Story 4.1): the card shows it until it is fought.
    const nextEnemy = getRandomEnemy(battlesWon, rng).type as EnemyType;
    const newState: GameState = {
      ...workingState,
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
      battlesWon,
      nextEnemy,
      battlesLost: workingState.battlesLost + (defeat ? 1 : 0),
      rng: rng.state,
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
