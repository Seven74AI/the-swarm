import { describe, it, expect } from 'vitest';
import { Phase } from '../../../src/phases/phases';
import type { GameState } from '../../../src/state/GameState';
import { getNextAction, getBuildAction, itemCost, itemEffects, itemKey, type ItemRef } from '../../../src/systems/NextAction';
import { CRITICAL_PATH } from '../../../src/data/content/criticalPath';
import { FIRST_PRODUCED_IN, type ProducedResource } from '../../../src/data/content/producers';
import { isUnlocked } from '../../../src/data/content/tabs';
import { makeState } from '../helpers/makeState';
import { byCurrency, dominates, freshIn, purchasablesIn } from '../helpers/choices';

/**
 * Story 4.7 (FR19): Colony has choices worth making. Phase 2's purchasables
 * are the items sold by a panel open in Colony to a fresh colony there
 * (helpers/choices.ts). Invariants only: no price or effect is restated.
 */

const fresh = (): GameState => freshIn(Phase.COLONY);
const items = purchasablesIn(Phase.COLONY);

describe('Phase 2 purchasables (Story 4.7)', () => {
  it('there are at least four, each priced only in currencies produced by Colony', () => {
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const ref of items) {
      const cost = itemCost(fresh(), ref)!;
      expect(Object.keys(cost).length, itemKey(ref)).toBeGreaterThan(0);
      for (const k of Object.keys(cost)) {
        expect(k in FIRST_PRODUCED_IN, `${itemKey(ref)} costs ${k}`).toBe(true);
        expect(isUnlocked(FIRST_PRODUCED_IN[k as ProducedResource], Phase.COLONY), `${itemKey(ref)} costs ${k}`).toBe(true);
      }
    }
  });

  it('listed by currency, every currency the Colony roles bring in is wanted by at least two of them', () => {
    const groups = byCurrency(fresh(), items);
    const colonyCurrencies = (Object.keys(FIRST_PRODUCED_IN) as ProducedResource[]).filter((k) => FIRST_PRODUCED_IN[k] === Phase.COLONY);
    expect(colonyCurrencies.length).toBeGreaterThan(0);
    for (const k of colonyCurrencies) {
      expect((groups.get(k as never) ?? []).map(itemKey).length, k).toBeGreaterThanOrEqual(2);
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
        expect(dominates(fresh(), a, b), `${itemKey(a)} dominates ${itemKey(b)}`).toBe(false);
      }
    }
  });

  it("every one is in Phase 2's critical-path table", () => {
    const path = CRITICAL_PATH[Phase.COLONY].map(itemKey);
    for (const ref of items) expect(path, itemKey(ref)).toContain(itemKey(ref));
  });

  it('the next-action rule and BUILD prefer them in table order', () => {
    // Rich, fed and roomy: nothing latches or alarms, and every item is affordable.
    const rich = makeState({
      phase: Phase.COLONY,
      resources: { workers: 20, nestCapacity: 1000, food: 1e12, wood: 1e12, stone: 1e12, nectar: 1e12 },
      workersAssigned: { gather: 10, forage: 2, dig: 2, guard: 1 },
    });
    // Price an item out of reach (or finish it), so the rule moves on to the next one.
    const priceOut = (s: GameState, ref: ItemRef): GameState => {
      switch (ref.kind) {
        case 'building':
          return { ...s, buildings: { ...s.buildings, [ref.id]: { ...s.buildings[ref.id], level: s.buildings[ref.id].level + 60 } } };
        case 'upgrade':
          return { ...s, upgrades: { ...s.upgrades, [ref.id]: 1000 } };
        case 'research':
          return { ...s, research: { ...s.research, projects: { ...s.research.projects, [ref.id]: { status: 'done' } } } };
        default:
          throw new Error(`no way to price out ${itemKey(ref)}`);
      }
    };
    let s = rich;
    for (const ref of CRITICAL_PATH[Phase.COLONY]) {
      const next = getNextAction(s);
      expect(next.kind === 'act' && next.rule, itemKey(ref)).toBe('critical_path');
      expect(next.kind === 'act' && next.key).toBe(itemKey(ref));
      const build = getBuildAction(s);
      expect(build.kind === 'act' && build.key, itemKey(ref)).toBe(itemKey(ref));
      s = priceOut(s, ref);
    }
  });
});
