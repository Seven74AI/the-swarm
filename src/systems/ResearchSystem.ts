import type { GameState, ResearchProject, ResearchProjectId, ResearchProjectStatus } from '../state/GameState';
import type { PanelId } from '../data/content/tabs';
import { OFFLINE_EFFICIENCY_STEP_POINTS } from '../data/constants';

export type { ResearchProjectId } from '../state/GameState';

export interface ResearchProjectDef {
  id: ResearchProjectId;
  name: string;
  description: string;
  cost: Partial<Record<keyof GameState['resources'], number>>;
  requiredResearchers: number;
  /** Game-time length of the project while staffed. */
  durationMs: number;
  unlock: string;
  prerequisite: ResearchProjectId | null;
  /** The BUILD panel whose cards sell it (the space chain, or the offline research from Colony). */
  panel: Extract<PanelId, 'research_panel' | 'offline_research_panel'>;
  /** Offline efficiency points while this run has it done (Story 2.8, `getOfflineEfficiency`). */
  offlineEfficiencyPoints?: number;
}

/**
 * The run's offline research (Story 2.8, FR21): open from Colony, paid in food,
 * it needs no researchers (the researcher row opens with the space chain).
 * Prestige wipes it; the Legacy efficiency node is the permanent half.
 */
export const OFFLINE_RESEARCH_ID = 'dormantForaging' satisfies ResearchProjectId;

const PROJECTS: ResearchProjectDef[] = [
  {
    id: 'voidCrystalSynthesis',
    name: 'Void Crystal Synthesis',
    description: 'Synthesize void crystals from stone and nectar using concentrated worker energy.',
    cost: { stone: 500, nectar: 200 },
    requiredResearchers: 50,
    durationMs: 30_000, // 600 ticks
    unlock: 'voidCrystal',
    prerequisite: null,
    panel: 'research_panel',
  },
  {
    id: 'antimatterContainment',
    name: 'Antimatter Containment',
    description: 'Contain antimatter using void crystal lattices. Requires a particle lab.',
    cost: { voidCrystals: 5 },
    requiredResearchers: 30,
    durationMs: 75_000, // 1500 ticks
    unlock: 'antimatter + particle lab',
    prerequisite: 'voidCrystalSynthesis',
    panel: 'research_panel',
  },
  {
    id: 'darkMatterDetection',
    name: 'Dark Matter Detection',
    description: 'Detect dark matter signatures using antimatter annihilation sensors.',
    cost: { antimatter: 0.1 },
    requiredResearchers: 20,
    durationMs: 150_000, // 3000 ticks
    unlock: 'darkMatter from expeditions',
    prerequisite: 'antimatterContainment',
    panel: 'research_panel',
  },
  {
    id: OFFLINE_RESEARCH_ID,
    name: 'Dormant Foraging',
    description: 'Workers keep a slow foraging rhythm while the colony is left alone.',
    cost: { food: 300 },
    requiredResearchers: 0,
    durationMs: 60_000, // 1200 ticks
    unlock: 'offline efficiency',
    prerequisite: null,
    panel: 'offline_research_panel',
    offlineEfficiencyPoints: OFFLINE_EFFICIENCY_STEP_POINTS,
  },
];

/** Returns all research project definitions (every panel). */
export function getProjects(): ResearchProjectDef[] {
  return PROJECTS;
}

/** The projects one BUILD panel sells, in card order. */
export function getProjectsFor(panel: ResearchProjectDef['panel']): ResearchProjectDef[] {
  return PROJECTS.filter((p) => p.panel === panel);
}

