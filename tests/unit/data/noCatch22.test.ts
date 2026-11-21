import { describe, it, expect } from 'vitest';
import type { GameState } from '../../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { processTick } from '../../../src/engine/processTick';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { isLevelPayableIn, type BuildingType } from '../../../src/systems/BuildingSystem';
import { isItemAffordable, itemCost, itemKey, listItems, type ItemRef } from '../../../src/systems/NextAction';
import { MUTATIONS } from '../../../src/systems/MutationSystem';
import { RESEARCHES, type ResearchType } from '../../../src/systems/AutomationSystem';
import { getProjects } from '../../../src/systems/ResearchSystem';
import { getConversionDefs, getConversionRate, isConversionUnlocked } from '../../../src/systems/ResourceConversionSystem';
import { getBuildCost as getFleetBuildCost, getUpgradeCost as getFleetUpgradeCost, type SpaceshipType } from '../../../src/systems/SpaceshipSystem';
import { resolveExpedition } from '../../../src/systems/ExpeditionSystem';
import { isPrestigeAvailable, prestige } from '../../../src/systems/PrestigeSystem';
import { PRESTIGE_UPGRADES } from '../../../src/data/prestigeTree';
import { FIRST_PRODUCED_IN, type ProducedResource } from '../../../src/data/content/producers';
import { PANEL_PLACEMENT, isUnlocked, type PanelId } from '../../../src/data/content/tabs';
import { soldierBalance } from '../../../src/data/balance/soldiers';
import { resourceBalance } from '../../../src/data/balance/resources';
import type { RngStream } from '../../../src/utils/rng';
import { testActions } from '../helpers/actions';
import { makeState } from '../helpers/makeState';

/**
 * Story 3.6 (FR37), the catch-22 rule: no feature costs a resource whose
 * earliest producer opens after the feature does. The content tables are the
 * real ones (every item the next-action rule sells, the fleet ships, the
 * converter's inputs, the Legacy nodes); the producer table is
 * `FIRST_PRODUCED_IN`, and its entries are checked against the real
 * producers. Invariants only: no amount is restated here.
 */

/** Levels probed for the items bought again and again. */
const LEVELS_PROBED = 12;
const LOTS = 1e15;

const panelPhase = (panel: PanelId): Phase => PANEL_PLACEMENT[panel].unlockPhase;
const producedBy = (k: string, phase: Phase): boolean =>
  k in FIRST_PRODUCED_IN && isUnlocked(FIRST_PRODUCED_IN[k as ProducedResource], phase);

/** Enough of every stock, workers and researchers to pay anything, in `phase`. */
function rich(phase: Phase): GameState {
  const s = makeState({ phase } as never);
  return {
    ...s,
    resources: {
      ...s.resources,
      food: LOTS,
      wood: LOTS,
      stone: LOTS,
      nectar: LOTS,
      voidCrystals: LOTS,
      antimatter: LOTS,
      darkMatter: LOTS,
      workers: LOTS,
      nestCapacity: LOTS,
    },
    workersAssigned: { ...s.workersAssigned, researchers: 1e6 },
    combatResources: { chitin: LOTS, silk: LOTS, venom: LOTS },
    prestige: { ...s.prestige, legacyPoints: LOTS },
  };
}

