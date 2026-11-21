import { describe, it, expect } from 'vitest';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { processTick } from '../../../src/engine/processTick';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { getBuildCost, isBuildingOpen, isBuildingUnlocked, type BuildingType } from '../../../src/systems/BuildingSystem';
import { buildItems, getBuildAction, isItemAffordable } from '../../../src/systems/NextAction';
import { affordableKeys } from '../../../src/state/affordances';
import { BUILDING_UNLOCK_PHASE } from '../../../src/data/content/buildings';
import { FIRST_PRODUCED_IN, type ProducedResource } from '../../../src/data/content/producers';
import { PANEL_PLACEMENT, isUnlocked } from '../../../src/data/content/tabs';
import { CRITICAL_PATH } from '../../../src/data/content/criticalPath';
import { rolesForPhase } from '../../../src/data/content/roles';
import { enemyBalance } from '../../../src/data/balance/enemies';
import { testActions } from '../helpers/actions';
import { makeState } from '../helpers/makeState';

/**
 * Story 3.5 (FR7): Barracks, Walls and Warehouse (and Story 4.7's Fungus Garden and Tunnels) are on BUILD from Colony; Silk
 * Weaving, Chitin Armory and Venom Lab from Combat. Every resource a building
 * costs in a phase has a producer open in that phase or earlier.
 * Invariants only: amounts come from `getBuildCost`, never restated.
 */

const COLONY_BUILDINGS: readonly BuildingType[] = ['barracks', 'walls', 'warehouse', 'fungus_garden', 'tunnels'];
const COMBAT_BUILDINGS: readonly BuildingType[] = ['silk_weaving', 'chitin_armory', 'venom_lab', 'midden'];
const ALL_BUILDINGS = Object.keys(BUILDING_UNLOCK_PHASE) as BuildingType[];
/** Far enough up the levels to pass the Lv.5 surcharge a few times over. */
const LEVELS_PROBED = 15;

/** Enough of every resource to pay any level probed here. */
function rich(phase: Phase, overrides: Partial<GameState> = {}): GameState {
  const s = makeState({ phase, ...overrides } as never);
  const lots = 1e15;
  return {
    ...s,
    resources: { ...s.resources, food: lots, wood: lots, stone: lots, nectar: lots },
    combatResources: { ...s.combatResources, chitin: lots, silk: lots, venom: lots },
  };
}

const atLevel = (s: GameState, b: BuildingType, level: number): GameState => ({
  ...s,
  buildings: { ...s.buildings, [b]: { ...s.buildings[b], level } },
});

describe('which buildings BUILD lists in each phase (Story 3.5)', () => {
  it('Barracks, Walls and Warehouse open in Colony; Silk Weaving, Chitin Armory and Venom Lab in Combat', () => {
    for (const b of COLONY_BUILDINGS) expect(BUILDING_UNLOCK_PHASE[b]).toBe(Phase.COLONY);
    for (const b of COMBAT_BUILDINGS) expect(BUILDING_UNLOCK_PHASE[b]).toBe(Phase.COMBAT);
  });

  it('no building is open in Egg Laying, and each opens from its unlock phase on', () => {
    for (const b of ALL_BUILDINGS) {
      for (const phase of PHASE_ORDER) {
        expect(isBuildingUnlocked(b, phase)).toBe(isUnlocked(BUILDING_UNLOCK_PHASE[b], phase));
      }
      expect(isBuildingUnlocked(b, Phase.EGG_LAYING)).toBe(false);
    }
  });

  it('the building panel is on BUILD from Colony, the first phase with a building', () => {
    const first = PHASE_ORDER.find((p) => ALL_BUILDINGS.some((b) => isBuildingUnlocked(b, p)))!;
    expect(PANEL_PLACEMENT.building_panel.tab).toBe('build');
    expect(PANEL_PLACEMENT.building_panel.unlockPhase).toBe(first);
    expect(first).toBe(Phase.COLONY);
  });

  it('every building on a critical path is on sale in that phase', () => {
    for (const phase of PHASE_ORDER) {
      for (const ref of CRITICAL_PATH[phase]) {
        if (ref.kind === 'building') expect(isBuildingUnlocked(ref.id, phase), `${ref.id} in ${phase}`).toBe(true);
      }
    }
  });

  it('BUILD items in Colony are the colony buildings only; Combat adds the workshops', () => {
    const buildingsOn = (phase: Phase) =>
      buildItems(rich(phase))
        .filter((r) => r.kind === 'building')
        .map((r) => (r as { id: BuildingType }).id)
        .filter((id) => isItemAffordable(rich(phase), { kind: 'building', id }));
    expect(new Set(buildingsOn(Phase.COLONY))).toEqual(new Set(COLONY_BUILDINGS));
    expect(new Set(buildingsOn(Phase.COMBAT))).toEqual(new Set(ALL_BUILDINGS));
  });
});

