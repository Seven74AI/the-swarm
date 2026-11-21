import { commit, current, refuse, type ActionResult } from './result';
import type { ActionDeps } from './context';
import type { GameState, ResearchProjectId } from '../state/GameState';
import {
  assignResearcher as assignResearcherTo,
  cancelProject,
  getAssignedResearchers,
  getProjectStatus,
  getProjects,
  startProject,
  unassignResearcher as unassignResearcherFrom,
} from '../systems/ResearchSystem';
import { getConversionDefs, isConversionUnlocked, tickConversions } from '../systems/ResourceConversionSystem';

/** Move one worker into the research pool. */
export function assignResearcher(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (s.resources.workers <= 0) return refuse('no_free_workers');
  return commit(deps, s, assignResearcherTo(s));
}

/** Return one researcher to the worker pool. */
export function unassignResearcher(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (getAssignedResearchers(s) <= 0) return refuse('none_assigned');
  return commit(deps, s, unassignResearcherFrom(s));
}

/** Start a research project: it becomes a running lifecycle in game-time ms. */
export function startResearch(deps: ActionDeps, id: ResearchProjectId): ActionResult {
  const s = current(deps);
  const def = getProjects().find((p) => p.id === id);
  if (!def) return refuse('unknown_id');
  const status = getProjectStatus(s, id);
  if (status === 'locked') return refuse('locked');
  if (status === 'in_progress') return refuse('already_running');
  if (status === 'completed') return refuse('already_owned');
  if (getAssignedResearchers(s) < def.requiredResearchers) return refuse('too_few_researchers');
  for (const [resource, amount] of Object.entries(def.cost)) {
    if ((s.resources[resource as keyof GameState['resources']] as number) < (amount as number)) return refuse('cannot_afford');
  }
  return commit(deps, s, startProject(s, id));
}

/** Cancel a running project (half the cost comes back). */
export function cancelResearch(deps: ActionDeps, id: ResearchProjectId): ActionResult {
  const s = current(deps);
  if (s.research.projects[id]?.status !== 'running') return refuse('not_running');
  return commit(deps, s, cancelProject(s, id));
}

/** Run every unlocked conversion once by hand. */
export function runConversions(deps: ActionDeps): ActionResult {
  const s = current(deps);
  if (!getConversionDefs().some((d) => isConversionUnlocked(s, d.id))) return refuse('locked');
  const next = tickConversions(s, 1);
  const changed = (Object.keys(s.resources) as (keyof GameState['resources'])[])
    .some((k) => next.resources[k] !== s.resources[k]);
  if (!changed) return refuse('cannot_afford');
  const r = commit(deps, s, next);
  if (r.ok) deps.bus.emit('conversion_tick', { tick: 1 });
  return r;
}
