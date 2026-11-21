import { Phase, PHASE_ORDER } from '../../phases/phases';

/**
 * The tab registry (Story 1.15, AR10, arch D7): which tab, segment and zone
 * hosts each panel, and from which phase. Data, not code: it replaces
 * `PHASE_PANELS` in `ui/PhaseContent.ts`. The panel consolidation follows
 * EXPERIENCE.md (Information Architecture → Panel consolidation).
 */

export type TabId = 'nest' | 'wrkr' | 'build' | 'front' | 'log';
export type SegmentId = 'war' | 'map' | 'stars';

export interface TabDef {
  readonly id: TabId;
  /** Label in the tab bar (4 letters at most). */
  readonly label: string;
  /** Full name, the accessible name. */
  readonly name: string;
  readonly unlockPhase: Phase;
  /** Dim line shown while the tab has no content yet. */
  readonly empty: string;
}

export interface SegmentDef {
  readonly id: SegmentId;
  readonly tab: TabId;
  readonly label: string;
  readonly unlockPhase: Phase;
}

/** Where a panel lives: a tab (and segment), or the global strip at the top. */
export interface PanelPlacement {
  readonly tab: TabId | 'strip';
  readonly segment?: SegmentId;
  /** `primary`: the tab's pinned primary zone instead of its scrolling content. */
  readonly zone?: 'primary';
  readonly unlockPhase: Phase;
}

/** Tabs in bar order. NEST is home; Phase 1 has no tab bar. */
export const TABS: readonly TabDef[] = [
  { id: 'nest', label: 'NEST', name: 'Nest', unlockPhase: Phase.EGG_LAYING, empty: '' },
  { id: 'wrkr', label: 'WRKR', name: 'Workers', unlockPhase: Phase.COLONY, empty: '' },
  { id: 'build', label: 'BUILD', name: 'Build', unlockPhase: Phase.COLONY, empty: 'NOTHING TO BUILD YET.' },
  { id: 'front', label: 'FRONT', name: 'Frontier', unlockPhase: Phase.COMBAT, empty: '' },
  { id: 'log', label: 'LOG', name: 'Chronicle', unlockPhase: Phase.COLONY, empty: 'THE CHRONICLE FILLS AS THE COLONY GROWS.' },
];

/** FRONT's segment row grows WAR → WAR · MAP → WAR · MAP · STARS. */
export const SEGMENTS: readonly SegmentDef[] = [
  { id: 'war', tab: 'front', label: 'WAR', unlockPhase: Phase.COMBAT },
  { id: 'map', tab: 'front', label: 'MAP', unlockPhase: Phase.EXPANSION },
  { id: 'stars', tab: 'front', label: 'STARS', unlockPhase: Phase.SPACE },
];

const placements = {
  // Global: the resource strip and its resource sheet (Story 1.16; the `.resource-panel` host keeps the id).
  resource_panel: { tab: 'strip', unlockPhase: Phase.EGG_LAYING },
  // NEST
  phase_indicator: { tab: 'nest', unlockPhase: Phase.EGG_LAYING },
  click_button: { tab: 'nest', zone: 'primary', unlockPhase: Phase.EGG_LAYING },
  event_log: { tab: 'nest', unlockPhase: Phase.EGG_LAYING },
  transcendence_panel: { tab: 'nest', unlockPhase: Phase.TRANSCENDENCE },
  // WRKR
  worker_assignment: { tab: 'wrkr', unlockPhase: Phase.COLONY },
  food_display: { tab: 'wrkr', unlockPhase: Phase.COLONY },
  automation_panel: { tab: 'wrkr', unlockPhase: Phase.TRANSCENDENCE },
  // BUILD (no buildings in Colony until Stories 3.4/3.5)
  building_panel: { tab: 'build', unlockPhase: Phase.EXPANSION },
  resource_converter_panel: { tab: 'build', unlockPhase: Phase.SPACE },
  research_panel: { tab: 'build', unlockPhase: Phase.SPACE },
  tech_tree_panel: { tab: 'build', unlockPhase: Phase.TRANSCENDENCE },
  // FRONT → WAR
  soldier_panel: { tab: 'front', segment: 'war', unlockPhase: Phase.COMBAT },
  battle_panel: { tab: 'front', segment: 'war', unlockPhase: Phase.COMBAT },
  combat_log: { tab: 'front', segment: 'war', unlockPhase: Phase.COMBAT },
  mutation_panel: { tab: 'front', segment: 'war', unlockPhase: Phase.COMBAT },
  // FRONT → MAP
  map_panel: { tab: 'front', segment: 'map', unlockPhase: Phase.EXPANSION },
  expedition_panel: { tab: 'front', segment: 'map', unlockPhase: Phase.EXPANSION },
  // FRONT → STARS
  spaceship_panel: { tab: 'front', segment: 'stars', unlockPhase: Phase.SPACE },
  exploration_panel: { tab: 'front', segment: 'stars', unlockPhase: Phase.SPACE },
  cosmic_panel: { tab: 'front', segment: 'stars', unlockPhase: Phase.SPACE },
  starmap_panel: { tab: 'front', segment: 'stars', unlockPhase: Phase.SPACE },
  // LOG → LEGACY
  prestige_panel: { tab: 'log', unlockPhase: Phase.TRANSCENDENCE },
  prestige_tree_panel: { tab: 'log', unlockPhase: Phase.TRANSCENDENCE },
} as const satisfies Record<string, PanelPlacement>;

export type PanelId = keyof typeof placements;

/** Panel id → tab, segment?, zone?, unlockPhase. */
export const PANEL_PLACEMENT: Readonly<Record<PanelId, PanelPlacement>> = placements;

const rank = (p: Phase): number => {
  const i = PHASE_ORDER.indexOf(p);
  return i < 0 ? 0 : i;
};

/** True once `current` has reached `unlockPhase` (phases in game order). */
export function isUnlocked(unlockPhase: Phase, current: Phase): boolean {
  return rank(current) >= rank(unlockPhase);
}

/** The tabs shown in a phase, in bar order. */
export function tabsForPhase(phase: Phase): TabId[] {
  return TABS.filter((t) => isUnlocked(t.unlockPhase, phase)).map((t) => t.id);
}

/** Phase 1 has no tab bar: NEST is the whole game. */
export function showsTabBar(phase: Phase): boolean {
  return tabsForPhase(phase).length > 1;
}

/** A tab's segments shown in a phase, in row order (empty for tabs without segments). */
export function segmentsForPhase(tab: TabId, phase: Phase): SegmentId[] {
  return SEGMENTS.filter((s) => s.tab === tab && isUnlocked(s.unlockPhase, phase)).map((s) => s.id);
}

/** The panels active in a phase. */
export function panelsForPhase(phase: Phase): PanelId[] {
  return (Object.keys(PANEL_PLACEMENT) as PanelId[]).filter((id) =>
    isUnlocked(PANEL_PLACEMENT[id].unlockPhase, phase),
  );
}

/** The placement of a panel id, or undefined for an id the registry doesn't know. */
export function placementOf(panelId: string): PanelPlacement | undefined {
  return (PANEL_PLACEMENT as Record<string, PanelPlacement>)[panelId];
}