describe('buying buildings in Colony (Story 3.5)', () => {
  it('the buy action levels a Colony building up and takes its price', () => {
    for (const b of COLONY_BUILDINGS) {
      let s = rich(Phase.COLONY);
      const a = testActions(new EventBus(), () => s, (n) => (s = n));
      const before = s;
      expect(a.buyBuilding(b).ok).toBe(true);
      expect(s.buildings[b].level).toBeGreaterThan(before.buildings[b].level);
      const cost = getBuildCost(b, before.buildings[b].level + 1);
      if (cost.food > 0) expect(s.resources.food).toBeLessThan(before.resources.food);
      if (cost.wood > 0) expect(s.resources.wood).toBeLessThan(before.resources.wood);
      if (cost.stone > 0) expect(s.resources.stone).toBeLessThan(before.resources.stone);
    }
  });

  it('refuses a workshop in Colony as locked, and changes nothing', () => {
    for (const b of COMBAT_BUILDINGS) {
      let s = rich(Phase.COLONY);
      const before = s;
      const a = testActions(new EventBus(), () => s, (n) => (s = n));
      expect(a.buyBuilding(b)).toEqual({ ok: false, reason: 'locked' });
      expect(s).toBe(before);
    }
  });

  it('sells the workshops from Combat', () => {
    for (const b of COMBAT_BUILDINGS) {
      let s = rich(Phase.COMBAT);
      const a = testActions(new EventBus(), () => s, (n) => (s = n));
      expect(a.buyBuilding(b).ok).toBe(true);
      expect(s.buildings[b].level).toBeGreaterThan(0);
    }
  });

  it('refuses every building in Egg Laying', () => {
    for (const b of ALL_BUILDINGS) {
      let s = rich(Phase.EGG_LAYING);
      const a = testActions(new EventBus(), () => s, (n) => (s = n));
      expect(a.buyBuilding(b)).toEqual({ ok: false, reason: 'locked' });
    }
  });

  it('a locked building never shows as affordable (tab dot) or as BUILD\'s pick', () => {
    const s = rich(Phase.COLONY);
    for (const b of COMBAT_BUILDINGS) expect(affordableKeys(s)).not.toContain(`building_panel:${b}`);
    for (const b of COLONY_BUILDINGS) expect(affordableKeys(s)).toContain(`building_panel:${b}`);
    const pick = getBuildAction(s);
    for (const b of COMBAT_BUILDINGS) expect(pick.kind === 'act' && pick.key).not.toBe(`building:${b}`);
  });
});