/** The states in which to look at an item: each level probed, prerequisites met. */
function probes(ref: ItemRef, phase: Phase): GameState[] {
  const s = rich(phase);
  const levels = Array.from({ length: LEVELS_PROBED }, (_, i) => i);
  switch (ref.kind) {
    case 'upgrade':
      return levels.map((l) => ({ ...s, upgrades: { ...s.upgrades, [ref.id]: l } }));
    case 'building':
      return levels.map((l) => ({ ...s, buildings: { ...s.buildings, [ref.id]: { ...s.buildings[ref.id], level: l } } }));
    case 'equipment':
      return levels.map((l) => ({
        ...s,
        buildings: { ...s.buildings, chitin_armory: { level: 1 }, silk_weaving: { level: 1 } },
        equipment: { ...s.equipment, [ref.id]: l },
      }));
    case 'ship':
      return levels.map((l) => ({ ...s, spaceship: { ...s.spaceship, level: l } }));
    case 'auto_building':
      return levels.map((l) => ({
        ...s,
        autoProduction: { ...s.autoProduction, buildings: { ...s.autoProduction.buildings, [ref.id]: l } },
      }));
    case 'particle_lab':
      return levels.map((l) => ({ ...s, conversions: { ...s.conversions, particleLab: l } }));
    case 'mutation':
      return [{ ...s, mutations: MUTATIONS.map((m) => ({ id: m.id, purchased: m.id !== ref.id })) }];
    case 'research': {
      const projects = { ...s.research.projects };
      for (const p of getProjects()) projects[p.id] = p.id === ref.id ? { status: 'idle' } : { status: 'done' };
      return [{ ...s, research: { ...s.research, projects } }];
    }
    case 'auto_research': {
      const researches = Object.fromEntries(
        (Object.keys(RESEARCHES) as ResearchType[]).filter((r) => r !== ref.id).map((r) => [r, true]),
      );
      return [{ ...s, autoProduction: { ...s.autoProduction, researches: { ...s.autoProduction.researches, ...researches } } }];
    }
  }
}

