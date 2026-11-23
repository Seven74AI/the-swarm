/**
 * Story 9.11 (FR66, UX-DR50): the resource sheet's first line, the worst
 * current state, first match wins.
 */
import { describe, expect, it } from 'vitest';
import { getVerdict, verdictText } from '../../../src/systems/Verdict';
import { VERDICT_ORDER } from '../../../src/data/content/verdicts';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { EventBus } from '../../../src/engine/EventBus';
import { netFoodPerSec } from '../../../src/systems/Workforce';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';
import type { GameState } from '../../../src/state/GameState';

const colony = (over: Parameters<typeof makeState>[0] = {}) => makeState({ phase: Phase.COLONY, ...over });
/** Food falling: tenders eat and nobody gathers. */
const hungry = (food: number) => colony({ resources: { workers: 20, food, nestCapacity: 100, eggs: 0, larvae: 0 }, workersAssigned: { tend: 20 } });
/** A full nest with larvae waiting, fed. */
const full = () => colony({ resources: { workers: 30, nestCapacity: 30, food: 1_000_000, larvae: 7 }, larvaPipeline: { count: 7, progress: 0 }, workersAssigned: { gather: 30 } });

describe('getVerdict', () => {
  it('keeps its order in content: food first, then the nest, then all is well', () => {
    expect(VERDICT_ORDER).toEqual(['food', 'nest', 'growing']);
  });

  it('says food is falling, with its runway, before anything else', () => {
    const s = { ...hungry(500), resources: { ...hungry(500).resources, nestCapacity: 20, larvae: 3 } };
    expect(netFoodPerSec(s)).toBeLessThan(0);
    const v = getVerdict(s);
    expect(v.kind).toBe('food');
    expect(verdictText(v)).toMatch(/^FOOD LASTS /);
    expect(v.warn).toBe(true);
  });

  it('says the nest is full while larvae wait, when food is fine', () => {
    const v = getVerdict(full());
    expect(v.kind).toBe('nest');
    expect(verdictText(v)).toBe('NEST FULL · 7 LARVAE WAIT');
  });

  it('otherwise says everything is growing, not in warn', () => {
    const v = getVerdict(colony({ resources: { workers: 5, nestCapacity: 50, food: 1_000 }, workersAssigned: { gather: 5 } }));
    expect(v.kind).toBe('growing');
    expect(verdictText(v)).toBe('EVERYTHING IS GROWING');
    expect(v.warn).toBe(false);
  });

  it('the runway equals the time the simulation takes to empty the stock, within one step', () => {
    const system = new ResourceSystem(new EventBus());
    const stepSec = 5;
    for (const food of [300, 2_000]) {
      let s: GameState = hungry(food);
      const v = getVerdict(s);
      if (v.kind !== 'food') throw new Error('expected a food verdict');
      let elapsed = 0;
      while (s.resources.food > 0 && elapsed < 10 * v.runwayMs + 60_000) {
        s = system.tick(s, undefined, stepSec);
        elapsed += stepSec * 1000;
      }
      expect(Math.abs(elapsed - v.runwayMs)).toBeLessThanOrEqual(stepSec * 1000);
    }
  });
});
