import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ticker } from '../../src/engine/Ticker';
import { GameLoop } from '../../src/engine/GameLoop';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { progressionBalance as P } from '../../src/data/balance/progression';

const production = (phaseNumber: number, lp: number): number =>
  P.productionPerPhase ** phaseNumber * (1 + P.productionPerLegacyPoint * lp);

describe('GameLoop', () => {
  let ticker: Ticker;

  beforeEach(() => {
    vi.useFakeTimers();
    ticker = new Ticker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start begins the ticker', () => {
    const loop = new GameLoop(ticker);
    const tickSpy = vi.spyOn(ticker, 'start');

    loop.start();

    expect(tickSpy).toHaveBeenCalled();
  });

  it('stop stops the ticker', () => {
    const loop = new GameLoop(ticker);
    const tickSpy = vi.spyOn(ticker, 'stop');

    loop.start();
    loop.stop();

    expect(tickSpy).toHaveBeenCalled();
  });

  // GM-5: Progression curve integration
  describe('getProductionMultiplier', () => {
    it('returns the phase-1 multiplier for initial egg_laying phase with 0 legacy points', () => {
      const loop = new GameLoop(ticker);
      const state = createInitialState();
      const mult = loop.getProductionMultiplier(state);
      expect(mult).toBeCloseTo(production(1, 0), 4);
    });

    it('increases with phase progression', () => {
      const loop = new GameLoop(ticker);
      const colony: GameState = { ...createInitialState(), phase: 'colony' };
      const combat: GameState = { ...createInitialState(), phase: 'combat' };

      const colonyMult = loop.getProductionMultiplier(colony);
      const combatMult = loop.getProductionMultiplier(combat);

      expect(colonyMult).toBeCloseTo(production(2, 0), 4);
      expect(combatMult).toBeCloseTo(production(3, 0), 4);
      expect(combatMult).toBeGreaterThan(colonyMult);
    });

    it('increases with the legacy points ever earned (Story 5.2)', () => {
      const loop = new GameLoop(ticker);
      const state: GameState = {
        ...createInitialState(),
        prestige: { count: 1, legacyPoints: 0, lifetimeLpEarned: 3, totalFoodProduced: 100000, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 },
      };

      const mult = loop.getProductionMultiplier(state);
      expect(mult).toBeCloseTo(production(1, 3), 4);
    });
  });

  // Story 9.13: the work rate is the crowding multiplier.
  describe('getWorkerEfficiency', () => {
    it('returns 1.0 with 0 workers', () => {
      const loop = new GameLoop(ticker);
      expect(loop.getWorkerEfficiency(createInitialState())).toBe(1.0);
    });

    it('returns 1.0 for thousands of workers that fit their rooms', () => {
      const loop = new GameLoop(ticker);
      const s = createInitialState();
      const state: GameState = { ...s, resources: { ...s.resources, workers: 5_000, nestCapacity: 5_000 } };
      expect(loop.getWorkerEfficiency(state)).toBe(1.0);
    });

    it('drops below 1.0 once the nest is packed past its rooms', () => {
      const loop = new GameLoop(ticker);
      const s = createInitialState();
      const state: GameState = { ...s, resources: { ...s.resources, workers: 100, nestCapacity: 100, eggs: 100 }, eggPipeline: { count: 100, progress: 0 } };
      expect(loop.getWorkerEfficiency(state)).toBeLessThan(1.0);
    });
  });

  // ── Pause / Resume delegation ──
  describe('pause and resume delegation', () => {
    it('pause delegates to ticker.pause()', () => {
      const loop = new GameLoop(ticker);
      const pauseSpy = vi.spyOn(ticker, 'pause');

      loop.pause();
      expect(pauseSpy).toHaveBeenCalled();
    });

    it('resume delegates to ticker.resume()', () => {
      const loop = new GameLoop(ticker);
      const resumeSpy = vi.spyOn(ticker, 'resume');

      loop.resume();
      expect(resumeSpy).toHaveBeenCalled();
    });

    it('isPaused delegates to ticker.isPaused()', () => {
      const loop = new GameLoop(ticker);
      ticker.start();
      ticker.pause();

      expect(loop.isPaused()).toBe(true);
    });
  });
});
