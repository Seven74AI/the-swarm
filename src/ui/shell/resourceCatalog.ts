import { Phase } from '../../phases/phases';
import { GlyphGear, RESOURCE_GLYPHS, type Glyph } from '../glyphs';

/**
 * The resources the strip and the resource sheet know (Story 1.16; UX-DR7, UX-DR8).
 *
 * One entry per resource: its 4-letter strip label, full name (the accessible
 * name of a strip cell), where it comes from, the phase that unlocks it and its
 * glyph: the `Glyph<Name>` line drawing of `ui/glyphs/` (Story 8.2).
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

import type { ResourceTier } from '../../data/content/resourceTiers';

export interface ResourceDef {
  readonly id: ResourceId;
  /** Strip label, at most 4 capital letters. */
  readonly label: string;
  /** Full name: the sheet row and the strip cell's accessible name. */
  readonly name: string;
  /** Its line glyph (decorative: always drawn next to the label or name). */
  readonly glyph: Glyph;
  readonly store: ResourceStore;
  readonly unlockPhase: Phase;
  /** Where it comes from, in the sheet's SOURCE column. */
  readonly source: string;
  /** Its group in the resource sheet (Story 9.10). */
  readonly tier: ResourceTier;
}

/** The gear of `[ SETTINGS gear ]` (Story 8.2). */
export const GEAR_GLYPH: Glyph = GlyphGear;

export const RESOURCES: readonly ResourceDef[] = [
  { id: 'eggs', label: 'EGG', name: 'Eggs', glyph: RESOURCE_GLYPHS.eggs, store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Laid by the queen', tier: 'colony' },
  { id: 'larvae', label: 'LRVA', name: 'Larvae', glyph: RESOURCE_GLYPHS.larvae, store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Hatched from eggs', tier: 'colony' },
  { id: 'workers', label: 'WRKR', name: 'Workers', glyph: RESOURCE_GLYPHS.workers, store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Matured from larvae', tier: 'colony' },
  { id: 'food', label: 'FOOD', name: 'Food', glyph: RESOURCE_GLYPHS.food, store: 'resources', unlockPhase: Phase.EGG_LAYING, source: 'Gathered by workers', tier: 'colony' },
  { id: 'wood', label: 'WOOD', name: 'Wood', glyph: RESOURCE_GLYPHS.wood, store: 'resources', unlockPhase: Phase.COLONY, source: 'Gatherers and forest territory', tier: 'colony' },
  { id: 'stone', label: 'STON', name: 'Stone', glyph: RESOURCE_GLYPHS.stone, store: 'resources', unlockPhase: Phase.COLONY, source: 'Diggers and mountain territory', tier: 'colony' },
  { id: 'nectar', label: 'NECT', name: 'Nectar', glyph: RESOURCE_GLYPHS.nectar, store: 'resources', unlockPhase: Phase.COLONY, source: 'Foragers and meadow territory', tier: 'colony' },
  { id: 'silk', label: 'SILK', name: 'Silk', glyph: RESOURCE_GLYPHS.silk, store: 'combatResources', unlockPhase: Phase.COMBAT, source: 'Battle loot', tier: 'battle' },
  { id: 'chitin', label: 'CHTN', name: 'Chitin', glyph: RESOURCE_GLYPHS.chitin, store: 'combatResources', unlockPhase: Phase.COMBAT, source: 'Battle loot', tier: 'battle' },
  { id: 'venom', label: 'VNOM', name: 'Venom', glyph: RESOURCE_GLYPHS.venom, store: 'combatResources', unlockPhase: Phase.COMBAT, source: 'Battle loot', tier: 'battle' },
  { id: 'voidCrystals', label: 'VC', name: 'Void crystals', glyph: RESOURCE_GLYPHS.voidCrystals, store: 'resources', unlockPhase: Phase.SPACE, source: 'Synthesis from stone and nectar', tier: 'space' },
  { id: 'antimatter', label: 'ANTM', name: 'Antimatter', glyph: RESOURCE_GLYPHS.antimatter, store: 'resources', unlockPhase: Phase.SPACE, source: 'Containment of void crystals', tier: 'space' },
  { id: 'darkMatter', label: 'DKMT', name: 'Dark matter', glyph: RESOURCE_GLYPHS.darkMatter, store: 'resources', unlockPhase: Phase.SPACE, source: 'Detection from antimatter', tier: 'space' },
  { id: 'surveyData', label: 'SRVY', name: 'Survey data', glyph: RESOURCE_GLYPHS.surveyData, store: 'resources', unlockPhase: Phase.SPACE, source: 'Space explorations', tier: 'space' },
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
