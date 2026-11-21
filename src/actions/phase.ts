import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { EventQueue } from '../engine/events';
import { PhaseStateMachine } from '../phases/PhaseStateMachine';
import type { Phase } from '../phases/phases';

const defaultPhases = new PhaseStateMachine();

/**
 * CONTINUE (Story 1.19, D3): enter the next phase once its goal has latched.
 * The guard is not re-checked: a latched goal still commits after a dip.
 * `phase_committed` and the transition's own events go out after the write.
 */
export function continuePhase(deps: ActionDeps): ActionResult {
  const phases = deps.phases ?? defaultPhases;
  const s = current(deps);
  const t = phases.pending(s);
  if (!t) return refuse('not_ready');
  const events = new EventQueue();
  const r = commit(deps, s, phases.commit(t, s, events));
  if (r.ok) events.flushTo(deps.bus);
  return r;
}

/**
 * A phase reveal played to its end (Story 1.20): record it in
 * `lifetime.revealsSeen`, so that phase's reveal can be skipped from now on
 * (in this run after prestige, and in every later one).
 */
export function markRevealSeen(deps: ActionDeps, phase: Phase): ActionResult {
  const s = current(deps);
  const seen = s.lifetime?.revealsSeen ?? [];
  if (seen.includes(phase)) return refuse('already_owned');
  return commit(deps, s, { ...s, lifetime: { ...s.lifetime, revealsSeen: [...seen, phase] } });
}
