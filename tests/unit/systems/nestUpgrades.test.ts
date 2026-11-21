import { describe, it, expect } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { Phase } from '../../../src/phases/phases';
import { computeResourceRates, getUpgradeCost, isUpgradeOpen, ResourceSystem } from '../../../src/systems/ResourceSystem';
import { getEffects } from '../../../src/systems/BuildingSystem';
import { upgradeBalance, NEST_UPGRADE_IDS, type UpgradeId } from '../../../src/data/balance/upgrades';
import { UPGRADE_COPY } from '../../../src/data/content/upgrades';
import type { GameState } from '../../../src/state/GameState';
import { testActions } from '../helpers/actions';
import { makeState } from '../helpers/makeState';

/**
 * Story 4.6: the egg-chamber upgrades Phase 1 sells besides Click Power. Each
 * is bought with food, one level at a time, and does what its effects data
 * says. Invariants only: no amount is restated.
 */

const sys = () => new ResourceSystem(new EventBus());
const LOTS = 1_000_000;

/** A Phase 1 colony with a brood in the pipeline and workers eating. */
function brood(upgrades: Record<string, number> = {}): GameState {
  return makeState({
    phase: Phase.EGG_LAYING,
    resources: { eggs: 1_000, larvae: 1_000, workers: 10, food: LOTS },
    eggPipeline: { count: 1_000, progress: 0 },
    larvaPipeline: { count: 1_000, progress: 0 },
    upgrades,
  });
}

const capacity = (s: GameState) => s.resources.nestCapacity + (getEffects('warehouse', s.buildings.warehouse.level).nestCapacity ?? 0);

describe('egg-chamber upgrades (Story 4.6)', () => {
  it('are at least three, each with copy', () => {
    expect(NEST_UPGRADE_IDS.length).toBeGreaterThanOrEqual(3);
    for (const id of NEST_UPGRADE_IDS) {
      expect(UPGRADE_COPY[id].title, id).toMatch(/^[A-Z ]+$/);
      expect(getUpgradeCost(id, 0), id).toBeGreaterThan(0);
    }
  });

  it('cost more at each level', () => {
    for (const id of NEST_UPGRADE_IDS) {
      const max = upgradeBalance[id].maxLevel ?? 10;
      for (let l = 1; l < max; l++) expect(getUpgradeCost(id, l)!, `${id} Lv.${l}`).toBeGreaterThan(getUpgradeCost(id, l - 1)!);
    }
  });

  it('are sold in Egg Laying only, up to their last level', () => {
    for (const id of NEST_UPGRADE_IDS) {
      expect(isUpgradeOpen(brood(), id), id).toBe(true);
      expect(isUpgradeOpen({ ...brood(), phase: Phase.COLONY }, id), id).toBe(false);
      const max = upgradeBalance[id].maxLevel;
      expect(max, id).toBeGreaterThan(0);
      expect(isUpgradeOpen(brood({ [id]: max! }), id), id).toBe(false);
    }
    expect(isUpgradeOpen({ ...brood(), phase: Phase.COLONY }, 'click_power')).toBe(true);
  });

  it('buying one takes its price in food and raises its level', () => {
    for (const id of NEST_UPGRADE_IDS) {
      const before = brood();
      const after = sys().buyUpgrade(before, id);
      expect(after.upgrades[id], id).toBe(1);
      expect(after.resources.food, id).toBe(before.resources.food - getUpgradeCost(id, 0)!);
    }
  });

  it('the action refuses one out of phase, at its last level, or unaffordable, and changes nothing', () => {
    for (const id of NEST_UPGRADE_IDS) {
      const cases: [GameState, string][] = [
        [{ ...brood(), phase: Phase.COLONY }, 'locked'],
        [brood({ [id]: upgradeBalance[id].maxLevel! }), 'max_level'],
        [{ ...brood(), resources: { ...brood().resources, food: getUpgradeCost(id, 0)! - 1 } }, 'cannot_afford'],
      ];
      for (const [s, reason] of cases) {
        let held = s;
        const r = testActions(new EventBus(), () => held, (next) => (held = next)).buyUpgrade(id);
        expect(r, `${id} ${reason}`).toEqual({ ok: false, reason });
        expect(held, `${id} ${reason}`).toBe(s);
      }
    }
  });

  it('warm brood: eggs hatch faster at each level', () => {
    const id: UpgradeId = 'warm_brood';
    expect(upgradeBalance[id].perLevel.hatchPercent).toBeGreaterThan(0);
    const dt = 10;
    const without = sys().tick(brood(), undefined, dt);
    const withIt = sys().tick(brood({ [id]: 1 }), undefined, dt);
    expect(withIt.resources.eggs).toBeLessThan(without.resources.eggs);
  });

  it('lean rations: each worker eats less at each level, and never nothing', () => {
    const id: UpgradeId = 'lean_rations';
    const max = upgradeBalance[id].maxLevel!;
    let prev = computeResourceRates(brood()).foodConsumedPerSec;
    for (let l = 1; l <= max; l++) {
      const now = computeResourceRates(brood({ [id]: l })).foodConsumedPerSec;
      expect(now, `Lv.${l}`).toBeLessThan(prev);
      expect(now, `Lv.${l}`).toBeGreaterThan(0);
      prev = now;
    }
  });

  it('side chamber: each level adds whole rooms to the nest', () => {
    const id: UpgradeId = 'side_chamber';
    const before = brood();
    const after = sys().buyUpgrade(before, id);
    expect(capacity(after)).toBeGreaterThan(capacity(before));
    expect(Number.isInteger(after.resources.nestCapacity)).toBe(true);
    expect(capacity(after) - capacity(before)).toBe(upgradeBalance[id].perLevel.nestCapacity);
  });

  it('an upgrade with no level does nothing: the base rates are unchanged', () => {
    const base = computeResourceRates(brood());
    const zero = computeResourceRates(brood(Object.fromEntries(NEST_UPGRADE_IDS.map((id) => [id, 0]))));
    expect(zero).toEqual(base);
  });

});
