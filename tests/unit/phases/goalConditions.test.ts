// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import {
  TRANSITIONS,
  EGG_TO_COLONY,
  COLONY_TO_COMBAT,
  COMBAT_TO_EXPANSION,
  EXPANSION_TO_SPACE,
  SPACE_TO_TRANSCENDENCE,
  conditionMet,
  goalFor,
  goalPercent,
  type Transition,
} from '../../../src/phases/transitions';
import { createInitialState, type GameState } from '../../../src/state/GameState';

/**
 * Story 1.18 (AR5, ADR 0003): each transition declares its conditions and its
 * guard is derived as "all conditions met". The derived guard must equal the
 * boolean guard each transition had before (the legacy guards below keep its
 * shape: which fields, `>=`, AND), on random states.
 *
 * The legacy guards take their thresholds from the conditions by id, so no
 * balance number is copied here (CLAUDE.md: test invariants, never numbers).
 */

const BASE = createInitialState();

function targetOf(t: Transition, id: string): number {
  const c = t.conditions.find((x) => x.id === id);
  if (!c) throw new Error(`${t.from}→${t.to} has no condition '${id}'`);
  return c.target(BASE);
}

type LegacyGuard = (s: GameState) => boolean;
const LEGACY: ReadonlyArray<[Transition, LegacyGuard]> = [
  [EGG_TO_COLONY, (s) => s.resources.workers >= targetOf(EGG_TO_COLONY, 'workers')],
  [
    COLONY_TO_COMBAT,
    (s) =>
      s.resources.workers >= targetOf(COLONY_TO_COMBAT, 'workers') &&
      s.workersAssigned.guard >= targetOf(COLONY_TO_COMBAT, 'guard'),
  ],
  [
    COMBAT_TO_EXPANSION,
    (s) =>
      s.resources.workers >= targetOf(COMBAT_TO_EXPANSION, 'workers') &&
      s.battlesWon >= targetOf(COMBAT_TO_EXPANSION, 'battlesWon'),
  ],
  [
    EXPANSION_TO_SPACE,
    (s) =>
      s.resources.workers >= targetOf(EXPANSION_TO_SPACE, 'workers') &&
      s.resources.food >= targetOf(EXPANSION_TO_SPACE, 'food'),
  ],
  [
    SPACE_TO_TRANSCENDENCE,
    (s) =>
      s.resources.voidCrystals >= targetOf(SPACE_TO_TRANSCENDENCE, 'voidCrystals') &&
      s.resources.antimatter >= targetOf(SPACE_TO_TRANSCENDENCE, 'antimatter') &&
      s.resources.darkMatter >= targetOf(SPACE_TO_TRANSCENDENCE, 'darkMatter'),
  ],
];

/** The largest target of any condition, so random values straddle every threshold. */
const SPAN = Math.max(1, ...TRANSITIONS.flatMap((t) => t.conditions.map((c) => c.target(BASE)))) * 2;

/** A value that is often right at a threshold (±1), sometimes fractional, sometimes anywhere. */
function around(t: Transition, id: string): fc.Arbitrary<number> {
  const target = targetOf(t, id);
  return fc.oneof(
    fc.integer({ min: Math.max(0, target - 1), max: target + 1 }),
    fc.integer({ min: 0, max: SPAN }),
    fc.double({ min: 0, max: SPAN, noNaN: true }),
  );
}

function stateFor(t: Transition): fc.Arbitrary<GameState> {
  const pick = (id: string, field: () => fc.Arbitrary<number>) =>
    t.conditions.some((c) => c.id === id) ? around(t, id) : field();
  const any = () => fc.integer({ min: 0, max: SPAN });
  return fc
    .record({
      workers: pick('workers', any),
      guard: pick('guard', any),
      battlesWon: pick('battlesWon', any),
      food: pick('food', any),
      voidCrystals: pick('voidCrystals', any),
      antimatter: pick('antimatter', any),
      darkMatter: pick('darkMatter', any),
    })
    .map((r) => ({
      ...BASE,
      phase: t.from,
      battlesWon: r.battlesWon,
      workersAssigned: { ...BASE.workersAssigned, guard: r.guard },
      resources: {
        ...BASE.resources,
        workers: r.workers,
        food: r.food,
        voidCrystals: r.voidCrystals,
        antimatter: r.antimatter,
        darkMatter: r.darkMatter,
      },
    }));
}

describe('goal conditions (Story 1.18, AR5)', () => {
  it('covers every transition with a legacy guard', () => {
    expect(LEGACY.map(([t]) => t)).toEqual(TRANSITIONS);
  });

  it('every transition declares at least one condition, with unique ids and a label', () => {
    for (const t of TRANSITIONS) {
      expect(t.conditions.length).toBeGreaterThan(0);
      const ids = t.conditions.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of t.conditions) {
        expect(c.label.trim()).not.toBe('');
        expect(Number.isInteger(c.target(BASE))).toBe(true);
        expect(c.target(BASE)).toBeGreaterThan(0);
      }
    }
  });

  for (const [t, legacy] of LEGACY) {
    it(`${t.from} → ${t.to}: the derived guard equals the old boolean guard`, () => {
      fc.assert(
        fc.property(stateFor(t), (s) => {
          expect(t.guard(s)).toBe(legacy(s));
          expect(t.guard(s)).toBe(t.conditions.every((c) => conditionMet(c, s)));
        }),
        { numRuns: 500 },
      );
    });
  }

  it('goalFor gives the outgoing transition of each phase, and none after the last', () => {
    for (const phase of PHASE_ORDER) {
      const out = TRANSITIONS.find((t) => t.from === phase) ?? null;
      expect(goalFor(phase)).toBe(out);
    }
    expect(goalFor(Phase.TRANSCENDENCE)).toBeNull();
  });

  it('goalPercent is a whole number from 0 to 100, and 100 exactly when the guard is met', () => {
    for (const t of TRANSITIONS) {
      fc.assert(
        fc.property(stateFor(t), (s) => {
          const pct = goalPercent(t, s);
          expect(Number.isInteger(pct)).toBe(true);
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
          expect(pct === 100).toBe(t.guard(s));
        }),
        { numRuns: 300 },
      );
    }
  });

  it('goalPercent never falls when a condition moves closer to its target', () => {
    fc.assert(
      fc.property(stateFor(COLONY_TO_COMBAT), fc.integer({ min: 1, max: SPAN }), (s, more) => {
        const up = { ...s, resources: { ...s.resources, workers: s.resources.workers + more } };
        expect(goalPercent(COLONY_TO_COMBAT, up)).toBeGreaterThanOrEqual(goalPercent(COLONY_TO_COMBAT, s));
      }),
    );
  });
});
