import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { getAssignedWorkers, getUpgradeCost, type WorkerRole } from '../systems/ResourceSystem';
import { freeWorkers, moveWorkers as move, roleCount, stepRole as step, type MoveSource } from '../systems/Workforce';
import type { RoleId } from '../data/content/roles';

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

/**
 * Put `delta` free workers on a role, or take them off (negative), in one
 * write (Story 1.23: a WRKR stepper press of ×1, ×10 or ×MAX). Research is
 * the researcher pool.
 */
export function stepRole(deps: ActionDeps, role: RoleId, delta: number): ActionResult {
  const s = current(deps);
  if (delta > 0 && freeWorkers(s) < delta) return refuse('no_free_workers');
  if (delta < 0 && roleCount(s, role) < -delta) return refuse('none_assigned');
  const r = commit(deps, s, step(s, role, delta));
  if (r.ok && role !== 'research') deps.bus.emit('workers_assigned', { role, assigned: current(deps).workersAssigned });
  return r;
}

/** Move whole workers from a role (or the free pool) to another role in one write (WRKR's `> MOVE 4 TO GATHER`). */
export function moveWorkers(deps: ActionDeps, from: MoveSource, to: RoleId, count: number): ActionResult {
  const s = current(deps);
  if (from === 'free' && freeWorkers(s) < count) return refuse('no_free_workers');
  if (from !== 'free' && roleCount(s, from) < count) return refuse('none_assigned');
  const r = commit(deps, s, move(s, from, to, count));
  if (r.ok && to !== 'research') deps.bus.emit('workers_assigned', { role: to, assigned: current(deps).workersAssigned });
  return r;
}

/** Buy one level of a food upgrade (click power). */
export function buyUpgrade(deps: ActionDeps, upgradeId: string): ActionResult {
  const s = current(deps);
  const cost = getUpgradeCost(upgradeId, s.upgrades[upgradeId] ?? 0);
  if (cost === null) return refuse('unknown_id');
  if (s.resources.food < cost) return refuse('cannot_afford');
  return commit(deps, s, deps.resourceSystem.buyUpgrade(s, upgradeId));
}
