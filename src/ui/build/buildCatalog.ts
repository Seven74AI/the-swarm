import type { BuildingType, ConversionId } from '../../state/queries';
import type { ResearchProjectId } from '../../state/GameState';
import { OFFLINE_EFFICIENCY_STEP_POINTS } from '../../data/constants';
import { BUILDING_GLYPHS, type Glyph } from '../glyphs';

/**
 * What BUILD's cards say (Story 1.24, UX-DR17): names, glyphs and effect
 * copy. Numbers never live here; the cards read them from the rules in
 * `state/queries`. Buildings draw their `Glyph<Name>` line glyph (Story 8.2);
 * research, the Particle Lab and the converter are not in the glyph set and
 * keep a typed geometric character.
 */

export interface BuildingCardDef {
  readonly id: BuildingType;
  readonly name: string;
  readonly glyph: Glyph;
}

/** Buildings in card order: the colony's own first, then the combat workshops and the Midden. */
export const BUILDING_CARDS: readonly BuildingCardDef[] = [
  { id: 'warehouse', name: 'WAREHOUSE', glyph: BUILDING_GLYPHS.warehouse },
  { id: 'barracks', name: 'BARRACKS', glyph: BUILDING_GLYPHS.barracks },
  { id: 'walls', name: 'WALLS', glyph: BUILDING_GLYPHS.walls },
  { id: 'tunnels', name: 'TUNNELS', glyph: BUILDING_GLYPHS.tunnels },
  { id: 'fungus_garden', name: 'FUNGUS GARDEN', glyph: BUILDING_GLYPHS.fungus_garden },
  { id: 'silk_weaving', name: 'SILK WEAVING', glyph: BUILDING_GLYPHS.silk_weaving },
  { id: 'chitin_armory', name: 'CHITIN ARMORY', glyph: BUILDING_GLYPHS.chitin_armory },
  { id: 'venom_lab', name: 'VENOM LAB', glyph: BUILDING_GLYPHS.venom_lab },
  { id: 'midden', name: 'MIDDEN', glyph: BUILDING_GLYPHS.midden },
];

export const RESEARCH_GLYPH = '⌕';
/** The Particle Lab's card (Story 3.6). */
export const PARTICLE_LAB_GLYPH = '⊚';

/** What finishing each step of the research chain does. */
export const RESEARCH_EFFECT: Readonly<Record<ResearchProjectId, string>> = {
  voidCrystalSynthesis: 'UNLOCKS THE CONVERTER: STONE + NECTAR → VOID CRYSTALS',
  antimatterContainment: 'UNLOCKS VOID CRYSTALS → ANTIMATTER (NEEDS A PARTICLE LAB)',
  darkMatterDetection: 'UNLOCKS ANTIMATTER → DARK MATTER (NEEDS A SPACE EXPLORATION)',
  dormantForaging: `TIME AWAY COUNTS FOR MORE: OFFLINE EFFICIENCY +${OFFLINE_EFFICIENCY_STEP_POINTS} POINTS UNTIL PRESTIGE`,
};

export const CONVERTER_GLYPH = '⇄';

/** Why a researched conversion still can't run. */
export const CONVERSION_NOT_READY: Readonly<Record<ConversionId, string>> = {
  voidCrystalSynthesis: 'NOT READY',
  antimatterContainment: 'NEEDS A PARTICLE LAB',
  darkMatterDetection: 'NEEDS A SPACE EXPLORATION',
};