/** Get the definition for a specific project. */
function getProjectDef(id: ResearchProjectId): ResearchProjectDef {
  const def = PROJECTS.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown research project: ${id}`);
  return def;
}

/** Returns the current status of a research project. */
export function getProjectStatus(
  state: GameState,
  projectId: ResearchProjectId,
): ResearchProjectStatus {
  const projectState = state.research.projects[projectId];

  // Lifecycle already moved on
  if (projectState.status === 'running') return 'in_progress';
  if (projectState.status === 'done') return 'completed';

  // Check prerequisite
  const def = getProjectDef(projectId);
  if (def.prerequisite) {
    const prereqState = state.research.projects[def.prerequisite];
    if (!prereqState || prereqState.status !== 'done') {
      return 'locked';
    }
  }

  return 'available';
}

/** Check if a project can be started. */
export function canStartProject(
  state: GameState,
  projectId: ResearchProjectId,
): boolean {
  const status = getProjectStatus(state, projectId);
  if (status !== 'available') return false;

  const def = getProjectDef(projectId);

  // Check researcher requirement
  if (getAssignedResearchers(state) < def.requiredResearchers) return false;

  // Check resource costs
  for (const [resource, amount] of Object.entries(def.cost)) {
    const key = resource as keyof GameState['resources'];
    if ((state.resources[key] as number) < (amount as number)) return false;
  }

  return true;
}

/** Start a research project, deducting costs. */
export function startProject(
  state: GameState,
  projectId: ResearchProjectId,
): GameState {
  if (!canStartProject(state, projectId)) return state;

  const def = getProjectDef(projectId);

  // Deduct costs
  const resources = { ...state.resources };
  for (const [resource, amount] of Object.entries(def.cost)) {
    const key = resource as keyof GameState['resources'];
    (resources as Record<string, number>)[resource] = (resources[key] as number) - (amount as number);
  }

  return {
    ...state,
    resources,
    research: {
      ...state.research,
      projects: {
        ...state.research.projects,
        [projectId]: { status: 'running', progressMs: 0, durationMs: def.durationMs },
      },
    },
  };
}

/** Cancel an in-progress project, refunding 50% of resources. */
export function cancelProject(
  state: GameState,
  projectId: ResearchProjectId,
): GameState {
  const projectState = state.research.projects[projectId];
  if (projectState.status !== 'running') return state;

  const def = getProjectDef(projectId);

  // Refund 50% of costs (floor)
  const resources = { ...state.resources };
  for (const [resource, amount] of Object.entries(def.cost)) {
    const refund = Math.floor((amount as number) / 2);
    if (refund > 0) {
      const key = resource as keyof GameState['resources'];
      (resources as Record<string, number>)[resource] = (resources[key] as number) + refund;
    }
  }

  return {
    ...state,
    resources,
    research: {
      ...state.research,
      projects: {
        ...state.research.projects,
        [projectId]: { status: 'idle' },
      },
    },
  };
}

/**
 * Advance every running project by the tick's game time. A project advances
 * only while its own researcher requirement is met; it ends `done`.
 */
export function tickResearch(state: GameState, dtSec: number): GameState {
  // Guard: no-op if research state doesn't exist yet (backward compat with old saves)
  if (!state.research || !state.research.projects) return state;

  const researchers = getAssignedResearchers(state);
  const dtMs = Math.round(dtSec * 1000);
  const ids = Object.keys(state.research.projects) as ResearchProjectId[];

  let projects: Record<ResearchProjectId, ResearchProject> | null = null;
  for (const id of ids) {
    const current = state.research.projects[id];
    if (current.status !== 'running') continue;
    if (researchers < getProjectDef(id).requiredResearchers) continue;
    const progressMs = current.progressMs + dtMs;
    const next: ResearchProject = progressMs >= current.durationMs
      ? { status: 'done' }
      : { ...current, progressMs };
    projects = { ...(projects ?? state.research.projects), [id]: next };
  }

  if (!projects) return state;
  return { ...state, research: { ...state.research, projects } };
}

/** Assign one worker as researcher. */
export function assignResearcher(state: GameState): GameState {
  if (state.resources.workers <= 0) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      workers: state.resources.workers - 1,
    },
    workersAssigned: {
      ...state.workersAssigned,
      researchers: state.workersAssigned.researchers + 1,
    },
  };
}

/** Return one researcher to the worker pool. */
export function unassignResearcher(state: GameState): GameState {
  if (state.workersAssigned.researchers <= 0) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      workers: state.resources.workers + 1,
    },
    workersAssigned: {
      ...state.workersAssigned,
      researchers: state.workersAssigned.researchers - 1,
    },
  };
}

/** Get the number of assigned researchers. */
export function getAssignedResearchers(state: GameState): number {
  return state.workersAssigned?.researchers ?? 0;
}

/** Get total game-time progress (ms) across running projects. */
export function getTotalProgress(state: GameState): number {
  return Object.values(state.research.projects)
    .reduce((sum, p) => sum + (p.status === 'running' ? p.progressMs : 0), 0);
}

/** Check if a project is completed. */
export function isProjectCompleted(
  state: GameState,
  projectId: ResearchProjectId,
): boolean {
  return state.research.projects[projectId].status === 'done';
}
