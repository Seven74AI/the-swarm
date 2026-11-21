import type { GameState } from './GameState';
import { canBuild, type BuildingType } from '../systems/BuildingSystem';
import { canStartProject, getProjects } from '../systems/ResearchSystem';
import { canPurchaseMutation, MUTATIONS } from '../systems/MutationSystem';
import {
  AUTOMATION_BUILDINGS,
  RESEARCHES,
  canBuildAuto,
  canResearch,
  type AutomationBuildingType,
  type ResearchType,
} from '../systems/AutomationSystem';
import { isPrestigeAvailable } from '../systems/PrestigeSystem';

/**
 * Everything the player can afford right now, as `<panelId>:<item>` keys
 * (Story 1.15). The tab bar maps each panel to its tab through the tab
 * registry and shows `•` on a tab when one of its keys appears while the
 * player is elsewhere. Read-only: it never changes the state.
 */
export function affordableKeys(state: GameState): string[] {
  const keys: string[] = [];
  for (const b of Object.keys(state.buildings) as BuildingType[]) {
    if (canBuild(b, state)) keys.push(`building_panel:${b}`);
  }
  for (const p of getProjects()) {
    if (canStartProject(state, p.id)) keys.push(`research_panel:${p.id}`);
  }
  for (const m of MUTATIONS) {
    if (canPurchaseMutation(state, m.id)) keys.push(`mutation_panel:${m.id}`);
  }
  for (const b of Object.keys(AUTOMATION_BUILDINGS) as AutomationBuildingType[]) {
    if (canBuildAuto(b, state)) keys.push(`automation_panel:${b}`);
  }
  for (const r of Object.keys(RESEARCHES) as ResearchType[]) {
    if (canResearch(r, state)) keys.push(`automation_panel:research-${r}`);
  }
  if (isPrestigeAvailable(state)) keys.push('prestige_panel:prestige');
  return keys;
}
