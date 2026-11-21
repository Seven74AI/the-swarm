import type { BuildingType, ConversionId } from '../../state/queries';
import type { ResearchProjectId } from '../../state/GameState';
import { OFFLINE_EFFICIENCY_STEP_POINTS } from '../../data/constants';

/**
 * What BUILD's cards say (Story 1.24, UX-DR17): names, placeholder glyphs and
 * effect copy. Numbers never live here; the cards read them from the rules in
 * `state/queries`. The glyphs are typed placeholders (geometric characters,
 * no emoji) until Story 8.2 replaces them with the `Glyph<Name>` SVGs.
 */

export interface BuildingCardDef {
  readonly id: BuildingType;
  readonly name: string;
  readonly glyph: string;
}

/** Buildings in card order: the colony's own first, then the combat workshops. */
export const BUILDING_CARDS: readonly BuildingCardDef[] = [
  { id: 'warehouse', name: 'WAREHOUSE', glyph: '⌂' },
  { id: 'barracks', name: 'BARRACKS', glyph: '⊓' },
  { id: 'walls', name: 'WALLS', glyph: '▤' },
  { id: 'silk_weaving', name: 'SILK WEAVING', glyph: '≋' },
  { id: 'chitin_armory', name: 'CHITIN ARMORY', glyph: '⛉' },
  { id: 'venom_lab', name: 'VENOM LAB', glyph: '⚗' },
];

export const RESEARCH_GLYPH = '⌕';

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