describe('no feature costs a resource nothing makes yet (Story 3.6, FR37)', () => {
  it('every item, in every phase and level it is on sale, costs only resources produced by that phase', () => {
    const sold = new Set<string>();
    const bad: string[] = [];
    for (const phase of PHASE_ORDER) {
      for (const ref of listItems()) {
        for (const s of probes(ref, phase)) {
          if (!isItemAffordable(s, ref)) continue;
          sold.add(itemKey(ref));
          for (const k of Object.keys(itemCost(s, ref) ?? {})) {
            if (!producedBy(k, phase)) bad.push(`${itemKey(ref)} in ${phase} costs ${k}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
    // Not vacuous: every item is on sale somewhere.
    expect([...sold].sort()).toEqual(listItems().map(itemKey).sort());
  });

  it('the fleet ships cost only resources produced by the phase that shows them', () => {
    const phase = panelPhase('spaceship_panel');
    const types: SpaceshipType[] = ['scout_ship', 'cruiser', 'capital_ship'];
    for (const t of types) {
      const costs = [getFleetBuildCost(t, 1), ...[1, 2, 3, 4].map((l) => getFleetUpgradeCost(t, l))];
      for (const cost of costs) {
        for (const [k, n] of Object.entries(cost)) {
          if (n > 0) expect(producedBy(k, phase), `${t} in ${phase} costs ${k}`).toBe(true);
        }
      }
    }
  });

  it('the scout ship bootstraps from expedition drops: each space resource it costs drops on an expedition, before the ships open', () => {
    const scout = getFleetBuildCost('scout_ship', 1);
    const space = (['voidCrystals', 'antimatter', 'darkMatter'] as const).filter((k) => scout[k] > 0);
    expect(space).toContain('voidCrystals');
    for (const k of space) {
      expect(FIRST_PRODUCED_IN[k]).toBe(panelPhase('expedition_panel'));
      expect(isUnlocked(FIRST_PRODUCED_IN[k], panelPhase('spaceship_panel'))).toBe(true);
    }
  });

  it('the converter consumes only resources produced by the phase that shows it', () => {
    const phase = panelPhase('resource_converter_panel');
    for (const def of getConversionDefs()) {
      for (const k of Object.keys(def.inputs)) expect(producedBy(k, phase), `${def.id} uses ${k}`).toBe(true);
    }
  });

  it('training a combat soldier costs only food, produced before the battles open', () => {
    expect(soldierBalance.costFood).toBeGreaterThan(0);
    expect(producedBy('food', panelPhase('soldier_panel'))).toBe(true);
    expect(producedBy('workers', panelPhase('soldier_panel'))).toBe(true);
  });

  it('Legacy nodes cost Legacy points, and the Legacy shop only opens when prestige can earn them', () => {
    for (const u of PRESTIGE_UPGRADES) expect(u.cost).toBeGreaterThan(0);
    const first = FIRST_PRODUCED_IN.legacyPoints;
    // The shop opens with a prestige behind the run or one available now (`selectLegacyUnlocked`);
    // prestige is never available before the listed phase, because its building levels can't be paid there.
    for (const phase of PHASE_ORDER) {
      expect(prestigeReachableIn(phase), `prestige in ${phase}`).toBe(isUnlocked(first, phase));
    }
  });
});

/** The smallest building levels that make prestige available, found by search, and whether each is payable in `phase`. */
function prestigeReachableIn(phase: Phase): boolean {
  const base = rich(phase);
  const s: GameState = {
    ...base,
    prestige: { ...base.prestige, totalFoodProduced: LOTS, totalWoodProduced: LOTS, totalStoneProduced: LOTS, totalNectarProduced: LOTS },
  };
  const ids = Object.keys(s.buildings) as BuildingType[];
  const at = (levels: Record<BuildingType, number>): GameState => ({
    ...s,
    buildings: Object.fromEntries(ids.map((b) => [b, { ...s.buildings[b], level: levels[b] }])) as GameState['buildings'],
  });
  // Raise every building together until prestige opens, then lower each one as far as it still holds.
  let n = 0;
  while (!isPrestigeAvailable(at(Object.fromEntries(ids.map((b) => [b, n])) as Record<BuildingType, number>))) {
    n++;
    if (n > 100) throw new Error('prestige never opens');
  }
  const levels = Object.fromEntries(ids.map((b) => [b, n])) as Record<BuildingType, number>;
  for (const b of ids) {
    while (levels[b] > 0 && isPrestigeAvailable(at({ ...levels, [b]: levels[b] - 1 }))) levels[b]--;
  }
  return ids.every((b) => Array.from({ length: levels[b] }, (_, i) => i + 1).every((l) => isLevelPayableIn(b, l, phase)));
}

describe('the Particle Lab the antimatter step needs is sold (Story 3.6)', () => {
  const lab: ItemRef = { kind: 'particle_lab' };

  it('is on sale where the converter is, from Lv.1 on', () => {
    const phase = panelPhase('resource_converter_panel');
    expect(listItems().map(itemKey)).toContain(itemKey(lab));
    expect(isItemAffordable(rich(phase), lab)).toBe(true);
    const before = PHASE_ORDER[PHASE_ORDER.indexOf(phase) - 1]!;
    expect(isItemAffordable(rich(before), lab)).toBe(false);
  });

  it('buying one takes its price and starts the researched antimatter step', () => {
    const phase = panelPhase('resource_converter_panel');
    const base = rich(phase);
    let s: GameState = {
      ...base,
      research: {
        ...base.research,
        projects: { ...base.research.projects, antimatterContainment: { status: 'done' }, voidCrystalSynthesis: { status: 'done' } },
      },
    };
    expect(isConversionUnlocked(s, 'antimatterContainment')).toBe(false);
    const before = s;
    const a = testActions(new EventBus(), () => s, (n) => (s = n));
    expect(a.buildParticleLab().ok).toBe(true);
    expect(s.conversions.particleLab).toBeGreaterThan(before.conversions.particleLab);
    const cost = itemCost(before, lab)!;
    expect(Object.keys(cost).length).toBeGreaterThan(0);
    for (const k of Object.keys(cost) as (keyof GameState['resources'])[]) {
      expect(s.resources[k]).toBeLessThan(before.resources[k]);
    }
    expect(isConversionUnlocked(s, 'antimatterContainment')).toBe(true);
    expect(getConversionRate(s, 'antimatterContainment')).toBeGreaterThan(0);
  });

  it('refuses before the converter opens, and when the stocks fall short, changing nothing', () => {
    const early = PHASE_ORDER[PHASE_ORDER.indexOf(panelPhase('resource_converter_panel')) - 1]!;
    let s = rich(early);
    let before = s;
    let a = testActions(new EventBus(), () => s, (n) => (s = n));
    expect(a.buildParticleLab()).toEqual({ ok: false, reason: 'locked' });
    expect(s).toBe(before);
    s = makeState({ phase: panelPhase('resource_converter_panel') } as never);
    before = s;
    a = testActions(new EventBus(), () => s, (n) => (s = n));
    expect(a.buildParticleLab()).toEqual({ ok: false, reason: 'cannot_afford' });
    expect(s).toBe(before);
  });
});

describe('the producer table tells the truth (Story 3.6)', () => {
  it('lists every resource any cost names', () => {
    const named = new Set<string>();
    for (const phase of PHASE_ORDER) {
      for (const ref of listItems()) {
        for (const s of probes(ref, phase)) for (const k of Object.keys(itemCost(s, ref) ?? {})) named.add(k);
      }
    }
    for (const k of named) expect(FIRST_PRODUCED_IN, k).toHaveProperty(k);
  });

  it('workers hatch from the eggs laid in Egg Laying', () => {
    expect(FIRST_PRODUCED_IN.workers).toBe(Phase.EGG_LAYING);
    const bus = new EventBus();
    let s = makeState({ phase: Phase.EGG_LAYING } as never);
    s = { ...s, resources: { ...s.resources, food: 5_000 } };
    const a = testActions(bus, () => s, (n) => (s = n));
    for (let i = 0; i < 20; i++) expect(a.layEgg().ok).toBe(true);
    const before = s.resources.workers;
    const systems = [new ResourceSystem(bus), new SoldierSystem(bus), new MapSystem(), new TerritorySystem()] as const;
    // Twice the mean hatch-and-mature time (read from the balance), in 10 s steps.
    const steps = Math.ceil((2 * (resourceBalance.hatchMs + resourceBalance.matureMs)) / 10_000);
    for (let i = 0; i < steps; i++) s = processTick(s, ...systems, new EventQueue(), 10);
    expect(s.resources.workers).toBeGreaterThan(before);
  });

  it('void crystals, antimatter and dark matter drop on expeditions, which open in their listed phase', () => {
    // First draw: the outcome (a full success); every later draw: a drop roll that hits.
    let draws = 0;
    const rng: RngStream = { state: 0, float: () => (draws++ === 0 ? 0.999 : 0) };
    const s0 = makeState({ phase: Phase.EXPANSION } as never);
    const exp = { id: 'e1', destination: 'FOREST', scouts: 1, warriors: 0, risk: 0, status: 'running', remainingMs: 0, durationMs: 1 };
    const s: GameState = { ...s0, expeditions: [exp as GameState['expeditions'][number]] };
    const after = resolveExpedition(s, s.expeditions[0]!, rng);
    for (const k of ['voidCrystals', 'antimatter', 'darkMatter'] as const) {
      expect(after.resources[k], k).toBeGreaterThan(s.resources[k]);
      expect(FIRST_PRODUCED_IN[k]).toBe(panelPhase('expedition_panel'));
    }
  });

  it('prestige pays Legacy points', () => {
    const s = rich(FIRST_PRODUCED_IN.legacyPoints);
    const ready: GameState = {
      ...s,
      prestige: { ...s.prestige, legacyPoints: 0, totalFoodProduced: LOTS, totalWoodProduced: LOTS, totalStoneProduced: LOTS, totalNectarProduced: LOTS },
      buildings: Object.fromEntries(Object.entries(s.buildings).map(([b, v]) => [b, { ...v, level: 20 }])) as GameState['buildings'],
    };
    expect(isPrestigeAvailable(ready)).toBe(true);
    expect(prestige(ready).prestige.legacyPoints).toBeGreaterThan(0);
  });
});
