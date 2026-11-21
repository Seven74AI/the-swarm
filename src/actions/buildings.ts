import type { ActionDeps } from './context';
import { commit, current, refuse, type ActionResult } from './result';
import { build, canBuild, type BuildingType } from '../systems/BuildingSystem';
import {
  AUTOMATION_BUILDINGS,
  RESEARCHES,
  buildAuto,
  canBuildAuto,
  canResearch,
  research,
  type AutomationBuildingType,
  type ResearchType,
} from '../systems/AutomationSystem';

/** Build or level up a colony building. */
export function buyBuilding(deps: ActionDeps, type: BuildingType): ActionResult {
  const s = current(deps);
  if (!canBuild(type, s)) return refuse('cannot_afford');
  const r = commit(deps, s, build(type, s));
  if (r.ok) deps.bus.emit('building_complete', { building: type, level: current(deps).buildings[type].level });
  return r;
}

/** Buy an automation research. */
export function researchAutomation(deps: ActionDeps, id: ResearchType): ActionResult {
  const s = current(deps);
  const def = RESEARCHES[id];
  if (!def) return refuse('unknown_id');
  if (s.autoProduction.researches[id]) return refuse('already_owned');
  if (def.prerequisites.some((p) => !s.autoProduction.researches[p])) return refuse('locked');
  if (!canResearch(id, s)) return refuse('cannot_afford');
  const r = commit(deps, s, research(id, s));
  if (r.ok) deps.bus.emit('research_complete', { research: id });
  return r;
}

/** Build or level up an automation building. */
export function buildAutomation(deps: ActionDeps, id: AutomationBuildingType): ActionResult {
  const s = current(deps);
  const def = AUTOMATION_BUILDINGS[id];
  if (!def) return refuse('unknown_id');
  if ((s.autoProduction.buildings[id] ?? 0) >= def.maxLevel) return refuse('max_level');
  if (!canBuildAuto(id, s)) return refuse('cannot_afford');
  const r = commit(deps, s, buildAuto(id, s));
  if (r.ok) deps.bus.emit('auto_building_complete', { building: id, level: current(deps).autoProduction.buildings[id] });
  return r;
}

/** Switch automatic egg production on or off. */
export function setAutoProduction(deps: ActionDeps, enabled: boolean): ActionResult {
  const s = current(deps);
  if (s.autoProduction.enabled === enabled) return refuse('unavailable');
  return commit(deps, s, { ...s, autoProduction: { ...s.autoProduction, enabled } });
}
