import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  type ResearchType,
  type AutomationBuildingType,
  RESEARCHES,
  AUTOMATION_BUILDINGS,
  canResearch,
  research,
  canBuildAuto,
  buildAuto,
  getAutoEggRate,
  getBuildingEffect,
} from '../../src/systems/AutomationSystem';

/**
 * AutomationSystem tests — behavior-focused, TDD.
 *
 * Covers:
 * - Research definitions (costs, effects, prerequisites)
 * - canResearch gates (resources + prerequisites)
 * - research action (unlock, cost deduction, building unlocks)
 * - Building definitions (costs, levels, effects)
 * - canBuildAuto + buildAuto (gates + level increments)
 * - getAutoEggRate calculation (researches + buildings)
 * - Multiplier stacking (additive base + multiplicative bonuses)
 */
describe('AutomationSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  // ── Research definitions ──

  describe('RESEARCHES', () => {
    it('has at least 5 research tiers', () => {
      expect(Object.keys(RESEARCHES).length).toBeGreaterThanOrEqual(5);
    });

    it('each research has a name and positive cost', () => {
      for (const [id, def] of Object.entries(RESEARCHES)) {
        expect(def.name).toBeTruthy();
        const costTotal = Object.values(def.cost).reduce((a, b) => a + b, 0);
        expect(costTotal).toBeGreaterThan(0);
      }
    });

    it('each research has at least one effect', () => {
      for (const def of Object.values(RESEARCHES)) {
        const effects = Object.values(def.effect).filter(v => v !== undefined && v !== 0);
        expect(effects.length).toBeGreaterThan(0);
      }
    });

    it('"Basic Incubation" is the first research (no prerequisites)', () => {
      const basic = RESEARCHES['basic_incubation'];
      expect(basic).toBeDefined();
      expect(basic.prerequisites).toEqual([]);
    });

    it('higher-tier researches have prerequisites', () => {
      // At least some researches should have prerequisites
      const withPrereqs = Object.values(RESEARCHES).filter(r => (r.prerequisites?.length ?? 0) > 0);
      expect(withPrereqs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── canResearch ──

  describe('canResearch', () => {
    it('returns false when no resources', () => {
      expect(canResearch('basic_incubation', state)).toBe(false);
    });

    it('returns true when enough resources for first research', () => {
      const cost = RESEARCHES['basic_incubation'].cost;
      state.resources.food = cost.food ?? 0;
      state.resources.workers = cost.workers ?? 0;
      expect(canResearch('basic_incubation', state)).toBe(true);
    });

    it('returns false when prerequisite not met', () => {
      const cost = RESEARCHES['thermal_regulation'].cost;
      state.resources.food = cost.food ?? 10000;
      state.resources.stone = cost.stone ?? 10000;
      state.resources.workers = cost.workers ?? 10000;
      // Should fail because prerequisite (queens_pheromones) not researched
      expect(canResearch('thermal_regulation', state)).toBe(false);
    });

    it('returns true when prerequisite IS met and resources sufficient', () => {
      // Unlock queens_pheromones first
      const qpCost = RESEARCHES['queens_pheromones'].cost;
      state.resources.food = qpCost.food ?? 0;
      state.resources.workers = qpCost.workers ?? 0;
      state.autoProduction.researches['queens_pheromones'] = true;

      // Now check thermal_regulation
      const trCost = RESEARCHES['thermal_regulation'].cost;
      state.resources.food += trCost.food ?? 0;
      state.resources.stone = trCost.stone ?? 0;
      state.resources.workers += trCost.workers ?? 0;
      expect(canResearch('thermal_regulation', state)).toBe(true);
    });

    it('returns false for already-researched tech', () => {
      // Unlock it
      const cost = RESEARCHES['basic_incubation'].cost;
      state.resources.food = cost.food ?? 0;
      state.resources.workers = cost.workers ?? 0;
      state.autoProduction.researches['basic_incubation'] = true;

      expect(canResearch('basic_incubation', state)).toBe(false);
    });
  });

  // ── research action ──

  describe('research', () => {
    it('unlocks research and deducts resources', () => {
      const cost = RESEARCHES['basic_incubation'].cost;
      state.resources.food = cost.food ?? 0;
      state.resources.workers = cost.workers ?? 0;

      const result = research('basic_incubation', state);
      expect(result.autoProduction.researches['basic_incubation']).toBe(true);
      expect(result.resources.food).toBeLessThan(state.resources.food);
    });

    it('returns unchanged state if cannot afford', () => {
      const result = research('basic_incubation', state);
      expect(result).toBe(state);
    });

    it('does not deduct below zero', () => {
      const cost = RESEARCHES['basic_incubation'].cost;
      state.resources.food = cost.food ?? 0;
      state.resources.workers = cost.workers ?? 0;

      const result = research('basic_incubation', state);
      expect(result.resources.food).toBeGreaterThanOrEqual(0);
      expect(result.resources.workers).toBeGreaterThanOrEqual(0);
    });

    it('returns unchanged state if prerequisite not met', () => {
      // Try to research thermal_regulation without queens_pheromones
      state.resources.food = 10000;
      state.resources.stone = 10000;
      state.resources.workers = 10000;
      const result = research('thermal_regulation', state);
      expect(result).toBe(state);
    });

    it('returns unchanged state if already researched', () => {
      state.autoProduction.researches['basic_incubation'] = true;
      state.resources.food = 1000;
      state.resources.workers = 1000;
      const result = research('basic_incubation', state);
      expect(result).toBe(state);
    });
  });

  // ── Building definitions ──

  describe('AUTOMATION_BUILDINGS', () => {
    it('has 3 building types (Nursery, Hatchery, Queen\'s Chamber)', () => {
      expect(Object.keys(AUTOMATION_BUILDINGS).length).toBe(3);
    });

    it('each building has a name, maxLevel, and cost', () => {
      for (const [id, def] of Object.entries(AUTOMATION_BUILDINGS)) {
        expect(def.name).toBeTruthy();
        expect(def.maxLevel).toBeGreaterThan(0);
        const costTotal = Object.values(def.baseCost).reduce((a, b) => a + b, 0);
        expect(costTotal).toBeGreaterThan(0);
      }
    });

    it('Nursery has maxLevel 10', () => {
      expect(AUTOMATION_BUILDINGS['nursery'].maxLevel).toBe(10);
    });

    it('Hatchery has maxLevel 5', () => {
      expect(AUTOMATION_BUILDINGS['hatchery'].maxLevel).toBe(5);
    });
  });

  // ── getBuildingEffect ──

  describe('getBuildingEffect', () => {
    it('returns positive effect for level 1', () => {
      for (const id of Object.keys(AUTOMATION_BUILDINGS) as AutomationBuildingType[]) {
        const effect = getBuildingEffect(id, 1);
        const total = Object.values(effect).filter(v => typeof v === 'number').reduce((a: number, b: number) => a + b, 0);
        expect(total).toBeGreaterThan(0);
      }
    });

    it('higher level gives better effect', () => {
      const lv1 = getBuildingEffect('nursery', 1);
      const lv2 = getBuildingEffect('nursery', 2);
      const sum1 = (lv1.autoEggRate ?? 0) + (lv1.multiplier ?? 0) + (lv1.efficiency ?? 0);
      const sum2 = (lv2.autoEggRate ?? 0) + (lv2.multiplier ?? 0) + (lv2.efficiency ?? 0);
      expect(sum2).toBeGreaterThanOrEqual(sum1);
    });
  });

  // ── canBuildAuto / buildAuto ──

  describe('canBuildAuto', () => {
    it('returns false without resources', () => {
      expect(canBuildAuto('nursery', state)).toBe(false);
    });

    it('returns true with enough resources', () => {
      state.resources.wood = 1000;
      state.resources.food = 1000;
      expect(canBuildAuto('nursery', state)).toBe(true);
    });
  });

  describe('buildAuto', () => {
    it('increments building level on success', () => {
      state.resources.wood = 1000;
      state.resources.food = 1000;
      const before = state.autoProduction.buildings['nursery'];
      const result = buildAuto('nursery', state);
      expect(result.autoProduction.buildings['nursery']).toBeGreaterThan(before);
    });

    it('deducts resources on build', () => {
      state.resources.wood = 1000;
      state.resources.food = 1000;
      const result = buildAuto('nursery', state);
      expect(result.resources.wood).toBeLessThan(state.resources.wood);
    });

    it('returns unchanged state if insufficient resources', () => {
      const result = buildAuto('nursery', state);
      expect(result).toBe(state);
    });

    it('cannot exceed maxLevel', () => {
      state.resources.wood = 10000;
      state.resources.food = 10000;
      state.autoProduction.buildings['hatchery'] = 5; // maxLevel for hatchery
      const result = buildAuto('hatchery', state);
      expect(result).toBe(state);
    });
  });

  // ── getAutoEggRate ──

  describe('getAutoEggRate', () => {
    it('returns 0 with no researches or buildings', () => {
      expect(getAutoEggRate(state)).toBe(0);
    });

    it('returns 0.5 after Basic Incubation', () => {
      state.autoProduction.researches['basic_incubation'] = true;
      expect(getAutoEggRate(state)).toBeCloseTo(0.5, 2);
    });

    it('adds research bonuses cumulatively', () => {
      state.autoProduction.researches['basic_incubation'] = true;
      state.autoProduction.researches['queens_pheromones'] = true;
      // 0.5 + 2 = 2.5 eggs/s
      expect(getAutoEggRate(state)).toBeCloseTo(2.5, 2);
    });

    it('applies multiplicative bonus from Genetic Optimization', () => {
      state.autoProduction.researches['basic_incubation'] = true;
      state.autoProduction.researches['queens_pheromones'] = true;
      state.autoProduction.researches['genetic_optimization'] = true;
      // (0.5 + 2) * 1.5 = 3.75
      expect(getAutoEggRate(state)).toBeCloseTo(3.75, 2);
    });

    it('applies building flat bonuses', () => {
      state.autoProduction.researches['basic_incubation'] = true;
      state.autoProduction.buildings['nursery'] = 1;
      // 0.5 + 1 = 1.5 eggs/s
      expect(getAutoEggRate(state)).toBeCloseTo(1.5, 2);
    });

    it('applies Hatchery multiplier correctly', () => {
      state.autoProduction.researches['basic_incubation'] = true;
      state.autoProduction.researches['queens_pheromones'] = true;
      state.autoProduction.buildings['hatchery'] = 1;
      // (0.5 + 2) * 1.2 = 3.0
      expect(getAutoEggRate(state)).toBeCloseTo(3.0, 2);
    });

    it('stacks multiple multipliers multiplicatively', () => {
      state.autoProduction.researches['basic_incubation'] = true;
      state.autoProduction.researches['queens_pheromones'] = true;
      state.autoProduction.researches['genetic_optimization'] = true;
      state.autoProduction.researches['cloning_vats'] = true;
      state.autoProduction.buildings['hatchery'] = 1;
      // (0.5 + 2) * 1.5 * 2 * 1.2 = 2.5 * 3.6 = 9.0
      expect(getAutoEggRate(state)).toBeCloseTo(9.0, 2);
    });

    it('Queen\'s Chamber gives 10% worker efficiency bonus', () => {
      state.autoProduction.buildings['queens_chamber'] = 1;
      state.autoProduction.researches['basic_incubation'] = true;
      // (0.5) * (1 + 0.10) = 0.55
      expect(getAutoEggRate(state)).toBeCloseTo(0.55, 2);
    });
  });
});
