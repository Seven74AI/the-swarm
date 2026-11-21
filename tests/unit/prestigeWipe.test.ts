import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { PHASE_ORDER } from '../../src/phases/phases';
import { PRESTIGE_UPGRADES } from '../../src/data/prestigeTree';
import { prestigeBalance } from '../../src/data/balance/prestige';
import { DECISION_IDS } from '../../src/data/content/decisions';
import { PRESTIGE_KEEPS, legacyPointsAward, prestige, startPhaseFor } from '../../src/systems/PrestigeSystem';
import { getPrestigeBonuses } from '../../src/systems/PrestigeBonusSystem';
import { peekEnemy } from '../../src/systems/EnemySystem';
import { EventBus } from '../../src/engine/EventBus';
import { EventLog } from '../../src/ui/log/EventLog';
import { createChronicle } from '../../src/state/chronicle';
import { COLONY_LINES } from '../../src/data/content/colonyLines';
import { isPrestigeAvailable } from '../../src/systems/PrestigeSystem';
import { makeState } from './helpers/makeState';
import { testActions } from './helpers/actions';

/**
 * Story 5.3 (FR30): prestige wipes the run. Every field of the state is
 * either kept across prestige (LP, lifetime LP, the Legacy upgrades, the
 * lifetime statistics, the victory record, the generator) or back at its
 * initial value, except what an owned Legacy upgrade grants (the royal
 * cache's eggs and food, Phase Skip's start phase). Property test over
 * random pre-prestige states; no balance number is restated.
 */

/** What the story says survives a prestige, by top-level field. */
const KEPT: readonly (keyof GameState)[] = [
  // The generator keeps running (Story 3.1) and the save's seed stays.
  'seed',
  'rng',
  // LP, lifetime LP and the prestige count/totals (updated by the prestige itself).
  'prestige',
  // Purchased Legacy upgrades.
  'prestigeTree',
  // Lifetime statistics.
  'stats',
  'lifetime',
  // The victory record.
  'victoryAchieved',
  // The verbs the player has learned (ADR 0039: prestige keeps automation).
  'automation',
  // Bookkeeping, not part of a run: ids stay monotonic, the save clock stays.
  'nextIds',
  'lastSaveTimestamp',
];

/** Fields a Legacy upgrade grants a value in, or that are drawn from the kept generator. */
const GRANTED: readonly (keyof GameState)[] = ['phase', 'resources', 'eggPipeline', 'nextEnemy', 'soldiers'];

const IDS = PRESTIGE_UPGRADES.map((u) => u.id);

/** A deterministic scramble of every number and boolean in `value`, from `seed`. */
function scramble<T>(value: T, next: () => number): T {
  if (typeof value === 'number') return Math.floor(next() * 5000) as T;
  if (typeof value === 'boolean') return (next() < 0.5) as T;
  if (Array.isArray(value)) return value.map((v) => scramble(v, next)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scramble(v, next)])) as T;
  }
  return value;
}

