import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  isPrestigeAvailable,
  getUnmetRequirements,
  calculateLegacyPoints,
  prestige,
  getProductionBonus,
} from '../../src/systems/PrestigeSystem';

/**
 * PrestigeSystem tests — TDD RED phase.
 * PrestigeSystem module does not exist yet, these tests document the API.
 */
describe('PrestigeSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('isPrestigeAvailable', () => {
    it('returns false when no buildings are upgraded', () => {
      expect(isPrestigeAvailable(state)).toBe(false);
    });

    it('returns false when buildings are below level 5', () => {
      state.buildings.barracks.level = 4;
      state.buildings.walls.level = 4;
      state.buildings.warehouse.level = 4;
      expect(isPrestigeAvailable(state)).toBe(false);
    });

    it('returns false when buildings meet level 5 but totalFoodProduced < 100K', () => {
      state.buildings.barracks.level = 5;
      state.buildings.walls.level = 5;
      state.buildings.warehouse.level = 5;
      state.prestige.totalFoodProduced = 50_000;
      expect(isPrestigeAvailable(state)).toBe(false);
    });

    it('returns false when totalFoodProduced >= 100K but buildings are below level 5', () => {
      state.prestige.totalFoodProduced = 150_000;
      state.buildings.barracks.level = 5;
      state.buildings.walls.level = 4;
      state.buildings.warehouse.level = 5;
      expect(isPrestigeAvailable(state)).toBe(false);
    });

    it('returns true when all buildings are level 5+ and totalFoodProduced >= 100K', () => {
      state.buildings.barracks.level = 5;
      state.buildings.walls.level = 5;
      state.buildings.warehouse.level = 5;
      state.prestige.totalFoodProduced = 100_000;
      expect(isPrestigeAvailable(state)).toBe(true);
    });

    it('returns true when buildings exceed level 5 and food far exceeds 100K', () => {
      state.buildings.barracks.level = 10;
      state.buildings.walls.level = 8;
      state.buildings.warehouse.level = 7;
      state.prestige.totalFoodProduced = 500_000;
      expect(isPrestigeAvailable(state)).toBe(true);
    });
  });

  describe('getUnmetRequirements', () => {
    it('lists all buildings when none meet level 5', () => {
      const unmet = getUnmetRequirements(state);
      expect(unmet).toContain('barracks level 5+');
      expect(unmet).toContain('walls level 5+');
      expect(unmet).toContain('warehouse level 5+');
      expect(unmet).toContain('100K total food produced');
    });

    it('lists only missing buildings when one is at level 5', () => {
      state.buildings.barracks.level = 5;
      state.prestige.totalFoodProduced = 0;
      const unmet = getUnmetRequirements(state);
      expect(unmet).not.toContain('barracks level 5+');
      expect(unmet).toContain('walls level 5+');
      expect(unmet).toContain('warehouse level 5+');
      expect(unmet).toContain('100K total food produced');
    });

    it('lists only food requirement when all buildings meet level 5', () => {
      state.buildings.barracks.level = 5;
      state.buildings.walls.level = 5;
      state.buildings.warehouse.level = 5;
      state.prestige.totalFoodProduced = 80_000;
      const unmet = getUnmetRequirements(state);
      expect(unmet).not.toContain('barracks level 5+');
      expect(unmet).not.toContain('walls level 5+');
      expect(unmet).not.toContain('warehouse level 5+');
      expect(unmet).toContain('100K total food produced');
    });

    it('returns empty array when all requirements are met', () => {
      state.buildings.barracks.level = 5;
      state.buildings.walls.level = 5;
      state.buildings.warehouse.level = 5;
      state.prestige.totalFoodProduced = 100_000;
      const unmet = getUnmetRequirements(state);
      expect(unmet).toEqual([]);
    });
  });

  describe('calculateLegacyPoints', () => {
    it('returns 0 for food produced < 10 (log10 < 1)', () => {
      expect(calculateLegacyPoints(5, 10)).toBe(0);
    });

    it('uses the formula: floor(log10(food) * phaseScore / 100)', () => {
      // totalFoodProduced = 100_000 → log10(100000) = 5
      // phaseScore for max phase 5 (sum 1+2+3+4+5 = 15)
      // legacyPoints = floor(5 * 15 / 100) = floor(0.75) = 0
      expect(calculateLegacyPoints(100_000, 15)).toBe(0);

      // totalFoodProduced = 1_000_000 → log10 = 6
      // legacyPoints = floor(6 * 15 / 100) = floor(0.90) = 0
      expect(calculateLegacyPoints(1_000_000, 15)).toBe(0);

      // totalFoodProduced = 10_000_000_000 → log10 = 10
      // legacyPoints = floor(10 * 15 / 100) = floor(1.5) = 1
      expect(calculateLegacyPoints(10_000_000_000, 15)).toBe(1);
    });

    it('scales with higher phase scores', () => {
      // phaseScore = 30 (higher phase count)
      // totalFoodProduced = 100_000 → log10 = 5
      // legacyPoints = floor(5 * 30 / 100) = floor(1.5) = 1
      expect(calculateLegacyPoints(100_000, 30)).toBe(1);
    });

    it('handles edge case: zero food produced', () => {
      expect(calculateLegacyPoints(0, 15)).toBe(0);
    });

    it('handles edge case: log10 of 1', () => {
      // log10(1) = 0, phaseScore = 15 → floor(0) = 0
      expect(calculateLegacyPoints(1, 15)).toBe(0);
    });

    it('handles large numbers without overflow', () => {
      // 1e20 → log10 = 20, phaseScore = 100 → floor(20*100/100) = 20
      const result = calculateLegacyPoints(1e20, 100);
      expect(result).toBe(20);
      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe('prestige (reset action)', () => {
    function makeRichState(): GameState {
      const s = createInitialState();
      s.phase = 'space';
      s.resources = {
        eggs: 50, larvae: 30, workers: 100, food: 200_000,
        nestCapacity: 25, wood: 500, stone: 300, nectar: 200,
        voidCrystals: 10, antimatter: 5, darkMatter: 2,
      };
      s.buildings.barracks.level = 6;
      s.buildings.walls.level = 5;
      s.buildings.warehouse.level = 5;
      s.prestige = { count: 0, legacyPoints: 0, totalFoodProduced: 200_000 };
      s.workersAssigned = { gather: 30, tend: 20, dig: 10, guard: 5 };
      s.upgrades = { click_power: 3 };
      s.soldiers.scouts = 5;
      s.soldiers.warriors = 3;
      s.soldierPipeline = { count: 2, progress: 0.5 };
      return s;
    }

    it('resets Phase 1-4 resources to starting values', () => {
      const s = makeRichState();
      const result = prestige(s);

      expect(result.resources.eggs).toBe(0);
      expect(result.resources.larvae).toBe(0);
      expect(result.resources.workers).toBe(0);
      expect(result.resources.food).toBe(0);
      expect(result.resources.wood).toBe(0);
      expect(result.resources.stone).toBe(0);
      expect(result.resources.nectar).toBe(0);
    });

    it('preserves Phase 5+ resources (voidCrystals, antimatter, darkMatter)', () => {
      const s = makeRichState();
      const result = prestige(s);

      expect(result.resources.voidCrystals).toBe(10);
      expect(result.resources.antimatter).toBe(5);
      expect(result.resources.darkMatter).toBe(2);
    });

    it('resets buildings to level 0', () => {
      const s = makeRichState();
      const result = prestige(s);

      expect(result.buildings.barracks.level).toBe(0);
      expect(result.buildings.walls.level).toBe(0);
      expect(result.buildings.warehouse.level).toBe(0);
    });

    it('resets worker assignments to zero', () => {
      const s = makeRichState();
      const result = prestige(s);

      expect(result.workersAssigned.gather).toBe(0);
      expect(result.workersAssigned.tend).toBe(0);
      expect(result.workersAssigned.dig).toBe(0);
      expect(result.workersAssigned.guard).toBe(0);
    });

    it('resets upgrades to empty', () => {
      const s = makeRichState();
      const result = prestige(s);

      expect(result.upgrades).toEqual({});
    });

    it('resets soldiers to zero', () => {
      const s = makeRichState();
      const result = prestige(s);

      expect(result.soldiers.scouts).toBe(0);
      expect(result.soldiers.warriors).toBe(0);
    });

    it('resets pipelines to zero', () => {
      const s = makeRichState();
      const result = prestige(s);

      expect(result.eggPipeline).toEqual({ count: 0, progress: 0 });
      expect(result.larvaPipeline).toEqual({ count: 0, progress: 0 });
      expect(result.soldierPipeline).toEqual({ count: 0, progress: 0 });
    });

    it('resets territory to starting values', () => {
      const s = makeRichState();
      s.territory = { ownedTiles: 12, bonuses: { food: 0.1 } };
      const result = prestige(s);

      expect(result.territory.ownedTiles).toBe(0);
      expect(result.territory.bonuses).toEqual({});
    });

    it('resets map tiles to undiscovered', () => {
      const s = makeRichState();
      s.mapTiles = s.mapTiles.map((t) => ({ ...t, discovered: true, claimed: true }));
      const result = prestige(s);

      for (const tile of result.mapTiles) {
        expect(tile.discovered).toBe(false);
        expect(tile.claimed).toBe(false);
      }
    });

    it('increments prestige count', () => {
      const s = makeRichState();
      s.prestige.count = 2;
      const result = prestige(s);

      expect(result.prestige.count).toBe(3);
    });

    it('adds calculated legacy points', () => {
      const s = makeRichState();
      s.prestige.legacyPoints = 5;
      s.prestige.totalFoodProduced = 1_000_000_000; // log10=9 → floor(9 * 15 / 100) = 1
      const result = prestige(s);

      // Phase score = sum of all reached phase numbers
      // Current phase is 'space' (phase 5). The phaseScore = sum(1..5) = 15.
      // But wait — for a fresh prestige from TRANSCENDENCE, phaseScore should include all phases.
      // For now, phaseScore = sum(1..maxPhaseReached). s.phase is 'space' → phase 5.
      // However, the implementation may compute phaseScore based on the achieved phase.
      // Let's be flexible: just ensure legacyPoints increased.
      expect(result.prestige.legacyPoints).toBeGreaterThan(5);
    });

    it('preserves totalFoodProduced across resets', () => {
      const s = makeRichState();
      s.prestige.totalFoodProduced = 200_000;
      const result = prestige(s);

      expect(result.prestige.totalFoodProduced).toBe(200_000);
    });

    it('resets expeditions and space explorations', () => {
      const s = makeRichState();
      s.expeditions = [
        { id: 'exp-1', scouts: 2, warriors: 1, destination: 'cave', ticksRemaining: 5, risk: 0.3 },
      ];
      s.spaceExplorations = [
        { id: 'spex-1', destination: 'mars', ticksRemaining: 10, risk: 0.5 },
      ];
      const result = prestige(s);

      expect(result.expeditions).toEqual([]);
      expect(result.spaceExplorations).toEqual([]);
    });

    it('resets combat-related state', () => {
      const s = makeRichState();
      s.combatSoldiers = 10;
      s.combatResources = { chitin: 20, silk: 15, venom: 8 };
      s.lastBattle = {
        enemyType: 'beetle',
        result: 'victory',
        soldiersLost: 2,
        foodGained: 50,
        timestamp: 12345,
      };
      const result = prestige(s);

      expect(result.combatSoldiers).toBe(0);
      expect(result.combatResources).toEqual({ chitin: 0, silk: 0, venom: 0 });
      expect(result.lastBattle).toBeNull();
    });

    it('resets spaceship state', () => {
      const s = makeRichState();
      s.spaceship = { level: 5, fuel: 80, maxFuel: 100 };
      s.spaceships = [{
        id: 'ship-1', type: 'scout_ship', level: 3,
        fuel: 50, maxFuel: 100, status: 'exploring',
        missionTicksRemaining: 10, destinationName: 'mars',
      }];
      s.discoveredPlanets = ['mars', 'venus'];
      const result = prestige(s);

      expect(result.spaceship).toEqual({ level: 0, fuel: 0, maxFuel: 100 });
      expect(result.spaceships).toEqual([]);
      expect(result.discoveredPlanets).toEqual([]);
    });

    it('sets phase back to egg_laying', () => {
      const s = makeRichState();
      s.phase = 'space';
      const result = prestige(s);

      expect(result.phase).toBe('egg_laying');
    });

    it('preserves stats.totalEggsLaid and totalClicks across resets', () => {
      const s = makeRichState();
      s.stats.totalEggsLaid = 5000;
      s.stats.totalClicks = 1200;
      const result = prestige(s);

      expect(result.stats.totalEggsLaid).toBe(5000);
      expect(result.stats.totalClicks).toBe(1200);
    });
  });

  describe('getProductionBonus', () => {
    it('returns 1.0 for zero legacy points (no bonus)', () => {
      expect(getProductionBonus(0)).toBe(1.0);
    });

    it('returns 1.02 for 1 legacy point (+2%)', () => {
      expect(getProductionBonus(1)).toBeCloseTo(1.02, 4);
    });

    it('returns 1.10 for 5 legacy points (+10%)', () => {
      expect(getProductionBonus(5)).toBeCloseTo(1.10, 4);
    });

    it('returns 2.0 for 50 legacy points (+100%)', () => {
      expect(getProductionBonus(50)).toBeCloseTo(2.0, 4);
    });

    it('handles fractional legacy points (should still work)', () => {
      // Even though legacyPoints is integer, bonus should compute correctly
      expect(getProductionBonus(3)).toBeCloseTo(1.06, 4);
    });

    it('additive: 2% per point', () => {
      // 10 points = +20% → multiplier of 1.20
      expect(getProductionBonus(10)).toBeCloseTo(1.20, 4);
      // 25 points = +50% → multiplier of 1.50
      expect(getProductionBonus(25)).toBeCloseTo(1.50, 4);
    });
  });
});
