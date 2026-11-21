import type { DecisionEvent } from '../systems/DecisionSystem';
import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';

/**
 * Player intent: pick a choice on a decision popup.
 * Writes the consequence to `gameState` between ticks. This used to happen in
 * a `decision_chosen` listener; listeners must not write state (AR18).
 */
export function chooseDecision(
  deps: ActionDeps,
  type: DecisionEvent['type'],
  choice: string,
): ActionResult {
  const s = current(deps);
  if (!deps.decisionSystem.hasChoice(type, choice)) return refuse('unknown_id');
  return commit(deps, s, deps.decisionSystem.applyChoice(s, type, choice));
}
