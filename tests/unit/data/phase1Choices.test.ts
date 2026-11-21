import { describe, it, expect } from 'vitest';
import { Phase } from '../../../src/phases/phases';
import type { GameState } from '../../../src/state/GameState';
import { itemCost, itemEffects, itemKey, type ItemRef } from '../../../src/systems/NextAction';
import { CRITICAL_PATH } from '../../../src/data/content/criticalPath';
import { FIRST_PRODUCED_IN, type ProducedResource } from '../../../src/data/content/producers';
import { dominates as dominatesIn, freshIn, purchasablesIn } from '../helpers/choices';

/**
 * Story 4.6 (FR19): Egg Laying has choices worth making. Phase 1's
 * purchasables are every item the next-action rule sells from a panel open
 * in Phase 1 to a fresh colony. Their effects are data (`itemEffects`), so
 * the dominance check covers any item added later. Invariants only: no
 * amount is restated here.
 */

/** A fresh Phase 1 colony. */
const fresh = (): GameState => freshIn(Phase.EGG_LAYING);

/** Items sold only from a later tab are not Phase 1's, even if their own rules would allow them (helpers/choices.ts). */
const phase1Items = (): ItemRef[] => purchasablesIn(Phase.EGG_LAYING);

/** a costs the same or less on every stock b costs, and gives at least as much of every effect b gives. */
const dominates = (a: ItemRef, b: ItemRef): boolean => dominatesIn(fresh(), a, b);

describe('Phase 1 purchasables (Story 4.6)', () => {
  const items = phase1Items();

  it('there are at least four', () => {
    expect(items.map(itemKey).length).toBeGreaterThanOrEqual(4);
  });

  it('each is priced only in currencies produced in Phase 1, so they compete for the same stock', () => {
    for (const ref of items) {
      const cost = itemCost(fresh(), ref)!;
      expect(Object.keys(cost).length, itemKey(ref)).toBeGreaterThan(0);
      for (const k of Object.keys(cost)) {
        expect(k in FIRST_PRODUCED_IN, `${itemKey(ref)} costs ${k}`).toBe(true);
        expect(FIRST_PRODUCED_IN[k as ProducedResource], `${itemKey(ref)} costs ${k}`).toBe(Phase.EGG_LAYING);
      }
    }
    const currencies = new Set(items.flatMap((ref) => Object.keys(itemCost(fresh(), ref)!)));
    // At least two items draw on each currency used: every purchase is a choice against another.
    for (const k of currencies) {
      expect(items.filter((ref) => k in itemCost(fresh(), ref)!).length, k).toBeGreaterThanOrEqual(2);
    }
  });

  it('each has its effects as data, every one a gain', () => {
    for (const ref of items) {
      const effects = itemEffects(fresh(), ref);
      expect(effects, itemKey(ref)).not.toBeNull();
      const values = Object.values(effects!);
      expect(values.length, itemKey(ref)).toBeGreaterThan(0);
      for (const v of values) expect(v, itemKey(ref)).toBeGreaterThan(0);
    }
  });

  it('none is strictly dominant: no item costs the same or less and gives at least as much on every effect as another', () => {
    for (const a of items) {
      for (const b of items) {
        if (a === b) continue;
        expect(dominates(a, b), `${itemKey(a)} dominates ${itemKey(b)}`).toBe(false);
      }
    }
  });

  it('Click Power stays the only tap upgrade; the additions improve hatching, upkeep or capacity', () => {
    const tap = items.filter((ref) => (itemEffects(fresh(), ref)!.eggsPerTap ?? 0) > 0);
    expect(tap.map(itemKey)).toEqual(['upgrade:click_power']);
    for (const ref of items.filter((r) => !tap.includes(r))) {
      const e = itemEffects(fresh(), ref)!;
      expect((e.hatchPercent ?? 0) + (e.upkeepCutPercent ?? 0) + (e.nestCapacity ?? 0), itemKey(ref)).toBeGreaterThan(0);
    }
  });

  it('every one is in Phase 1\'s critical-path table', () => {
    const path = CRITICAL_PATH[Phase.EGG_LAYING].map(itemKey);
    for (const ref of items) expect(path, itemKey(ref)).toContain(itemKey(ref));
  });

  it('the additions are Phase 1 choices: none is sold after Egg Laying, Click Power still is', () => {
    const later = { ...fresh(), phase: Phase.COLONY };
    for (const ref of items) {
      if (itemKey(ref) === 'upgrade:click_power') expect(itemCost(later, ref)).not.toBeNull();
      else expect(itemCost(later, ref), itemKey(ref)).toBeNull();
    }
  });
});
