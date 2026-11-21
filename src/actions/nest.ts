import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { getAssignedWorkers, getUpgradeCost, type WorkerRole } from '../systems/ResourceSystem';

/** Lay eggs by hand. Always allowed. */
export function layEgg(deps: ActionDeps): ActionResult {
  const s = current(deps);
  const r = commit(deps, s, deps.resourceSystem.clickEgg(s));
  if (r.ok) deps.bus.emit('egg_clicked', {});
  return r;
}

/** Put one free worker on a job. */
export function assignWorker(deps: ActionDeps, role: WorkerRole): ActionResult {
  const s = current(deps);
  if (getAssignedWorkers(s) >= s.resources.workers) return refuse('no_free_workers');
  return commit(deps, s, deps.resourceSystem.assignWorker(s, role));
}

/** Take one worker off a job. */
export function unassignWorker(deps: ActionDeps, role: WorkerRole): ActionResult {
  const s = current(deps);
  if (s.workersAssigned[role] <= 0) return refuse('none_assigned');
  return commit(deps, s, deps.resourceSystem.unassignWorker(s, role));
}

/** Buy one level of a food upgrade (click power). */
export function buyUpgrade(deps: ActionDeps, upgradeId: string): ActionResult {
  const s = current(deps);
  const cost = getUpgradeCost(upgradeId, s.upgrades[upgradeId] ?? 0);
  if (cost === null) return refuse('unknown_id');
  if (s.resources.food < cost) return refuse('cannot_afford');
  return commit(deps, s, deps.resourceSystem.buyUpgrade(s, upgradeId));
}

/** Pause or resume the simulation flag in state. The UI drives the loop itself. */
export function togglePause(deps: ActionDeps): ActionResult {
  const s = current(deps);
  return commit(deps, s, { ...s, paused: !s.paused });
}
