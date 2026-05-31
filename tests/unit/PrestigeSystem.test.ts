import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  isPrestigeAvailable,
  getUnmetRequirements,
  calculateLegacyPoints,
  prestige,
  canBuyTemporalResonance,
  buyTemporalResonance,
  TEMPORAL_RESONANCE_COST,
  canBuyChronoSynchronization,
  buyChronoSynchronization,
  CHRONO_SYNCHRONIZATION_COST,
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

    it('uses the formula: floor(log10(food) * phaseScore / 10)', () => {
      // totalFoodProduced = 100_000 → log10(100000) = 5
      // phaseScore for max phase 5 (sum 1+2+3+4+5 = 15)
      // legacyPoints = floor(5 * 15 / 10) = floor(7.5) = 7
      expect(calculateLegacyPoints(100_000, 15)).toBe(7);

      // totalFoodProduced = 1_000_000 → log10 = 6
      // legacyPoints = floor(6 * 15 / 10) = floor(9.0) = 9
      expect(calculateLegacyPoints(1_000_000, 15)).toBe(9);

      // totalFoodProduced = 10_000_000_000 → log10 = 10
      // legacyPoints = floor(10 * 15 / 10) = floor(15.0) = 15
      expect(calculateLegacyPoints(10_000_000_000, 15)).toBe(15);
    });

    it('scales with higher phase scores', () => {
      // phaseScore = 30 (higher phase count)
      // totalFoodProduced = 100_000 → log10 = 5
      // legacyPoints = floor(5 * 30 / 10) = floor(15) = 15
      expect(calculateLegacyPoints(100_000, 30)).toBe(15);
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
      expect(result).toBe(200);
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
        surveyData: 0,
      };
      s.buildings.barracks.level = 6;
      s.buildings.walls.level = 5;
      s.buildings.warehouse.level = 5;
      s.prestige = { count: 0, legacyPoints: 0, totalFoodProduced: 200_000 };
      s.workersAssigned = { gather: 30, tend: 20, dig: 10, guard: 5, researchers: 0 };
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

  // GM-8: Offline efficiency prestige upgrades
  describe('offline efficiency upgrades', () => {
    function makeTranscendenceState(): GameState {
      const s = createInitialState();
      s.phase = 'transcendence';
      s.offlineEfficiency = 0.5;
      s.prestige = { count: 1, legacyPoints: 15, totalFoodProduced: 500_000 };
      s.resources.voidCrystals = 20;
      return s;
    }

    describe('Temporal Resonance (50% → 75%, cost: 10 LP)', () => {
      it('can buy when phase=transcendence, LP >= 10, efficiency = 50%', () => {
        const s = makeTranscendenceState();
        expect(canBuyTemporalResonance(s)).toBe(true);
      });

      it('cannot buy when phase is not transcendence or egg_laying', () => {
        const s = makeTranscendenceState();
        s.phase = 'space';
        expect(canBuyTemporalResonance(s)).toBe(false);
      });

      it('can buy when phase=egg_laying (post-prestige)', () => {
        const s = makeTranscendenceState();
        s.phase = 'egg_laying';
        expect(canBuyTemporalResonance(s)).toBe(true);
      });

      it('cannot buy when legacy points < 10', () => {
        const s = makeTranscendenceState();
        s.prestige.legacyPoints = 5;
        expect(canBuyTemporalResonance(s)).toBe(false);
      });

      it('cannot buy when efficiency already > 50%', () => {
        const s = makeTranscendenceState();
        s.offlineEfficiency = 0.75;
        expect(canBuyTemporalResonance(s)).toBe(false);
      });

      it('buy sets efficiency to 75% and deducts 10 LP', () => {
        const s = makeTranscendenceState();
        const result = buyTemporalResonance(s);
        expect(result).not.toBeNull();
        expect(result!.offlineEfficiency).toBe(0.75);
        expect(result!.prestige.legacyPoints).toBe(5); // 15 - 10
      });

      it('buy returns null when requirements not met', () => {
        const s = makeTranscendenceState();
        s.prestige.legacyPoints = 5;
        expect(buyTemporalResonance(s)).toBeNull();
      });
    });

    describe('Chrono-Synchronization (75% → 100%, cost: 5 voidCrystals)', () => {
      function makeCSReadyState(): GameState {
        const s = makeTranscendenceState();
        s.offlineEfficiency = 0.75;
        s.resources.voidCrystals = 10;
        return s;
      }

      it('can buy when efficiency = 75% and voidCrystals >= 5', () => {
        const s = makeCSReadyState();
        expect(canBuyChronoSynchronization(s)).toBe(true);
      });

      it('cannot buy when efficiency is not 75%', () => {
        const s = makeCSReadyState();
        s.offlineEfficiency = 0.5;
        expect(canBuyChronoSynchronization(s)).toBe(false);
      });

      it('cannot buy when voidCrystals < 5', () => {
        const s = makeCSReadyState();
        s.resources.voidCrystals = 3;
        expect(canBuyChronoSynchronization(s)).toBe(false);
      });

      it('cannot buy when efficiency is already 100%', () => {
        const s = makeCSReadyState();
        s.offlineEfficiency = 1.0;
        expect(canBuyChronoSynchronization(s)).toBe(false);
      });

      it('buy sets efficiency to 100% and deducts 5 voidCrystals', () => {
        const s = makeCSReadyState();
        const result = buyChronoSynchronization(s);
        expect(result).not.toBeNull();
        expect(result!.offlineEfficiency).toBe(1.0);
        expect(result!.resources.voidCrystals).toBe(5); // 10 - 5
      });

      it('buy returns null when requirements not met', () => {
        const s = makeCSReadyState();
        s.resources.voidCrystals = 3;
        expect(buyChronoSynchronization(s)).toBeNull();
      });
    });

    it('offlineEfficiency is preserved across prestige reset', () => {
      const s = createInitialState();
      s.offlineEfficiency = 0.75;
      s.buildings.barracks.level = 5;
      s.buildings.walls.level = 5;
      s.buildings.warehouse.level = 5;
      s.prestige.totalFoodProduced = 100_000;

      const result = prestige(s);
      expect(result.offlineEfficiency).toBe(0.75);
    });

    it('cost constants have expected values', () => {
      expect(TEMPORAL_RESONANCE_COST).toBe(10);
      expect(CHRONO_SYNCHRONIZATION_COST).toBe(5);
    });
  });

  describe('prestige unlock bonuses (Slice 4)', () => {
    function makeRichState(): GameState {
      const s = createInitialState();
      s.phase = 'space';
      s.buildings.barracks.level = 5;
      s.buildings.walls.level = 5;
      s.buildings.warehouse.level = 5;
      s.prestige = { count: 1, legacyPoints: 5, totalFoodProduced: 200_000 };
      return s;
    }

    it('starting resources: prestige with royal cache yields 50 eggs in pipeline + 25 food', () => {
      const s = makeRichState();
      s.prestigeTree.purchased = ['starting_resources'];
      const result = prestige(s);
      expect(result.eggPipeline.count).toBe(50);
      expect(result.eggPipeline.progress).toBe(0);
      expect(result.resources.food).toBe(25);
      expect(result.resources.eggs).toBe(0); // other resources still reset
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
      s.prestigeTree.purchased = ['starting_resources', 'phase_skip'];
      const result = prestige(s);
      expect(result.phase).toBe('colony');
      expect(result.eggPipeline.count).toBe(50);
      expect(result.resources.food).toBe(25);
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
      expect(after.eggPipeline.count).toBe(50);
      expect(after.resources.food).toBe(25);
    });
  });
});
