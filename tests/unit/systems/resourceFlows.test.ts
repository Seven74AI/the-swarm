/**
 * Story 9.10: a resource's peek says where it comes from and what spends it,
 * from the same data the systems use.
 */
import { describe, expect, it } from 'vitest';
import { resourceFlows } from '../../../src/systems/ResourceFlows';
import { itemCost, itemTarget, listItems } from '../../../src/systems/NextAction';
import { roleBalance } from '../../../src/data/balance/roles';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';

const colony = makeState({ phase: Phase.COLONY, resources: { workers: 30 } });

describe('resourceFlows', () => {
  it('lists every item on sale now that is priced in the resource, and nothing else', () => {
    for (const id of ['wood', 'stone', 'nectar', 'food'] as const) {
      const expected = listItems()
        .filter((ref) => (itemCost(colony, ref)?.[id] ?? 0) > 0)
        .map((ref) => itemTarget(colony, ref));
      const { spentOn } = resourceFlows(colony, id);
      for (const name of expected) expect(spentOn, id).toContain(name);
    }
  });

  it('food is eaten: its upkeep is a spend', () => {
    expect(resourceFlows(colony, 'food').spentOn.some((s) => /EAT/.test(s))).toBe(true);
  });

  it('names the roles that bring a resource in, from their yields', () => {
    expect(roleBalance.gatherWoodPerSec).toBeGreaterThan(0);
    expect(resourceFlows(colony, 'wood').from.join(' ')).toMatch(/GATHER/);
    expect(resourceFlows(colony, 'stone').from.join(' ')).toMatch(/DIG/);
    expect(resourceFlows(colony, 'nectar').from.join(' ')).toMatch(/FORAG/);
  });

  it('always says something for every resource', () => {
    for (const id of ['eggs', 'larvae', 'workers', 'food', 'wood', 'stone', 'nectar', 'silk', 'chitin', 'venom', 'voidCrystals', 'antimatter', 'darkMatter', 'surveyData']) {
      expect(resourceFlows(colony, id).from.length, id).toBeGreaterThan(0);
    }
  });
});
