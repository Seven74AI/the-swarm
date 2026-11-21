import { applyChoice, canChoose } from '../systems/DecisionSystem';
import { getDecision } from '../data/content/decisions';
import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';

/**
 * Player intent: answer the open decision event (Story 1.28, D8).
 * The choice goes through the same pure `applyChoice` as a timeout; the
 * state is written between ticks, then `decision_resolved` is emitted.
 */
export function chooseDecision(deps: ActionDeps, choice: string): ActionResult {
  const s = current(deps);
  const open = s.decision.open;
  if (!open) return refuse('not_running');
  const def = getDecision(open.id);
  if (!def.choices.some((c) => c.id === choice)) return refuse('unknown_id');
  if (!canChoose(s, def, choice)) return refuse('cannot_afford');
  const result = commit(deps, s, applyChoice(s, def, choice));
  if (result.ok) deps.bus.emit('decision_resolved', { id: def.id, choice, timedOut: false, policy: def.ignorePolicy });
  return result;
}
