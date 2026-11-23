import { Phase } from '../../phases/phases';
import { PANEL_PLACEMENT, isUnlocked } from './tabs';
import type { WorkerRole } from '../../systems/ResourceSystem';

/**
 * The role data (Story 1.23, UX-DR15): one WRKR row per role, in row order.
 * A job role (`gather` … `guard`) lives in `workersAssigned[role]`; Research
 * is the researcher pool (`workersAssigned.researchers`), which counts toward
 * the assigned total. A new role is a new entry here (Forage came with Story 3.4).
 */
export type RoleId = WorkerRole | 'research';

export interface RoleDef {
  readonly id: RoleId;
  /** Row label, upper case. */
  readonly label: string;
  /** One worker on this role, for accessible names ("Add one gatherer"). */
  readonly worker: string;
  /** Dim effect line under the label. */
  readonly effect: string;
  readonly unlockPhase: Phase;
}

export const ROLES: readonly RoleDef[] = [
  { id: 'gather', label: 'GATHER', worker: 'gatherer', effect: 'BRINGS IN FOOD AND WOOD', unlockPhase: Phase.COLONY },
  { id: 'forage', label: 'FORAGE', worker: 'forager', effect: 'BRINGS IN NECTAR', unlockPhase: Phase.COLONY },
  { id: 'tend', label: 'TEND', worker: 'nurse', effect: 'EGGS HATCH FASTER', unlockPhase: Phase.COLONY },
  { id: 'dig', label: 'DIG', worker: 'digger', effect: 'ADDS TO EVERY DIG. DIGS SLOWLY ALONE', unlockPhase: Phase.COLONY },
  { id: 'guard', label: 'GUARD', worker: 'guard', effect: 'DEFENDS THE NEST', unlockPhase: Phase.COLONY },
  // Researchers run the research projects, so the row opens with the research panel.
  {
    id: 'research',
    label: 'RESEARCH',
    worker: 'researcher',
    effect: 'RUNS RESEARCH PROJECTS',
    unlockPhase: PANEL_PLACEMENT.research_panel.unlockPhase,
  },
];

/** The roles shown in a phase, in row order. */
export function rolesForPhase(phase: Phase): RoleDef[] {
  return ROLES.filter((r) => isUnlocked(r.unlockPhase, phase));
}
