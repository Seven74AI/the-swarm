import type { GameState, ResearchProjectId, ResearchProjectStatus } from '../state/GameState';

export type { ResearchProjectId } from '../state/GameState';

export interface ResearchProjectDef {
  id: ResearchProjectId;
  name: string;
  description: string;
  cost: Partial<Record<keyof GameState['resources'], number>>;
  requiredResearchers: number;
  totalTicks: number;
  unlock: string;
  prerequisite: ResearchProjectId | null;
}

const PROJECTS: ResearchProjectDef[] = [
  {
    id: 'voidCrystalSynthesis',
    name: 'Void Crystal Synthesis',
    description: 'Synthesize void crystals from stone and nectar using concentrated worker energy.',
    cost: { stone: 500, nectar: 200 },
    requiredResearchers: 50,
    totalTicks: 600,
    unlock: 'voidCrystal',
    prerequisite: null,
  },
  {
    id: 'antimatterContainment',
    name: 'Antimatter Containment',
    description: 'Contain antimatter using void crystal lattices. Requires a particle lab.',
    cost: { voidCrystals: 5 },
    requiredResearchers: 30,
    totalTicks: 1500,
    unlock: 'antimatter + particle lab',
    prerequisite: 'voidCrystalSynthesis',
  },
  {
    id: 'darkMatterDetection',
    name: 'Dark Matter Detection',
    description: 'Detect dark matter signatures using antimatter annihilation sensors.',
    cost: { antimatter: 0.1 },
    requiredResearchers: 20,
    totalTicks: 3000,
    unlock: 'darkMatter from expeditions',
    prerequisite: 'antimatterContainment',
  },
];

/** Returns all research project definitions. */
export function getProjects(): ResearchProjectDef[] {
  return PROJECTS;
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

  // State already set
  if (projectState.state === 'in_progress') return 'in_progress';
  if (projectState.state === 'completed') return 'completed';

  // Check prerequisite
  const def = getProjectDef(projectId);
  if (def.prerequisite) {
    const prereqState = state.research.projects[def.prerequisite];
    if (!prereqState || prereqState.state !== 'completed') {
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
        [projectId]: {
          state: 'in_progress' as const,
          progress: 0,
        },
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
  if (projectState.state !== 'in_progress') return state;

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
        [projectId]: {
          state: 'available' as const,
          progress: 0,
        },
      },
    },
  };
}

/** Advance research progress for each in-progress project. */
export function tickResearch(state: GameState): GameState {
  // Guard: no-op if research state doesn't exist yet (backward compat with old saves)
  if (!state.research || !state.research.projects) return state;

  const researchers = getAssignedResearchers(state);

  // Sum required researchers across all in-progress projects
  const inProgressIds = (Object.keys(state.research.projects) as ResearchProjectId[])
    .filter((id) => state.research.projects[id].state === 'in_progress');

  if (inProgressIds.length === 0) return state;

  // Check if we have enough researchers total (distributed across projects)
  const totalRequired = inProgressIds.reduce(
    (sum, id) => sum + getProjectDef(id).requiredResearchers,
    0,
  );

  if (researchers < totalRequired) {
    // Not enough researchers — only projects with their individual requirement met advance
    let projects = { ...state.research.projects };
    let anyAdvanced = false;

    for (const id of inProgressIds) {
      const def = getProjectDef(id);
      if (researchers >= def.requiredResearchers) {
        const current = projects[id];
        const newProgress = current.progress + 1;
        anyAdvanced = true;
        projects = {
          ...projects,
          [id]: newProgress >= def.totalTicks
            ? { state: 'completed' as const, progress: def.totalTicks }
            : { ...current, progress: newProgress },
        };
      }
    }

    if (!anyAdvanced) return state;

    return {
      ...state,
      research: {
        ...state.research,
        projects,
      },
    };
  }

  // Enough researchers — all in-progress projects advance
  let projects = { ...state.research.projects };
  for (const id of inProgressIds) {
    const def = getProjectDef(id);
    const current = projects[id];
    const newProgress = current.progress + 1;
    projects = {
      ...projects,
      [id]: newProgress >= def.totalTicks
        ? { state: 'completed' as const, progress: def.totalTicks }
        : { ...current, progress: newProgress },
    };
  }

  return {
    ...state,
    research: {
      ...state.research,
      projects,
    },
  };
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

/** Get total progress across all projects. */
export function getTotalProgress(state: GameState): number {
  return (Object.values(state.research.projects) as Array<{ progress: number }>)
    .reduce((sum, p) => sum + p.progress, 0);
}

/** Check if a project is completed. */
export function isProjectCompleted(
  state: GameState,
  projectId: ResearchProjectId,
): boolean {
  return state.research.projects[projectId].state === 'completed';
}