function lcg(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

/** A random colony late in some run: every stock, level and flag scrambled, a goal latched and an event open. */
const runState = fc
  .record({
    seed: fc.integer({ min: 1, max: 2 ** 31 }),
    phase: fc.constantFrom(...PHASE_ORDER),
    bought: fc.subarray(IDS),
    decision: fc.constantFrom(...DECISION_IDS),
    victory: fc.boolean(),
  })
  .map(({ seed, phase, bought, decision, victory }): GameState => {
    const base = scramble(createInitialState(), lcg(seed));
    return {
      ...base,
      phase,
      victoryAchieved: victory,
      prestigeTree: { purchased: bought },
      phaseGoal: { phase, latched: true, atMs: 1, reached: { workers: 1 } },
      decision: { open: { id: decision, remainingMs: 1000, openedAtSessionMs: 0, roll: 0.5 }, nextSpawnSessionMs: 5 },
      research: {
        ...base.research,
        projects: Object.fromEntries(Object.keys(base.research.projects).map((id) => [id, { status: 'done' }])) as GameState['research']['projects'],
      },
      expeditions: [{ id: 'e1', status: 'running', scouts: 1, warriors: 1, destination: 'x', remainingMs: 1, durationMs: 2, risk: 0 }] as GameState['expeditions'],
      discoveredPlanets: ['a'],
      discoveries: ['b'],
      unlockedPanels: ['c'],
    };
  });

describe('prestige wipes the run (Story 5.3, FR30)', () => {
  it('the kept fields are exactly the story\'s list', () => {
    expect([...PRESTIGE_KEEPS].sort()).toEqual([...KEPT].sort());
  });

  it('every other field is back at its initial value, apart from what Legacy upgrades grant', () => {
    const fresh = createInitialState();
    fc.assert(
      fc.property(runState, (s) => {
        const out = prestige(s);
        expect(Object.keys(out).sort()).toEqual(Object.keys(fresh).sort());
        for (const k of Object.keys(fresh) as (keyof GameState)[]) {
          if (KEPT.includes(k) || GRANTED.includes(k)) continue;
          expect(out[k], String(k)).toEqual(fresh[k]);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('every resource is reset, space resources included; only the royal cache grants eggs and food', () => {
    const fresh = createInitialState();
    fc.assert(
      fc.property(runState, (s) => {
        const out = prestige(s);
        const cache = getPrestigeBonuses(s).startingResources;
        for (const k of Object.keys(fresh.resources) as (keyof GameState['resources'])[]) {
          if (cache && (k === 'eggs' || k === 'food')) continue;
          expect(out.resources[k], k).toBe(fresh.resources[k]);
        }
        expect(out.resources.voidCrystals).toBe(0);
        expect(out.resources.antimatter).toBe(0);
        expect(out.resources.darkMatter).toBe(0);
        expect(out.resources.surveyData).toBe(0);
        if (cache) {
          expect(out.resources.eggs).toBe(prestigeBalance.royalCache.eggs);
          expect(out.eggPipeline).toEqual({ count: prestigeBalance.royalCache.eggs, progress: 0 });
          expect(out.resources.food).toBe(prestigeBalance.royalCache.food);
        } else {
          expect(out.eggPipeline).toEqual(fresh.eggPipeline);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('the run starts in Egg Laying, or where Phase Skip starts it (Story 5.6 caps that at the first phase not completed)', () => {
    fc.assert(
      fc.property(runState, (s) => {
        expect(prestige(s).phase).toBe(getPrestigeBonuses(s).phaseSkip ? startPhaseFor(s) : 'egg_laying');
      }),
      { numRuns: 60 },
    );
  });

  it('the soldiers are reset; the kills tally is a lifetime statistic', () => {
    fc.assert(
      fc.property(runState, (s) => {
        const out = prestige(s);
        expect(out.soldiers).toEqual({ ...createInitialState().soldiers, totalKilled: s.soldiers.totalKilled });
      }),
      { numRuns: 30 },
    );
  });

  it('the next enemy is the first one the kept generator draws for a fresh run', () => {
    fc.assert(
      fc.property(runState, (s) => {
        const out = prestige(s);
        expect(out.nextEnemy).toBe(peekEnemy(out.rng, 0).type);
      }),
      { numRuns: 30 },
    );
  });

  it('LP and lifetime LP grow by the award; Legacy upgrades, lifetime stats and the victory record are unchanged', () => {
    fc.assert(
      fc.property(runState, (s) => {
        const award = legacyPointsAward(s);
        const out = prestige(s);
        expect(out.prestige).toEqual({
          ...s.prestige,
          count: s.prestige.count + 1,
          legacyPoints: s.prestige.legacyPoints + award,
          lifetimeLpEarned: s.prestige.lifetimeLpEarned + award,
        });
        for (const k of KEPT.filter((k) => k !== 'prestige')) expect(out[k], String(k)).toEqual(s[k]);
      }),
      { numRuns: 60 },
    );
  });

  it('the goal latch and the open decision event are gone', () => {
    fc.assert(
      fc.property(runState, (s) => {
        const out = prestige(s);
        expect(out.phaseGoal).toBeNull();
        expect(out.decision.open).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});

describe('the new run (Story 5.3)', () => {
  /** A colony that meets the prestige condition, read from its balance. */
  function ready(): GameState {
    const { buildingLevels, lifetimeProduced } = prestigeBalance.unlock;
    const base = makeState({ phase: 'space', resources: { voidCrystals: 7, workers: 40 } });
    return {
      ...base,
      buildings: Object.fromEntries(
        Object.entries(base.buildings).map(([id, b]) => [id, { ...b, level: (buildingLevels as Record<string, number>)[id] ?? b.level }]),
      ) as GameState['buildings'],
      prestige: {
        ...base.prestige,
        totalFoodProduced: lifetimeProduced.food,
        totalWoodProduced: lifetimeProduced.wood,
        totalStoneProduced: lifetimeProduced.stone,
        totalNectarProduced: lifetimeProduced.nectar,
      },
    };
  }

  it('the prestige action opens the new run with one line, A QUEEN, AGAIN., and no phase reveal', () => {
    let s = ready();
    expect(isPrestigeAvailable(s)).toBe(true);
    const bus = new EventBus();
    const chronicle = createChronicle();
    new EventLog(bus, { chronicle });
    const committed: unknown[] = [];
    bus.subscribe('phase_committed', (e) => void committed.push(e));
    const actions = testActions(bus, () => s, (next) => (s = next));
    expect(actions.prestige().ok).toBe(true);
    expect(s.phase).toBe('egg_laying');
    expect(s.resources.voidCrystals).toBe(0);
    expect(chronicle.entries.value.map((e) => e.message)).toEqual([COLONY_LINES.prestige.text]);
    expect(COLONY_LINES.prestige.text).toBe('A QUEEN, AGAIN.');
    // The new run starts with no reveal of its first phase (and no title cinematic).
    expect(committed).toEqual([]);
  });
});
