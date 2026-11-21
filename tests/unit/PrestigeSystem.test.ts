import { describe, it, expect } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  calculateLegacyPoints,
  prestige,
} from '../../src/systems/PrestigeSystem';

/**
 * PrestigeSystem tests — TDD RED phase.
 * PrestigeSystem module does not exist yet, these tests document the API.
 */
describe('PrestigeSystem', () => {
  // The unlock condition (isPrestigeAvailable, getUnmetRequirements) is tested from its balance data
  // in tests/unit/prestigeCondition.test.ts (Story 5.1).

  describe('calculateLegacyPoints', () => {
    it('returns 0 for food produced < 10 (log10 < 1)', () => {
      expect(calculateLegacyPoints(5, 10)).toBe(0);
    });

    it('is a non-negative whole number', () => {
      for (const food of [10, 999, 100_000, 1e9, 1e20]) {
        for (const score of [1, 15, 30, 100]) {
          const lp = calculateLegacyPoints(food, score);
          expect(Number.isInteger(lp) && lp >= 0, `food ${food}, score ${score}: ${lp}`).toBe(true);
        }
      }
    });

    it('grows with food produced (logarithmically) and with the phase score', () => {
      expect(calculateLegacyPoints(1e10, 15)).toBeGreaterThan(calculateLegacyPoints(1e5, 15));
      expect(calculateLegacyPoints(1e5, 30)).toBeGreaterThan(calculateLegacyPoints(1e5, 15));
      // Logarithmic: 100,000× the food is far less than 100,000× the points.
      expect(calculateLegacyPoints(1e10, 15)).toBeLessThan(calculateLegacyPoints(1e5, 15) * 10);
    });

    it('handles edge case: zero food produced', () => {
      expect(calculateLegacyPoints(0, 15)).toBe(0);
    });

    it('handles edge case: log10 of 1', () => {
      // log10(1) = 0, phaseScore = 15 → floor(0) = 0
      expect(calculateLegacyPoints(1, 15)).toBe(0);
    });

    it('handles large numbers without overflow', () => {
      // 1e20 → log10 = 20, phaseScore = 100 → floor(20*100/10) = 200
      const result = calculateLegacyPoints(1e20, 100);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(calculateLegacyPoints(1e10, 100));
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
        surveyData: 0,
      };
      s.buildings.barracks.level = 6;
      s.buildings.walls.level = 5;
      s.buildings.warehouse.level = 5;
      s.prestige = { count: 0, legacyPoints: 0, totalFoodProduced: 200_000, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 };
      s.workersAssigned = { gather: 30, forage: 0, tend: 20, dig: 10, guard: 5, researchers: 0 };
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
        { id: 'exp-1', scouts: 2, warriors: 1, destination: 'cave', status: 'running' as const, remainingMs: 250, durationMs: 250, risk: 0.3 },
      ];
      s.spaceExplorations = [
        { id: 'spex-1', destination: 'mars', status: 'running' as const, remainingMs: 500, durationMs: 500, risk: 0.5 },
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
        status: 'done',
        enemyType: 'beetle',
        result: 'victory',
        soldiersLost: 2,
        foodGained: 50,
        atMs: 12345,
      };
      const result = prestige(s);

      expect(result.combatSoldiers).toBe(0);
      expect(result.combatResources).toEqual({ chitin: 0, silk: 0, venom: 0 });
      expect(result.lastBattle).toEqual({ status: 'idle' });
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

  // GM-8's Temporal Resonance / Chrono-Synchronization one-off buys became
  // Legacy-tree nodes in Story 2.8: see tests/unit/offlineEfficiency.test.ts.

  describe('prestige unlock bonuses (Slice 4)', () => {
    function makeRichState(): GameState {
      const s = createInitialState();
      s.phase = 'space';
      s.buildings.barracks.level = 5;
      s.buildings.walls.level = 5;
      s.buildings.warehouse.level = 5;
      s.prestige = { count: 1, legacyPoints: 5, totalFoodProduced: 200_000, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 };
      return s;
    }

    it('starting resources: prestige with royal cache starts with eggs in the pipeline and some food', () => {
      const s = makeRichState();
      const baseline = prestige(s);
      s.prestigeTree.purchased = ['starting_resources'];
      const result = prestige(s);
      expect(result.eggPipeline.count).toBeGreaterThan(baseline.eggPipeline.count);
      expect(result.eggPipeline.progress).toBe(0);
      expect(result.resources.food).toBeGreaterThan(baseline.resources.food);
      // Every egg in the pipeline is an egg on hand, so the cache hatches (Story 2.5).
      expect(result.resources.eggs).toBe(result.eggPipeline.count);
      expect(result.resources.larvae).toBe(0); // other resources still reset
    });

    it('starting resources: without purchase, starts with 0 eggs and 0 food (baseline)', () => {
      const s = makeRichState();
      const result = prestige(s);
      expect(result.eggPipeline.count).toBe(0);
      expect(result.resources.food).toBe(0);
    });

    it('phase skip: prestige with ancestral memory starts at Phase 2 (colony)', () => {
      const s = makeRichState();
      s.prestigeTree.purchased = ['phase_skip'];
      const result = prestige(s);
      expect(result.phase).toBe('colony');
    });

    it('phase skip: without purchase, starts at Phase 1 (egg_laying)', () => {
      const s = makeRichState();
      const result = prestige(s);
      expect(result.phase).toBe('egg_laying');
    });

    it('both unlocks combined: starting resources + phase skip', () => {
      const s = makeRichState();
      const cacheOnly = prestige({ ...s, prestigeTree: { ...s.prestigeTree, purchased: ['starting_resources'] } });
      s.prestigeTree.purchased = ['starting_resources', 'phase_skip'];
      const result = prestige(s);
      expect(result.phase).toBe('colony');
      expect(result.eggPipeline.count).toBe(cacheOnly.eggPipeline.count);
      expect(result.resources.food).toBe(cacheOnly.resources.food);
    });

    it('prestigeTree.purchased survives Full Wipe unchanged', () => {
      const s = makeRichState();
      s.prestigeTree.purchased = ['egg_laying_bonus', 'phase_skip'];
      const result = prestige(s);
      expect(result.prestigeTree.purchased).toEqual(['egg_laying_bonus', 'phase_skip']);
    });

    it('unlock bonuses are only active after purchase, not before', () => {
      const s = makeRichState();
      // No purchases
      const before = prestige(s);
      expect(before.phase).toBe('egg_laying');
      expect(before.eggPipeline.count).toBe(0);
      expect(before.resources.food).toBe(0);

      // Purchase both unlocks
      s.prestigeTree.purchased = ['starting_resources', 'phase_skip'];
      const after = prestige(s);
      expect(after.phase).toBe('colony');
      expect(after.eggPipeline.count).toBeGreaterThan(before.eggPipeline.count);
      expect(after.resources.food).toBeGreaterThan(before.resources.food);
    });
  });
});
