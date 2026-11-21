import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { prestigeBalance } from '../../src/data/balance/prestige';
import {
  PRESTIGE_REQUIREMENTS,
  getUnmetRequirements,
  isLegacyRevealed,
  isPrestigeAvailable,
  prestige,
  type PrestigeRequirementId,
} from '../../src/systems/PrestigeSystem';
import { processTick } from '../../src/engine/processTick';
import { EventBus } from '../../src/engine/EventBus';
import { EventQueue } from '../../src/engine/events';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { Phase } from '../../src/phases/phases';

/**
 * Story 5.1 (FR28): the prestige unlock condition is data. The levels and
 * thresholds live in `data/balance/prestige.ts`; `isPrestigeAvailable` and
 * `getUnmetRequirements` read the same requirement table, so they never disagree.
 * No test here spells a threshold: every number comes from the balance file.
 */

const { buildingLevels, lifetimeProduced } = prestigeBalance.unlock;
type Building = keyof typeof buildingLevels;
type Produced = keyof typeof lifetimeProduced;
const BUILDINGS = Object.keys(buildingLevels) as Building[];
const PRODUCED = Object.keys(lifetimeProduced) as Produced[];
const TOTAL_KEY = { food: 'totalFoodProduced', wood: 'totalWoodProduced', stone: 'totalStoneProduced', nectar: 'totalNectarProduced' } as const;

/** A state with each requirement's current value set: building levels and lifetime totals. */
function withValues(levels: Partial<Record<Building, number>>, totals: Partial<Record<Produced, number>>, base = createInitialState()): GameState {
  const buildings = { ...base.buildings };
  for (const b of BUILDINGS) if (levels[b] !== undefined) buildings[b] = { ...buildings[b], level: levels[b]! } as never;
  const p = { ...base.prestige };
  for (const r of PRODUCED) if (totals[r] !== undefined) p[TOTAL_KEY[r]] = totals[r]!;
  return { ...base, buildings, prestige: p };
}

/** Every requirement exactly at its target. */
const atTargets = (): GameState => withValues({ ...buildingLevels }, { ...lifetimeProduced });

describe('the prestige condition comes from data/balance/prestige.ts', () => {
  it('has one requirement per building level and lifetime threshold in the balance file, with its target', () => {
    const ids = PRESTIGE_REQUIREMENTS.map((r) => r.id).sort();
    expect(ids).toEqual([...BUILDINGS, ...PRODUCED].sort());
    for (const r of PRESTIGE_REQUIREMENTS) {
      const target = r.kind === 'building' ? buildingLevels[r.id as Building] : lifetimeProduced[r.id as Produced];
      expect(r.target, r.id).toBe(target);
      expect(Number.isInteger(r.target) && r.target > 0, r.id).toBe(true);
    }
  });

  it('is met with every requirement at its target, and a fresh state is not', () => {
    expect(isPrestigeAvailable(atTargets())).toBe(true);
    expect(getUnmetRequirements(atTargets())).toEqual([]);
    expect(isPrestigeAvailable(createInitialState())).toBe(false);
  });

  it('one requirement below its target is the one unmet, with its current value and target', () => {
    for (const r of PRESTIGE_REQUIREMENTS) {
      const below = r.target - 1;
      const s =
        r.kind === 'building'
          ? withValues({ ...buildingLevels, [r.id]: below }, { ...lifetimeProduced })
          : withValues({ ...buildingLevels }, { ...lifetimeProduced, [r.id]: below });
      expect(isPrestigeAvailable(s), r.id).toBe(false);
      expect(getUnmetRequirements(s), r.id).toEqual([{ id: r.id, kind: r.kind, current: below, target: r.target }]);
    }
  });

  it('unmet requirements report whole current values (lifetime totals floored)', () => {
    const s = withValues({}, { food: lifetimeProduced.food / 2 + 0.75 });
    const food = getUnmetRequirements(s).find((u) => u.id === 'food')!;
    expect(Number.isInteger(food.current)).toBe(true);
    expect(food.current).toBeLessThan(food.target);
  });

  it('property: isPrestigeAvailable(s) === (getUnmetRequirements(s).length === 0)', () => {
    const level = (b: Building) => fc.integer({ min: 0, max: buildingLevels[b] * 2 });
    const total = (r: Produced) => fc.integer({ min: 0, max: lifetimeProduced[r] * 2 });
    fc.assert(
      fc.property(
        fc.record(Object.fromEntries(BUILDINGS.map((b) => [b, level(b)])) as Record<Building, fc.Arbitrary<number>>),
        fc.record(Object.fromEntries(PRODUCED.map((r) => [r, total(r)])) as Record<Produced, fc.Arbitrary<number>>),
        (levels, totals) => {
          const s = withValues(levels, totals);
          expect(isPrestigeAvailable(s)).toBe(getUnmetRequirements(s).length === 0);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('LOG → LEGACY is revealed when the condition is first met, and stays', () => {
  it('is hidden on a fresh run and while any requirement is short', () => {
    expect(isLegacyRevealed(createInitialState())).toBe(false);
    const short = withValues({ ...buildingLevels, [BUILDINGS[0]]: buildingLevels[BUILDINGS[0]] - 1 }, { ...lifetimeProduced });
    expect(isLegacyRevealed(short)).toBe(false);
  });

  it('appears the moment the condition is met', () => {
    expect(isLegacyRevealed(atTargets())).toBe(true);
  });

  it('stays after a prestige, though the new run meets no requirement', () => {
    const after = prestige({ ...atTargets(), phase: Phase.COLONY });
    expect(getUnmetRequirements(after).length).toBeGreaterThan(0);
    expect(isLegacyRevealed(after)).toBe(true);
  });

  it('the victory record is not part of the condition: the UI keeps LEGACY after the ending (Story 5.5)', () => {
    expect(isLegacyRevealed({ ...createInitialState(), victoryAchieved: true })).toBe(false);
  });

  it("no requirement's current value drops while a run plays, so the reveal cannot flicker off", () => {
    const base = createInitialState();
    let s: GameState = {
      ...atTargets(),
      phase: Phase.COMBAT,
      resources: { ...base.resources, workers: 40, food: 500, wood: 500, stone: 500, nectar: 500, nestCapacity: 100 },
      workersAssigned: { ...base.workersAssigned, gather: 10, forage: 10, dig: 10, guard: 5 },
      combatSoldiers: 10,
    };
    const currents = (x: GameState) => PRESTIGE_REQUIREMENTS.map((r) => r.current(x));
    const bus = new EventBus();
    const sys = [new ResourceSystem(bus), new SoldierSystem(bus), new MapSystem(), new TerritorySystem()] as const;
    let before = currents(s);
    for (let i = 0; i < 400; i++) {
      s = processTick(s, ...sys, new EventQueue(), 0.5);
      const now = currents(s);
      now.forEach((v, k) => expect(v, PRESTIGE_REQUIREMENTS[k].id).toBeGreaterThanOrEqual(before[k]));
      expect(isLegacyRevealed(s)).toBe(true);
      before = now;
    }
  });
});

// A compile-time check that the id type covers the table.
const _ids: readonly PrestigeRequirementId[] = PRESTIGE_REQUIREMENTS.map((r) => r.id);
void _ids;
