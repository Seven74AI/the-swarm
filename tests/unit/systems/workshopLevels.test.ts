import { describe, expect, it } from 'vitest';
import { canBuild, getEffects, isBuildingOpen, type BuildingType } from '../../../src/systems/BuildingSystem';
import { BUILDING_MAX_LEVEL } from '../../../src/data/content/buildings';
import { isItemAffordable } from '../../../src/systems/NextAction';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';

/**
 * Story 4.8: a level that changes nothing is not a choice. Silk Weaving and
 * the Chitin Armory only open their equipment, so they stop at the level that
 * does it, and BUILD stops selling them there.
 */

const LOTS = 1e12;
const rich = (b: BuildingType, level: number): GameState =>
  makeState({
    phase: 'combat',
    resources: { food: LOTS, wood: LOTS, stone: LOTS, nectar: LOTS },
    combatResources: { chitin: LOTS, silk: LOTS, venom: LOTS },
    buildings: { [b]: { level } },
  });

describe('workshops stop at the level that opens their equipment (Story 4.8)', () => {
  for (const [b, max] of Object.entries(BUILDING_MAX_LEVEL) as [BuildingType, number][]) {
    it(`${b} changes nothing past Lv.${max}, and is not sold there`, () => {
      expect(getEffects(b, max + 1)).toEqual(getEffects(b, max));
      expect(canBuild(b, rich(b, max - 1))).toBe(true);
      expect(isBuildingOpen(b, rich(b, max))).toBe(false);
      expect(canBuild(b, rich(b, max))).toBe(false);
      expect(isItemAffordable(rich(b, max), { kind: 'building', id: b })).toBe(false);
    });
  }

  it('covers both workshops', () => {
    expect(Object.keys(BUILDING_MAX_LEVEL).sort()).toEqual(['chitin_armory', 'silk_weaving']);
  });
});
