/**
 * The glyph set (Story 8.2, UX-DR35; ADR 0042): line glyphs, one per
 * resource (14) and per building (9), plus the settings gear. The catalogs
 * (`ui/shell/resourceCatalog.ts`, `ui/build/buildCatalog.ts`) point at these;
 * nothing else in src/ draws an icon, and no file may hold an emoji
 * (`tests/arch/noEmoji.test.ts`).
 */
import type { BuildingType } from '../../state/queries';
import type { ResourceId } from '../shell/resourceCatalog';
import type { Glyph } from './Glyph';
import {
  GlyphBarracks,
  GlyphChitinArmory,
  GlyphFungusGarden,
  GlyphMidden,
  GlyphSilkWeaving,
  GlyphTunnels,
  GlyphVenomLab,
  GlyphWalls,
  GlyphWarehouse,
} from './buildings';
import {
  GlyphAntimatter,
  GlyphChitin,
  GlyphDarkMatter,
  GlyphEggs,
  GlyphFood,
  GlyphLarvae,
  GlyphNectar,
  GlyphSilk,
  GlyphStone,
  GlyphSurveyData,
  GlyphVenom,
  GlyphVoidCrystals,
  GlyphWood,
  GlyphWorkers,
} from './resources';

export type { Glyph, GlyphProps } from './Glyph';
export { GlyphGear } from './GlyphGear';
export * from './buildings';
export * from './resources';

export const RESOURCE_GLYPHS: Readonly<Record<ResourceId, Glyph>> = {
  eggs: GlyphEggs,
  larvae: GlyphLarvae,
  workers: GlyphWorkers,
  food: GlyphFood,
  wood: GlyphWood,
  stone: GlyphStone,
  nectar: GlyphNectar,
  silk: GlyphSilk,
  chitin: GlyphChitin,
  venom: GlyphVenom,
  voidCrystals: GlyphVoidCrystals,
  antimatter: GlyphAntimatter,
  darkMatter: GlyphDarkMatter,
  surveyData: GlyphSurveyData,
};

export const BUILDING_GLYPHS: Readonly<Record<BuildingType, Glyph>> = {
  barracks: GlyphBarracks,
  walls: GlyphWalls,
  warehouse: GlyphWarehouse,
  silk_weaving: GlyphSilkWeaving,
  chitin_armory: GlyphChitinArmory,
  venom_lab: GlyphVenomLab,
  tunnels: GlyphTunnels,
  fungus_garden: GlyphFungusGarden,
  midden: GlyphMidden,
};

/** Resources plus buildings: the spec's twenty, plus the three buildings added since (the gear is extra). */
export const GLYPH_COUNT = Object.keys(RESOURCE_GLYPHS).length + Object.keys(BUILDING_GLYPHS).length;
