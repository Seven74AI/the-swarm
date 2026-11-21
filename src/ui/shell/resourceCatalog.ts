import { Phase } from '../../phases/phases';

/**
 * The resources the strip and the resource sheet know (Story 1.16; UX-DR7, UX-DR8).
 *
 * One entry per resource: its 4-letter strip label, full name (the accessible
 * name of a strip cell), where it comes from, the phase that unlocks it and its
 * glyph. The glyphs here are typed placeholders (geometric characters, no emoji):
 * Story 8.2 replaces them with the `Glyph<Name>` SVG components.
 */

export type ResourceId =
  | 'eggs'
  | 'larvae'
  | 'workers'
  | 'food'
  | 'wood'
  | 'stone'
  | 'nectar'
  | 'silk'
  | 'chitin'
  | 'venom'
  | 'voidCrystals'
  | 'antimatter'
  | 'darkMatter'
  | 'surveyData';

/** Where the amount lives in the state. */
export type ResourceStore = 'resources' | 'combatResources';

export interface ResourceDef {
  readonly id: ResourceId;
  /** Strip label, at most 4 capital letters. */
  readonly label: string;
  /** Full name: the sheet row and the strip cell's accessible name. */
  readonly name: string;
  /** Placeholder glyph until Story 8.2. */
  readonly glyph: string;
  readonly store: ResourceStore;
  readonly unlockPhase: Phase;
  /** Where it comes from, in the sheet's SOURCE column. */
  readonly source: string;
}

/** The gear of `[ SETTINGS ⚙ ]` (text presentation; Story 8.2 makes it `GlyphGear`). */
export const GEAR_GLYPH = '⚙︎';

export const RESOURCES: readonly ResourceDef[] = [
  { id: 'eggs', label: 'EGG', name: 'Eggs', glyph: '○', store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Laid by the queen' },
  { id: 'larvae', label: 'LRVA', name: 'Larvae', glyph: '∽', store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Hatched from eggs' },
  { id: 'workers', label: 'WRKR', name: 'Workers', glyph: '⌘', store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Matured from larvae' },
  { id: 'food', label: 'FOOD', name: 'Food', glyph: '◊', store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Gathered by workers' },
  { id: 'wood', label: 'WOOD', name: 'Wood', glyph: '▭', store: 'resources', unlockPhase: Phase.COLONY, source: 'Gatherers and forest territory' },
  { id: 'stone', label: 'STON', name: 'Stone', glyph: '△', store: 'resources', unlockPhase: Phase.COLONY, source: 'Diggers and mountain territory' },
  { id: 'nectar', label: 'NECT', name: 'Nectar', glyph: '✺', store: 'resources', unlockPhase: Phase.COLONY, source: 'Foragers and meadow territory' },
  { id: 'silk', label: 'SILK', name: 'Silk', glyph: '≈', store: 'combatResources', unlockPhase: Phase.COMBAT, source: 'Battle loot' },
  { id: 'chitin', label: 'CHTN', name: 'Chitin', glyph: '◈', store: 'combatResources', unlockPhase: Phase.COMBAT, source: 'Battle loot' },
  { id: 'venom', label: 'VNOM', name: 'Venom', glyph: '∇', store: 'combatResources', unlockPhase: Phase.COMBAT, source: 'Battle loot' },
  { id: 'voidCrystals', label: 'VC', name: 'Void crystals', glyph: '◇', store: 'resources', unlockPhase: Phase.SPACE, source: 'Synthesis from stone and nectar' },
  { id: 'antimatter', label: 'ANTM', name: 'Antimatter', glyph: '⊛', store: 'resources', unlockPhase: Phase.SPACE, source: 'Containment of void crystals' },
  { id: 'darkMatter', label: 'DKMT', name: 'Dark matter', glyph: '●', store: 'resources', unlockPhase: Phase.SPACE, source: 'Detection from antimatter' },
  { id: 'surveyData', label: 'SRVY', name: 'Survey data', glyph: '⌖', store: 'resources', unlockPhase: Phase.SPACE, source: 'Space explorations' },
];

export const RESOURCE_BY_ID: Readonly<Record<ResourceId, ResourceDef>> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r]),
) as Record<ResourceId, ResourceDef>;

/**
 * The strip's base set per phase (at most 5). Phases 1 and 2 are the spec's
 * sets; from Phase 3 the strip puts capped or falling resources ahead of these.
 */
export const STRIP_SETS: Readonly<Record<Phase, readonly ResourceId[]>> = {
  [Phase.EGG_LAYING]: ['eggs', 'larvae', 'workers', 'food'],
  [Phase.COLONY]: ['food', 'workers', 'wood', 'stone', 'nectar'],
  [Phase.COMBAT]: ['food', 'workers', 'chitin', 'silk', 'venom'],
  [Phase.EXPANSION]: ['food', 'workers', 'wood', 'stone', 'nectar'],
  [Phase.SPACE]: ['food', 'voidCrystals', 'antimatter', 'darkMatter', 'surveyData'],
  [Phase.TRANSCENDENCE]: ['food', 'voidCrystals', 'antimatter', 'darkMatter', 'surveyData'],
};
