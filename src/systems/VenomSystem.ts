import type { GameState } from '../state/GameState';
import { combatBalance } from '../data/balance/combat';

/**
 * VenomSystem — manages poison damage-over-time mechanics.
 * Requires Venom Lab building (Lv.1+) and venom in stock.
 * Consumes `venomPerBattle` venom per battle activation.
 *
 * Poison damage per round = venom_lab.level × `poisonDamagePerLabLevel` (`data/balance/combat.ts`).
 */
export function getPoisonDamagePerTick(state: GameState): number {
  if (
    state.buildings.venom_lab.level >= 1 &&
    state.combatResources.venom >= combatBalance.venomPerBattle
  ) {
    return state.buildings.venom_lab.level * combatBalance.poisonDamagePerLabLevel;
  }
  return 0;
}

/**
 * Deduct 1 venom from combat resources.
 * Call once at battle start when poison activates.
 */
export function consumeVenom(state: GameState): GameState {
  return {
    ...state,
    combatResources: {
      ...state.combatResources,
      venom: state.combatResources.venom - combatBalance.venomPerBattle,
    },
  };
}
