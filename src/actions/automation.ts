import type { ActionDeps } from './context';
import { OK, commit, current, refuse, type ActionResult } from './result';
import { isAutomationUnlocked, maxAutomationTarget, setAutomationTarget as setTarget } from '../systems/AutomationTargets';
import type { AutomationVerb } from '../data/content/automation';

/**
 * Set a verb's automation target (Story 4.10, UX-DR16: the row's `[−] N [+]`).
 * Refused while the row is locked, and for anything but a whole number
 * within 0 and the maximum (`unavailable`).
 */
export function setAutomationTarget(deps: ActionDeps, verb: AutomationVerb, target: number): ActionResult {
  const s = current(deps);
  if (!isAutomationUnlocked(s, verb)) return refuse('locked');
  if (!Number.isInteger(target) || target < 0 || target > maxAutomationTarget()) return refuse('unavailable');
  if (s.automation.targets[verb].target === target) return OK;
  return commit(deps, s, setTarget(s, verb, { target }));
}

/** Turn a verb's automation on or off (the row's `[AUTO]`). Refused while the row is locked. */
export function setAutomation(deps: ActionDeps, verb: AutomationVerb, on: boolean): ActionResult {
  const s = current(deps);
  if (!isAutomationUnlocked(s, verb)) return refuse('locked');
  if (s.automation.targets[verb].on === on) return OK;
  return commit(deps, s, setTarget(s, verb, { on }));
}
