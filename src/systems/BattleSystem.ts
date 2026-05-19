import type { EventBus } from '../engine/EventBus';
import type { GameState } from '../state/GameState';
import { getRandomEnemy, scaleEnemy, type EnemyDef } from './EnemySystem';
import {
  getSoldierStrength,
  getSoldierDefense,
  getSoldierSpeed,
  getSoldierMaxHp,
} from './SoldierSystem';

export interface BattleResult {
  victory: boolean;
  soldiersLost: number;
  enemyType: string;
  foodGained: number;
  specialLoot: {
    chitin: number;
    silk: number;
    venom: number;
  };
  narrative: string;
}

const MAX_ROUNDS = 20;

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function rollInt(min: number, max: number): number {
  return Math.floor(rng(min, max + 0.9999));
}

export class BattleSystem {
  constructor(private bus: EventBus) {}

  resolveBattle(state: GameState): {
    newState: GameState;
    result: BattleResult;
  } {
    // Cannot fight without soldiers
    if (state.combatSoldiers <= 0) {
      return {
        newState: state,
        result: {
          victory: false,
          soldiersLost: 0,
          enemyType: 'none',
          foodGained: 0,
          specialLoot: { chitin: 0, silk: 0, venom: 0 },
          narrative: 'No soldiers available for battle.',
        },
      };
    }

    // Pick and scale enemy
    const baseEnemy = getRandomEnemy(state.battlesWon);
    const enemy = scaleEnemy(baseEnemy, state.battlesWon);

    // Player stats
    const soldierStrength = getSoldierStrength(state);
    const soldierDefense = getSoldierDefense(state);
    const soldierSpeed = getSoldierSpeed(state);
    const soldierMaxHp = getSoldierMaxHp(state);

    const totalSoldierStrength = state.combatSoldiers * soldierStrength;
    let playerHp = state.combatSoldiers * soldierMaxHp;
    let enemyHp = enemy.hp;

    // Determine attack order: faster side goes first
    const playerFirst = soldierSpeed >= enemy.speed;

    let round = 0;
    for (round = 0; round < MAX_ROUNDS; round++) {
      // First attacker
      if (playerFirst) {
        const damage = (totalSoldierStrength / enemy.defense) * rng(0.85, 1.15);
        enemyHp -= damage;
      } else {
        const damage = (enemy.strength / soldierDefense) * rng(0.85, 1.15);
        playerHp -= damage;
      }

      // Check if first attack killed target
      if (enemyHp <= 0 || playerHp <= 0) break;

      // Second attacker
      if (playerFirst) {
        const damage = (enemy.strength / soldierDefense) * rng(0.85, 1.15);
        playerHp -= damage;
      } else {
        const damage = (totalSoldierStrength / enemy.defense) * rng(0.85, 1.15);
        enemyHp -= damage;
      }

      // Check if second attack killed target
      if (enemyHp <= 0 || playerHp <= 0) break;
    }

    const victory = enemyHp <= 0 && playerHp > 0;
    const defeat = playerHp <= 0;

    // Calculate soldiers lost
    let soldiersLost: number;
    if (defeat) {
      soldiersLost = state.combatSoldiers;
    } else {
      soldiersLost = Math.round(
        (enemy.strength / Math.max(soldierDefense, 0.1)) * rng(0.7, 1.3),
      );
      soldiersLost = Math.max(0, Math.min(soldiersLost, state.combatSoldiers));
    }

    const survivingSoldiers = state.combatSoldiers - soldiersLost;

    // Loot (only on victory)
    let foodGained = 0;
    let chitinGained = 0;
    let silkGained = 0;
    let venomGained = 0;

    if (victory) {
      foodGained = rollInt(enemy.loot.foodMin, enemy.loot.foodMax);

      if (enemy.loot.specialResource) {
        const res = enemy.loot.specialResource;
        const amount = rollInt(res.min, res.max);
        if (res.type === 'chitin') chitinGained = amount;
        else if (res.type === 'silk') silkGained = amount;
        else if (res.type === 'venom') venomGained = amount;
      }

      // Scorpion gives extra chitin on top of venom
      if (enemy.type === 'scorpion') {
        chitinGained = rollInt(1, 5);
      }
    }

    // Build narrative
    let narrative: string;
    if (victory) {
      narrative = `⚔️ ${state.combatSoldiers} soldiers defeated a ${enemy.name}. ${soldiersLost} fell. +${foodGained} food.`;
      const specialParts: string[] = [];
      if (chitinGained > 0) specialParts.push(`${chitinGained} chitin`);
      if (silkGained > 0) specialParts.push(`${silkGained} silk`);
      if (venomGained > 0) specialParts.push(`${venomGained} venom`);
      if (specialParts.length > 0) {
        narrative += ` The colony salvages ${specialParts.join(', ')} from the ${enemy.name} carcass.`;
      }
    } else if (defeat) {
      narrative = `💀 ${state.combatSoldiers} soldiers were slaughtered by a ${enemy.name}. None survived.`;
    } else {
      // Draw: max rounds exceeded, enemy flees
      narrative = `⚔️ After a long skirmish, the ${enemy.name} fled. ${soldiersLost} soldiers fell.`;
    }

    const result: BattleResult = {
      victory,
      soldiersLost,
      enemyType: enemy.type,
      foodGained,
      specialLoot: { chitin: chitinGained, silk: silkGained, venom: venomGained },
      narrative,
    };

    // Apply to state
    const newState: GameState = {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food + foodGained,
      },
      combatSoldiers: survivingSoldiers,
      combatResources: {
        chitin: state.combatResources.chitin + chitinGained,
        silk: state.combatResources.silk + silkGained,
        venom: state.combatResources.venom + venomGained,
      },
      battlesWon: state.battlesWon + (victory ? 1 : 0),
      battlesLost: state.battlesLost + (defeat ? 1 : 0),
      lastBattle: {
        enemyType: enemy.type,
        result: victory ? 'victory' : defeat ? 'defeat' : 'pending',
        soldiersLost,
        foodGained,
        timestamp: Date.now(),
      },
    };

    // Emit event
    this.bus.emit('battle_completed', result);

    return { newState, result };
  }
}
