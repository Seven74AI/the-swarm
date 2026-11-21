import { describe, it, expect, beforeEach } from 'vitest';
import { Phase } from '../../src/phases/phases';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { canBuild, build, getBuildCost, getEffects, type BuildingType } from '../../src/systems/BuildingSystem';
import { buildingBalance as B } from '../../src/data/balance/buildings';
import { progressionBalance as P } from '../../src/data/balance/progression';

const FULL = P.softCap.fullLevels;

type Stock = 'food' | 'wood' | 'stone' | 'nectar' | 'chitin' | 'silk' | 'venom';
const COMBAT: readonly Stock[] = ['chitin', 'silk', 'venom'];

/**
 * Give the state exactly what the building's next level costs (Story 3.11:
 * tests read prices from the balance, never restate them), one short of
 * `short` when given, and none of `without`.
 */
function fund(state: GameState, building: BuildingType, opts: { short?: Stock; without?: Stock } = {}): void {
  const cost = getBuildCost(building, state.buildings[building].level + 1);
  for (const [k, v] of Object.entries(cost) as [Stock, number][]) {
    const n = k === opts.without ? 0 : k === opts.short ? v - 1 : v;
    if (COMBAT.includes(k)) state.combatResources[k as 'chitin' | 'silk' | 'venom'] = n;
    else state.resources[k as 'food' | 'wood' | 'stone' | 'nectar'] = n;
  }
}

/**
 * BuildingSystem tests — behavior-focused.
 * Tests cost/effect direction, resource deduction, invariants,
 * exponential cost scaling (×2.5), and soft-cap diminishing returns.
 * Added: combat resource building types and combat resource cost checks.
 */
