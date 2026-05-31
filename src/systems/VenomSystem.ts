import type { GameState } from '../state/GameState';

/**
 * VenomSystem — manages poison damage-over-time mechanics.
 * Requires Venom Lab building (Lv.1+) and venom in stock.
 * Consumes 1 venom per battle activation.
 *
 * Poison damage per round = venom_lab.level * 2.
 */
export function getPoisonDamagePerTick(state: GameState): number {
  if (
    state.buildings.venom_lab.level >= 1 &&
    state.combatResources.venom >= 1
  ) {
    return state.buildings.venom_lab.level * 2;
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
      venom: state.combatResources.venom - 1,
    },
  };
}
