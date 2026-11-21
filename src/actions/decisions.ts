import { gameState } from '../state/gameSignal';
import type { DecisionEvent, DecisionSystem } from '../systems/DecisionSystem';

/**
 * Player intent: pick a choice on a decision popup.
 * Writes the consequence to `gameState` between ticks. This used to happen in
 * a `decision_chosen` listener; listeners must not write state (AR18).
 */
export function chooseDecision(
  system: DecisionSystem,
  type: DecisionEvent['type'],
  choice: string,
): void {
  gameState.value = system.applyChoice(gameState.value, type, choice);
}
