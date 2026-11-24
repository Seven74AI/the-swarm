/**
 * Story 9.11 (FR66, UX-DR50): the resource sheet's first line, the worst
 * current state, first match wins.
 */
import { describe, expect, it } from 'vitest';
import { getVerdict, settlesText, verdictText } from '../../../src/systems/Verdict';
import { VERDICT_ORDER } from '../../../src/data/content/verdicts';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { EventBus } from '../../../src/engine/EventBus';
import { netFoodPerSec } from '../../../src/systems/Workforce';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';
import { deathIntervalMs, getSettlesAt } from '../../../src/systems/Starvation';
import { getFoodLimit } from '../../../src/systems/FoodLimit';
import { VERDICT_COPY } from '../../../src/data/content/verdicts';
import { formatFull, formatTime } from '../../../src/utils/format';
import type { GameState } from '../../../src/state/GameState';

const colony = (over: Parameters<typeof makeState>[0] = {}) => makeState({ phase: Phase.COLONY, ...over });
/** Food falling: tenders eat and nobody gathers. */
const hungry = (food: number) => colony({ resources: { workers: 20, food, nestCapacity: 100, eggs: 0, larvae: 0 }, workersAssigned: { tend: 20 } });
/** A full nest with larvae waiting, fed (its store under the food limit, Story 9.15). */
const full = () => colony({ resources: { workers: 30, nestCapacity: 30, food: 1_000, larvae: 7 }, larvaPipeline: { count: 7, progress: 0 }, workersAssigned: { gather: 30 } });

describe('getVerdict', () => {
  it('keeps its order in content: starving, food falling, food at the limit, the nest, then all is well (Story 9.17)', () => {
    expect(VERDICT_ORDER).toEqual(['starving', 'food', 'limit', 'nest', 'growing']);
  });

  it('escalates to STARVING · AN ANT DIES EVERY <t> once food is at zero and use outruns production (Story 9.16)', () => {
    const s = hungry(0);
    const v = getVerdict(s);
    expect(v.kind).toBe('starving');
    expect(v.warn).toBe(true);
    expect(verdictText(v)).toBe(`STARVING · AN ANT DIES EVERY ${formatTime(deathIntervalMs(s)).toUpperCase()}`);
    // Before the store is empty, the warning is the runway.
    expect(getVerdict(hungry(500)).kind).toBe('food');
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

/** A fed colony whose store is at its limit (Story 9.15), with rooms dug. */
const atLimit = () => {
  const s = colony({ resources: { workers: 30, nestCapacity: 100, food: 0 }, workersAssigned: { gather: 30 }, dig: { roomsDug: 2, progress: 0, carry: 0, roomsByHand: 0, auto: false }, roomJobs: { jobs: { gallery: 0, pantry: 0, larder: 0 }, fresh: 2 } });
  return { ...s, resources: { ...s.resources, food: getFoodLimit(s) } };
};

describe('Story 9.17: the verdict walks every state, and says where hunger leads', () => {
  const seeds: Record<(typeof VERDICT_ORDER)[number], () => GameState> = {
    starving: () => hungry(0),
    food: () => hungry(500),
    limit: atLimit,
    nest: full,
    growing: () => colony({ resources: { workers: 5, nestCapacity: 50, food: 1_000 }, workersAssigned: { gather: 5 } }),
  };

  it('each verdict comes from its seeded state', () => {
    for (const kind of VERDICT_ORDER) expect(getVerdict(seeds[kind]()).kind, kind).toBe(kind);
  });

  it('a full store reads FOOD AT THE LIMIT, in warn, before a full nest', () => {
    const v = getVerdict(atLimit());
    expect(v.warn).toBe(true);
    expect(verdictText(v)).toBe(VERDICT_COPY.atLimit);
    const both = { ...atLimit(), resources: { ...atLimit().resources, nestCapacity: 30, larvae: 7 }, larvaPipeline: { count: 7, progress: 0 } };
    expect(getVerdict(both).kind).toBe('limit');
  });

  it('starving or falling adds IF NOTHING CHANGES: SETTLES AT <n> WORKERS. from getSettlesAt; no other verdict does', () => {
    for (const s of [hungry(0), hungry(500)]) {
      expect(settlesText(getVerdict(s), s)).toBe(VERDICT_COPY.settles(formatFull(getSettlesAt(s).workers)));
      expect(getSettlesAt(s).workers).toBeLessThan(s.resources.workers);
    }
    for (const kind of ['limit', 'nest', 'growing'] as const) expect(settlesText(getVerdict(seeds[kind]()), seeds[kind]()), kind).toBeNull();
  });

  it('names the screen that fixes it: Gather while more gatherers help, the room jobs for a full store or when only a Pantry helps', () => {
    expect(getVerdict(hungry(500))).toMatchObject({ fix: 'gather' });
    expect(getVerdict(hungry(0))).toMatchObject({ fix: 'gather' });
    expect(getVerdict(atLimit())).toMatchObject({ fix: 'room_jobs' });
    // Everyone already gathers and the army still outeats them: only a Pantry is left.
    const base = atLimit();
    const army = { ...base, phase: Phase.COMBAT, combatSoldiers: 5_000, resources: { ...base.resources, food: 500 } };
    expect(netFoodPerSec(army)).toBeLessThan(0);
    expect(getVerdict(army)).toMatchObject({ kind: 'food', fix: 'room_jobs' });
  });

  it('counts free workers as WRKR does: researchers are not free, and moving them all to Gather is what helps (review)', () => {
    const base = atLimit();
    // 30 workers all free, 20 more off researching; an army eats more than they make while idle.
    const s = { ...base, resources: { ...base.resources, workers: 30, food: 100 }, workersAssigned: { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 20 }, combatSoldiers: 0 };
    const army = { ...s, phase: Phase.COMBAT, combatSoldiers: 70 };
    const allGather = { ...army, workersAssigned: { ...army.workersAssigned, gather: 30 } };
    expect(netFoodPerSec(army)).toBeLessThan(0);
    expect(netFoodPerSec(allGather)).toBeGreaterThanOrEqual(0);
    expect(getVerdict(army)).toMatchObject({ kind: 'food', fix: 'gather' });
  });

  it('a full store with nothing coming in loses nothing: no limit verdict (review)', () => {
    const s = atLimit();
    const still = { ...s, resources: { ...s.resources, workers: 0 }, workersAssigned: { ...s.workersAssigned, gather: 0 } };
    expect(netFoodPerSec(still)).toBe(0);
    expect(getVerdict(still).kind).not.toBe('limit');
  });

  it('a full store where no room can become a Larder names no screen to fix it (review)', () => {
    const s = atLimit();
    const noRooms = { ...s, dig: { ...s.dig, roomsDug: 0 }, roomJobs: { ...s.roomJobs, fresh: 0 } };
    const full = { ...noRooms, resources: { ...noRooms.resources, food: getFoodLimit(noRooms) } };
    expect(getVerdict(full)).toMatchObject({ kind: 'limit', fix: null });
  });
});