describe('every cost a building has in a phase is producible by then (Story 3.5, FR7)', () => {
  const costKeys = (b: BuildingType, level: number) =>
    (Object.entries(getBuildCost(b, level)) as [ProducedResource, number][]).filter(([, n]) => n > 0).map(([k]) => k);

  it('for each phase, building and level open there, every resource in the cost has a producer in that phase or earlier', () => {
    let checked = 0;
    for (const phase of PHASE_ORDER) {
      for (const b of ALL_BUILDINGS) {
        for (let level = 0; level < LEVELS_PROBED; level++) {
          const s = atLevel(rich(phase), b, level);
          if (!isBuildingOpen(b, s)) continue;
          checked++;
          for (const k of costKeys(b, level + 1)) {
            expect(FIRST_PRODUCED_IN[k], `${b} Lv.${level + 1} in ${phase} costs ${k}`).toBeDefined();
            expect(isUnlocked(FIRST_PRODUCED_IN[k], phase), `${b} Lv.${level + 1} in ${phase} costs ${k}`).toBe(true);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('every building is open at Lv.1 from its unlock phase (the check above is not vacuous)', () => {
    for (const b of ALL_BUILDINGS) {
      const phase = BUILDING_UNLOCK_PHASE[b];
      expect(isBuildingOpen(b, rich(phase)), `${b} in ${phase}`).toBe(true);
    }
  });

  it('a level whose cost needs a resource not yet produced stays closed until that resource has a producer', () => {
    // The Lv.5+ surcharge asks Colony buildings for combat resources.
    const closedSomewhere = COLONY_BUILDINGS.some((b) => {
      for (let level = 0; level < LEVELS_PROBED; level++) {
        const needs = costKeys(b, level + 1);
        if (needs.some((k) => !isUnlocked(FIRST_PRODUCED_IN[k], Phase.COLONY))) {
          expect(isBuildingOpen(b, atLevel(rich(Phase.COLONY), b, level))).toBe(false);
          const later = needs.map((k) => FIRST_PRODUCED_IN[k]).sort((x, y) => PHASE_ORDER.indexOf(y) - PHASE_ORDER.indexOf(x))[0]!;
          expect(isBuildingOpen(b, atLevel(rich(later), b, level))).toBe(true);
          return true;
        }
      }
      return false;
    });
    expect(closedSomewhere).toBe(true);
  });
});

describe('the producer table tells the truth (Story 3.5)', () => {
  const bus = new EventBus();
  const systems = {
    resource: new ResourceSystem(bus),
    soldier: new SoldierSystem(bus),
    map: new MapSystem(),
    territory: new TerritorySystem(),
  };

  /** Workers spread over every role open in the phase (unassigned ones forage food). */
  function busyNest(phase: Phase): GameState {
    const s = createInitialState();
    const jobs = rolesForPhase(phase).filter((r) => r.id !== 'research' && r.id !== 'guard');
    const per = 5;
    const assigned = { ...s.workersAssigned };
    for (const r of jobs) assigned[r.id as keyof typeof assigned] = per;
    return {
      ...s,
      phase,
      resources: { ...s.resources, workers: per * (jobs.length + 1), food: 5_000, nestCapacity: 1_000 },
      workersAssigned: assigned,
    };
  }

  function run(state: GameState, seconds: number): GameState {
    let s = state;
    const stepSec = 0.05;
    for (let i = 0; i < Math.round(seconds / stepSec); i++) {
      s = processTick(s, systems.resource, systems.soldier, systems.map, systems.territory, new EventQueue(), stepSec);
    }
    return s;
  }

  it('the basic resources go up from their listed phase, with no territory', () => {
    for (const k of ['food', 'wood', 'stone', 'nectar'] as const) {
      const before = busyNest(FIRST_PRODUCED_IN[k]);
      const after = run(before, 20);
      expect(after.resources[k], `${k} in ${FIRST_PRODUCED_IN[k]}`).toBeGreaterThan(before.resources[k]);
    }
  });

  it('the combat resources drop from battles, which open in their listed phase', () => {
    const drops = new Set(
      Object.values(enemyBalance.stats)
        .map((e) => ("specialResource" in e.loot ? e.loot.specialResource.type : undefined))
        .filter(Boolean),
    );
    for (const k of ['chitin', 'silk', 'venom'] as const) {
      expect(drops.has(k), `${k} drops`).toBe(true);
      expect(isUnlocked(PANEL_PLACEMENT.battle_panel.unlockPhase, FIRST_PRODUCED_IN[k])).toBe(true);
    }
  });
});