describe('BuildingSystem', () => {
  let state: GameState;

  beforeEach(() => {
    // Expansion: every building is on sale and every resource has a producer (Story 3.5).
    state = { ...createInitialState(), phase: Phase.EXPANSION };
  });

  describe('getBuildCost', () => {
    it('returns positive costs for all building types', () => {
      const types: BuildingType[] = ['barracks', 'walls', 'warehouse', 'silk_weaving', 'chitin_armory', 'venom_lab'];
      for (const type of types) {
        const cost = getBuildCost(type, 1);
        expect(cost.food + cost.wood + cost.stone + cost.nectar + cost.chitin + cost.silk + cost.venom).toBeGreaterThan(0);
      }
    });

    it('higher levels cost more', () => {
      const lv1 = getBuildCost('barracks', 1);
      const lv2 = getBuildCost('barracks', 2);
      expect(lv2.food).toBeGreaterThan(lv1.food);
    });

    it('every cost at every level is a non-negative whole number, and never falls level to level', () => {
      const types: BuildingType[] = ['barracks', 'walls', 'warehouse', 'silk_weaving', 'chitin_armory', 'venom_lab'];
      for (const type of types) {
        let prev = getBuildCost(type, 1);
        for (let level = 1; level <= 10; level++) {
          const cost = getBuildCost(type, level);
          for (const [res, n] of Object.entries(cost)) {
            expect(Number.isInteger(n) && n >= 0, `${type} Lv.${level} ${res}: ${n}`).toBe(true);
            expect(n, `${type} Lv.${level} ${res}`).toBeGreaterThanOrEqual(prev[res as keyof typeof prev]);
          }
          prev = cost;
        }
      }
    });

    it('costs grow by a steady factor from level to level (exponential, GM-5)', () => {
      const lv1 = getBuildCost('barracks', 1).food;
      const lv2 = getBuildCost('barracks', 2).food;
      const lv3 = getBuildCost('barracks', 3).food;
      expect(lv2 / lv1).toBeGreaterThan(1);
      // The same factor each step, up to Math.floor's rounding.
      expect(lv3 / lv2).toBeCloseTo(lv2 / lv1, 1);
    });

    it('cost grows much faster than linear', () => {
      const lv1 = getBuildCost('walls', 1).stone; // 200 * 2.5 = 500
      const lv5 = getBuildCost('walls', 5).stone; // 200 * 2.5^5 = 19531
      expect(lv5).toBeGreaterThan(lv1 * 10); // exponential >> linear
    });

    it('barracks also costs wood, and warehouse wood and stone', () => {
      expect(getBuildCost('barracks', 1).wood).toBeGreaterThan(0);
      expect(getBuildCost('warehouse', 1).wood).toBeGreaterThan(0);
      expect(getBuildCost('warehouse', 1).stone).toBeGreaterThan(0);
    });

    it('silk_weaving costs silk and wood only', () => {
      const cost = getBuildCost('silk_weaving', 1);
      expect(cost.silk).toBeGreaterThan(0);
      expect(cost.wood).toBeGreaterThan(0);
      expect(cost.food).toBe(0);
      expect(cost.stone).toBe(0);
    });

    it('chitin_armory costs chitin and stone only', () => {
      const cost = getBuildCost('chitin_armory', 1);
      expect(cost.chitin).toBeGreaterThan(0);
      expect(cost.stone).toBeGreaterThan(0);
      expect(cost.food).toBe(0);
      expect(cost.wood).toBe(0);
    });

    it('venom_lab costs venom and nectar only', () => {
      const cost = getBuildCost('venom_lab', 1);
      expect(cost.venom).toBeGreaterThan(0);
      expect(cost.nectar).toBeGreaterThan(0);
      expect(cost.food).toBe(0);
      expect(cost.wood).toBe(0);
    });

    // Combat resource costs added at Lv.5+ for original buildings
    describe('advanced combat resource costs (Lv.5+)', () => {
      it('barracks Lv.4 has no chitin cost', () => {
        const cost = getBuildCost('barracks', 4);
        expect(cost.chitin).toBe(0);
      });

      it('barracks Lv.5 requires chitin', () => {
        const cost = getBuildCost('barracks', 5);
        expect(cost.chitin).toBeGreaterThan(0);
      });

      it('barracks chitin cost scales with level (Lv.6 > Lv.5)', () => {
        const lv5 = getBuildCost('barracks', 5);
        const lv6 = getBuildCost('barracks', 6);
        expect(lv6.chitin).toBeGreaterThan(lv5.chitin);
      });

      it('walls Lv.4 has no silk cost', () => {
        const cost = getBuildCost('walls', 4);
        expect(cost.silk).toBe(0);
      });

      it('walls Lv.5 requires silk', () => {
        const cost = getBuildCost('walls', 5);
        expect(cost.silk).toBeGreaterThan(0);
      });

      it('walls silk cost scales with level (Lv.6 > Lv.5)', () => {
        const lv5 = getBuildCost('walls', 5);
        const lv6 = getBuildCost('walls', 6);
        expect(lv6.silk).toBeGreaterThan(lv5.silk);
      });

      it('warehouse Lv.4 has no silk or chitin cost', () => {
        const cost = getBuildCost('warehouse', 4);
        expect(cost.silk).toBe(0);
        expect(cost.chitin).toBe(0);
      });

      it('warehouse Lv.5 requires silk and chitin', () => {
        const cost = getBuildCost('warehouse', 5);
        expect(cost.silk).toBeGreaterThan(0);
        expect(cost.chitin).toBeGreaterThan(0);
      });

      it('warehouse silk and chitin costs scale with level', () => {
        const lv5 = getBuildCost('warehouse', 5);
        const lv6 = getBuildCost('warehouse', 6);
        expect(lv6.silk).toBeGreaterThan(lv5.silk);
        expect(lv6.chitin).toBeGreaterThan(lv5.chitin);
      });

      it('combat resource costs do not replace standard costs', () => {
        const lv5 = getBuildCost('barracks', 5);
        expect(lv5.food).toBeGreaterThan(0);
        expect(lv5.wood).toBeGreaterThan(0);
      });
    });
  });

  describe('canBuild', () => {
    it('cannot build without resources', () => {
      expect(canBuild('barracks', state)).toBe(false);
    });

    it('can build with enough resources', () => {
      fund(state, 'barracks');
      expect(canBuild('barracks', state)).toBe(true);
    });

    it('cannot build if resources barely insufficient', () => {
      fund(state, 'barracks', { short: 'wood' });
      expect(canBuild('barracks', state)).toBe(false);
    });

    it('can build a high level once its (larger) price is covered', () => {
      state.buildings.barracks.level = 3;
      fund(state, 'barracks');
      expect(canBuild('barracks', state)).toBe(true);
    });

    it('cannot build silk_weaving without silk', () => {
      fund(state, 'silk_weaving', { without: 'silk' });
      expect(canBuild('silk_weaving', state)).toBe(false);
    });

    it('can build silk_weaving with enough silk and wood', () => {
      fund(state, 'silk_weaving');
      expect(canBuild('silk_weaving', state)).toBe(true);
    });

    it('cannot build chitin_armory without chitin', () => {
      fund(state, 'chitin_armory', { without: 'chitin' });
      expect(canBuild('chitin_armory', state)).toBe(false);
    });

    it('can build chitin_armory with enough chitin and stone', () => {
      fund(state, 'chitin_armory');
      expect(canBuild('chitin_armory', state)).toBe(true);
    });

    it('cannot build venom_lab without venom', () => {
      fund(state, 'venom_lab', { without: 'venom' });
      expect(canBuild('venom_lab', state)).toBe(false);
    });

    it('can build venom_lab with enough venom and nectar', () => {
      fund(state, 'venom_lab');
      expect(canBuild('venom_lab', state)).toBe(true);
    });

    it('cannot build barracks Lv.5 without chitin', () => {
      state.buildings.barracks.level = 4;
      fund(state, 'barracks', { without: 'chitin' });
      expect(canBuild('barracks', state)).toBe(false);
    });

    it('can build barracks Lv.5 with chitin and base resources', () => {
      state.buildings.barracks.level = 4;
      fund(state, 'barracks');
      expect(canBuild('barracks', state)).toBe(true);
    });

    it('cannot build walls Lv.5 without silk', () => {
      state.buildings.walls.level = 4;
      fund(state, 'walls', { without: 'silk' });
      expect(canBuild('walls', state)).toBe(false);
    });

    it('can build walls Lv.5 with silk and stone', () => {
      state.buildings.walls.level = 4;
      fund(state, 'walls');
      expect(canBuild('walls', state)).toBe(true);
    });

    it('cannot build warehouse Lv.5 without silk and chitin', () => {
      state.buildings.warehouse.level = 4;
      fund(state, 'warehouse', { without: 'chitin' });
      expect(canBuild('warehouse', state)).toBe(false);
    });

    it('can build warehouse Lv.5 with both silk and chitin', () => {
      state.buildings.warehouse.level = 4;
      fund(state, 'warehouse');
      expect(canBuild('warehouse', state)).toBe(true);
    });
  });

  describe('build', () => {
    it('increments building level on success', () => {
      fund(state, 'barracks');
      const before = state.buildings.barracks.level;
      const result = build('barracks', state);
      expect(result.buildings.barracks.level).toBeGreaterThan(before);
    });

    it('deducts resources on build', () => {
      fund(state, 'barracks');
      const result = build('barracks', state);
      expect(result.resources.food).toBeLessThan(state.resources.food);
    });

    it('returns unchanged state if insufficient resources', () => {
      const result = build('barracks', state);
      expect(result).toBe(state);
    });

    it('never deducts below zero', () => {
      fund(state, 'barracks');
      const result = build('barracks', state);
      expect(result.resources.food).toBeGreaterThanOrEqual(0);
      expect(result.resources.wood).toBeGreaterThanOrEqual(0);
      expect(result.resources.stone).toBeGreaterThanOrEqual(0);
      expect(result.resources.nectar).toBeGreaterThanOrEqual(0);
    });

    it('deducts silk when building silk_weaving', () => {
      fund(state, 'silk_weaving');
      const result = build('silk_weaving', state);
      expect(result.combatResources.silk).toBeLessThan(state.combatResources.silk);
      expect(result.buildings.silk_weaving.level).toBeGreaterThan(state.buildings.silk_weaving.level);
    });

    it('deducts chitin when building chitin_armory', () => {
      fund(state, 'chitin_armory');
      const result = build('chitin_armory', state);
      expect(result.combatResources.chitin).toBeLessThan(state.combatResources.chitin);
      expect(result.buildings.chitin_armory.level).toBeGreaterThan(state.buildings.chitin_armory.level);
    });

    it('deducts venom when building venom_lab', () => {
      fund(state, 'venom_lab');
      const result = build('venom_lab', state);
      expect(result.combatResources.venom).toBeLessThan(state.combatResources.venom);
      expect(result.buildings.venom_lab.level).toBeGreaterThan(state.buildings.venom_lab.level);
    });

    it('returns unchanged state if insufficient combat resources', () => {
      state.resources.wood = 1000;
      state.combatResources.silk = 0;
      const result = build('silk_weaving', state);
      expect(result).toBe(state);
    });
  });

  describe('getEffects', () => {
    it('returns positive effects for each building', () => {
      const types: BuildingType[] = ['barracks', 'walls', 'warehouse', 'silk_weaving', 'chitin_armory'];
      for (const type of types) {
        const effects = getEffects(type, 1);
        const total = Object.values(effects).reduce((a, b) => a + b, 0);
        expect(total).toBeGreaterThan(0);
      }
    });

    it('higher level gives better effects', () => {
      const lv1 = getEffects('barracks', 1);
      const lv2 = getEffects('barracks', 2);
      const sum1 = Object.values(lv1).reduce((a, b) => a + b, 0);
      const sum2 = Object.values(lv2).reduce((a, b) => a + b, 0);
      // Level 2 should not be worse than level 1
      expect(sum2).toBeGreaterThanOrEqual(sum1);
    });

    it('level 0 gives zero or minimal effects', () => {
      const effects = getEffects('barracks', 0);
      const total = Object.values(effects).reduce((a, b) => a + b, 0);
      // Level 0 should not give substantial bonuses
      expect(total).toBeLessThanOrEqual(0);
    });

    it('silk_weaving level 1 unlocks armor', () => {
      const effects = getEffects('silk_weaving', 1);
      expect(effects.armorUnlocked).toBe(1);
    });

    it('silk_weaving level 0 does not unlock armor', () => {
      const effects = getEffects('silk_weaving', 0);
      expect(effects.armorUnlocked).toBe(0);
    });

    it('chitin_armory level 1 unlocks weapon', () => {
      const effects = getEffects('chitin_armory', 1);
      expect(effects.weaponUnlocked).toBe(1);
    });

    it('chitin_armory level 0 does not unlock weapon', () => {
      const effects = getEffects('chitin_armory', 0);
      expect(effects.weaponUnlocked).toBe(0);
    });

    // GM-5: Soft cap diminishing returns after level 5
    it('applies diminishing returns past the soft cap (walls defense)', () => {
      // At the soft-cap level: the raw effect
      const lv5 = getEffects('walls', FULL);
      expect(lv5.defenseBonus).toBeCloseTo(FULL * B.wallsDefensePerLevel, 4);

      // One past it: less than raw
      const lv6 = getEffects('walls', FULL + 1);
      expect(lv6.defenseBonus).toBeLessThan((FULL + 1) * B.wallsDefensePerLevel);
      // Should still be >= level 5 (monotonic)
      expect(lv6.defenseBonus).toBeGreaterThanOrEqual(lv5.defenseBonus);
    });

    it('applies diminishing returns after level 5 (warehouse capacity)', () => {
      // Level 10 warehouse: raw = 10*25 = 250, cap = 250/(1+0.08*5) = 250/1.40 = 178.571
      const lv10 = getEffects('warehouse', 10);
      expect(lv10.nestCapacity).toBeGreaterThan(0);
      expect(lv10.nestCapacity).toBeLessThan(250); // less than raw
    });

    it('soft cap ensures monotonic increase even with diminishing returns', () => {
      const effects = [5, 6, 7, 8, 9, 10].map(l => getEffects('walls', l).defenseBonus);
      for (let i = 1; i < effects.length; i++) {
        expect(effects[i]).toBeGreaterThanOrEqual(effects[i - 1]);
      }
    });
  });
});
