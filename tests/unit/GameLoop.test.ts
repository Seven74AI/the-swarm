import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ticker } from '../../src/engine/Ticker';
import { GameLoop } from '../../src/engine/GameLoop';
import { createInitialState, type GameState } from '../../src/state/GameState';

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
    it('returns 1.12 for initial egg_laying phase with 0 legacy points', () => {
      const loop = new GameLoop(ticker);
      const state = createInitialState();
      const mult = loop.getProductionMultiplier(state);
      expect(mult).toBeCloseTo(1.12, 4);
    });

    it('increases with phase progression', () => {
      const loop = new GameLoop(ticker);
      const colony: GameState = { ...createInitialState(), phase: 'colony' };
      const combat: GameState = { ...createInitialState(), phase: 'combat' };

      const colonyMult = loop.getProductionMultiplier(colony);
      const combatMult = loop.getProductionMultiplier(combat);

      expect(colonyMult).toBeCloseTo(1.2544, 4); // 1.12^2
      expect(combatMult).toBeCloseTo(1.404928, 4); // 1.12^3
      expect(combatMult).toBeGreaterThan(colonyMult);
    });

    it('increases with legacy points', () => {
      const loop = new GameLoop(ticker);
      const state: GameState = {
        ...createInitialState(),
        prestige: { count: 1, legacyPoints: 3, totalFoodProduced: 100000 },
      };

      // 1.12 * (1 + 3*0.5) = 1.12 * 2.5 = 2.8
      const mult = loop.getProductionMultiplier(state);
      expect(mult).toBeCloseTo(2.8, 4);
    });
  });

  describe('getWorkerEfficiency', () => {
    it('returns 1.0 with 0 workers', () => {
      const loop = new GameLoop(ticker);
      const state = createInitialState();
      expect(loop.getWorkerEfficiency(state)).toBe(1.0);
    });

    it('returns 1.0 at exactly 500 workers', () => {
      const loop = new GameLoop(ticker);
      const state: GameState = {
        ...createInitialState(),
        resources: { ...createInitialState().resources, workers: 500 },
      };
      expect(loop.getWorkerEfficiency(state)).toBe(1.0);
    });

    it('drops below 1.0 above 500 workers', () => {
      const loop = new GameLoop(ticker);
      const state: GameState = {
        ...createInitialState(),
        resources: { ...createInitialState().resources, workers: 750 },
      };
      expect(loop.getWorkerEfficiency(state)).toBeLessThan(1.0);
    });
  });
});
