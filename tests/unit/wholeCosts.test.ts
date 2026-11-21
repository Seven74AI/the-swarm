// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getBuildCost, getEffects, type BuildingType } from '../../src/systems/BuildingSystem';
import { getUpgradeCost } from '../../src/systems/ResourceSystem';
import { getEquipmentUpgradeCost } from '../../src/systems/SoldierSystem';
import { getAutoBuildCost, getResearchCost, type AutomationBuildingType, type ResearchType } from '../../src/systems/AutomationSystem';
import { getProjects } from '../../src/systems/ResearchSystem';
import { getMutationCost } from '../../src/systems/MutationSystem';
import { buildingBalance } from '../../src/data/balance/buildings';
import { mutationBalance } from '../../src/data/balance/mutations';
import { automationBalance } from '../../src/data/balance/automation';

/**
 * Story 3.3 (FR34): every cost is a whole number, so spending one can never
 * leave a fraction of a resource behind.
 *
 * 1. Every cost in `data/balance/` (any value under a key that names a cost,
 *    except the growth factors `…Multiplier`/`…Growth`) is an integer ≥ 0.
 *    New balance files are picked up automatically.
 * 2. The costs the systems derive from them (level scaling) are integers ≥ 0.
 * 3. Building effects that count things (nest rooms, recruit caps) are whole.
 */

const BALANCE = import.meta.glob<Record<string, unknown>>('../../src/data/balance/*.ts', { eager: true });

const COST_KEY = /cost/i;
const FACTOR_KEY = /multiplier|growth/i;

interface CostLeaf {
  path: string;
  value: unknown;
}

/** Every leaf value under a cost key, with its dotted path. */
export function costLeaves(value: unknown, path: string, inCost = false): CostLeaf[] {
  if (value === null || typeof value !== 'object') return inCost ? [{ path, value }] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
    if (FACTOR_KEY.test(k)) return [];
    return costLeaves(v, `${path}.${k}`, inCost || COST_KEY.test(k));
  });
}

const isWhole = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0;

describe('every cost is a whole number (Story 3.3)', () => {
  it('every cost table in data/balance/ holds only integers ≥ 0', () => {
    const files = Object.entries(BALANCE);
    expect(files.length).toBeGreaterThan(0);
    const leaves = files.flatMap(([file, mod]) =>
      Object.entries(mod).flatMap(([name, v]) => costLeaves(v, `${file.replace(/.*\//, '')}:${name}`)),
    );
    expect(leaves.length).toBeGreaterThan(0);
    const bad = leaves.filter((l) => !isWhole(l.value)).map((l) => `${l.path} = ${String(l.value)}`);
    expect(bad).toEqual([]);
  });

  it('no cost table spends entropy (a meter, never spent)', () => {
    const leaves = Object.entries(BALANCE).flatMap(([file, mod]) => costLeaves(mod, file));
    expect(leaves.filter((l) => /entropy/i.test(l.path.split('.').pop() ?? ''))).toEqual([]);
  });

  it('the scan finds costs at any depth and skips growth factors', () => {
    const sample = {
      a: { cost: { food: 1.5, wood: 2 } },
      b: { baseCost: 3, costMultiplier: 1.15 },
      scoutFoodCost: -1,
      rate: 0.5,
    };
    expect(costLeaves(sample, 's').map((l) => `${l.path}=${String(l.value)}`)).toEqual([
      's.a.cost.food=1.5',
      's.a.cost.wood=2',
      's.b.baseCost=3',
      's.scoutFoodCost=-1',
    ]);
  });

  const LEVELS = Array.from({ length: 31 }, (_, i) => i);
  const wholeValues = (o: object): boolean => Object.values(o).every((v) => v === undefined || isWhole(v));

  it('derived costs stay whole at every level', () => {
    const buildings = Object.keys(buildingBalance.baseCosts) as BuildingType[];
    const autoBuildings = Object.keys(automationBalance.buildings) as AutomationBuildingType[];
    for (const level of LEVELS) {
      for (const b of buildings) expect(wholeValues(getBuildCost(b, level)), `${b} Lv.${level}`).toBe(true);
      for (const b of autoBuildings) expect(wholeValues(getAutoBuildCost(b, level)), `${b} Lv.${level}`).toBe(true);
      expect(isWhole(getUpgradeCost('click_power', level)), `click power Lv.${level}`).toBe(true);
      expect(isWhole(getEquipmentUpgradeCost(level)), `equipment Lv.${level}`).toBe(true);
    }
    for (const r of Object.keys(automationBalance.research) as ResearchType[]) {
      expect(wholeValues(getResearchCost(r)), r).toBe(true);
    }
    for (const p of getProjects()) expect(wholeValues(p.cost), p.id).toBe(true);
    for (const m of Object.keys(mutationBalance)) expect(wholeValues(getMutationCost(m)), m).toBe(true);
  });

  it('building effects that count things are whole at every level', () => {
    for (const level of LEVELS) {
      const counts = {
        ...getEffects('warehouse', level),
        ...getEffects('barracks', level),
      };
      for (const key of ['nestCapacity', 'scoutsCap', 'warriorsCap']) {
        expect(isWhole(counts[key]), `${key} at Lv.${level} = ${counts[key]}`).toBe(true);
      }
    }
  });
});
