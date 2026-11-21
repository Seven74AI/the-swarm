// @vitest-environment node
/**
 * Story 4.10 (FR16, UX-DR16): automation takes over verbs the player has
 * already done by hand.
 *
 * Invariants only: the unlock rule (N manual performances, N from
 * `automationBalance.targets`, or the phase after the verb's own), the colony
 * works toward a target and never past it, says why when it can't, works the
 * same offline, keeps the manual counts in the save and never answers a
 * decision event.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';
import { EventQueue } from '../../src/engine/events';
import { processTick } from '../../src/engine/processTick';
import { catchUp, type CatchUpDeps } from '../../src/engine/catchUp';
import { createActions, type Actions } from '../../src/actions';
import { ResourceSystem, isStarving } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../src/phases/transitions';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import {
  automationCount,
  automationStatus,
  isAutomationActive,
  isAutomationShown,
  isAutomationUnlocked,
  tickAutomationTargets,
} from '../../src/systems/AutomationTargets';
import { AUTOMATION_VERBS, type AutomationVerb } from '../../src/data/content/automation';
import { automationBalance } from '../../src/data/balance/automation';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { combatBalance } from '../../src/data/balance/combat';
import { DECISIONS } from '../../src/data/content/decisions';
import { HOUR_MS, TICK_MS } from '../../src/data/constants';

const N = automationBalance.targets.unlockAfterManual;

/** A colony in `phase` with `workers` idle workers, food in store and a barracks. */
function colony(phase: Phase, over: { workers?: number; food?: number } = {}): GameState {
  const s = createInitialState();
  const workers = over.workers ?? 40;
  return {
    ...s,
    phase,
    resources: { ...s.resources, workers, nestCapacity: workers + 20, food: over.food ?? 100_000 },
    workersAssigned: { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
    buildings: { ...s.buildings, barracks: { level: 2, count: 0 } },
  };
}

/** The same state with `verb` learned (N manual performances) and its row at `target`, AUTO on. */
function auto(s: GameState, verb: AutomationVerb, target: number, on = true): GameState {
  const a = s.automation;
  return {
    ...s,
    automation: { ...a, performed: { ...a.performed, [verb]: N }, targets: { ...a.targets, [verb]: { target, on } } },
  };
}

function systems() {
  const bus = new EventBus();
  return { bus, resources: new ResourceSystem(bus), soldiers: new SoldierSystem(bus), map: new MapSystem(), territory: new TerritorySystem() };
}

function tick(s: GameState, dtSec: number): GameState {
  const d = systems();
  return processTick(s, d.resources, d.soldiers, d.map, d.territory, new EventQueue(), dtSec);
}

function harness(initial: GameState): { actions: Actions; get: () => GameState } {
  let state = initial;
  const d = systems();
  const actions = createActions({
    bus: d.bus, resourceSystem: d.resources, soldierSystem: d.soldiers, battleSystem: new BattleSystem(d.bus), territorySystem: d.territory,
    store: { get: () => state, set: (s) => { state = s; } },
  });
  return { actions, get: () => state };
}

function catchUpDeps(): CatchUpDeps {
  const d = systems();
  const fsm = new PhaseStateMachine(TRANSITIONS);
  return { resourceSystem: d.resources, soldierSystem: d.soldiers, mapSystem: d.map, territorySystem: d.territory, latch: (s) => fsm.latch(s) };
}

describe('the automation balance lives in data/balance/', () => {
  it('N is a whole number of manual performances, and a target fits under the maximum', () => {
    const t = automationBalance.targets;
    expect(Number.isInteger(t.unlockAfterManual)).toBe(true);
    expect(t.unlockAfterManual).toBeGreaterThan(0);
    expect(t.defaultTarget).toBeLessThanOrEqual(t.maxTarget);
    expect(t.layTapsPerSec).toBeGreaterThan(0);
  });
});

describe('a verb becomes automatable after N manual performances, or the phase after its own', () => {
  it('no row in a new game', () => {
    const s = createInitialState();
    for (const v of AUTOMATION_VERBS) expect(isAutomationUnlocked(s, v.id), v.id).toBe(false);
  });

  it('opens at N performances, not one sooner', () => {
    for (const v of AUTOMATION_VERBS) {
      const s = colony(v.introducedIn);
      const at = (n: number): GameState => ({ ...s, automation: { ...s.automation, performed: { ...s.automation.performed, [v.id]: n } } });
      expect(isAutomationUnlocked(at(N - 1), v.id), `${v.id} at N − 1`).toBe(false);
      expect(isAutomationUnlocked(at(N), v.id), `${v.id} at N`).toBe(true);
      expect(isAutomationShown(at(N), v.id), `${v.id} shows in its own phase`).toBe(true);
    }
  });

  it('opens without any performance from the phase after the one that introduced it', () => {
    for (const v of AUTOMATION_VERBS) {
      const i = PHASE_ORDER.indexOf(v.introducedIn);
      expect(isAutomationUnlocked(colony(v.introducedIn), v.id), `${v.id} in its own phase`).toBe(false);
      for (const later of PHASE_ORDER.slice(i + 1)) expect(isAutomationUnlocked(colony(later), v.id), `${v.id} in ${later}`).toBe(true);
    }
  });

  it('a row never shows before its verb has a screen', () => {
    for (const v of AUTOMATION_VERBS) {
      for (const earlier of PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(v.introducedIn))) {
        const s = colony(earlier);
        const learned = { ...s, automation: { ...s.automation, performed: { ...s.automation.performed, [v.id]: N * 5 } } };
        expect(isAutomationShown(learned, v.id), `${v.id} in ${earlier}`).toBe(false);
        expect(isAutomationActive(auto(learned, v.id, 50), v.id), `${v.id} works in ${earlier}`).toBe(false);
      }
    }
  });

  it('each manual LAY EGG, TRAIN and RECRUIT counts, in the same write as the verb', () => {
    const h = harness(colony(Phase.EXPANSION));
    const performed = () => h.get().automation.performed;
    const before = performed();
    expect(h.actions.layEgg().ok).toBe(true);
    expect(h.actions.trainSoldier().ok).toBe(true);
    expect(h.actions.recruitScout().ok).toBe(true);
    expect(h.actions.recruitWarrior().ok).toBe(true);
    expect(performed().lay).toBe(before.lay + 1);
    expect(performed().train).toBe(before.train + 1);
    expect(performed().scout).toBe(before.scout + 1);
    expect(performed().warrior).toBe(before.warrior + 1);
  });

  it('a refused verb does not count', () => {
    const h = harness(colony(Phase.COMBAT, { food: 0 }));
    const before = h.get().automation.performed.train;
    expect(h.actions.trainSoldier().ok).toBe(false);
    expect(h.get().automation.performed.train).toBe(before);
  });
});

describe('the target row is set through actions', () => {
  it('a locked row refuses both the target and AUTO', () => {
    const h = harness(createInitialState());
    const before = h.get();
    expect(h.actions.setAutomationTarget('lay', 20)).toEqual({ ok: false, reason: 'locked' });
    expect(h.actions.setAutomation('lay', true)).toEqual({ ok: false, reason: 'locked' });
    expect(h.get()).toBe(before);
  });

  it('an open row takes a whole target within 0..max and toggles AUTO', () => {
    const h = harness(colony(Phase.COMBAT));
    expect(h.actions.setAutomationTarget('lay', 25).ok).toBe(true);
    expect(h.get().automation.targets.lay.target).toBe(25);
    expect(h.actions.setAutomation('lay', true).ok).toBe(true);
    expect(h.get().automation.targets.lay.on).toBe(true);
    expect(h.actions.setAutomation('lay', false).ok).toBe(true);
    expect(h.get().automation.targets.lay.on).toBe(false);
    expect(h.actions.setAutomationTarget('lay', -3).ok).toBe(false);
    expect(h.actions.setAutomationTarget('lay', automationBalance.targets.maxTarget + 1).ok).toBe(false);
    expect(h.actions.setAutomationTarget('lay', 2.5).ok).toBe(false);
    expect(h.get().automation.targets.lay.target).toBe(25);
  });
});

describe('with AUTO on, the colony works toward the target and never past it', () => {
  it('lay: the brood fills up to the target and holds there', () => {
    const target = 30;
    let s = auto(colony(Phase.COLONY), 'lay', target);
    let hit = false;
    for (let i = 0; i < 2_000; i++) {
      s = tick(s, i % 2 === 0 ? TICK_MS / 1000 : 1);
      expect(automationCount(s, 'lay')).toBeLessThanOrEqual(target);
      if (automationCount(s, 'lay') === target) hit = true;
    }
    expect(hit).toBe(true);
    expect(automationStatus(s, 'lay')).toEqual({ kind: 'holding', count: automationCount(s, 'lay') });
  });

  it('lay: the queen lays on her own slower than a player taps', () => {
    const s = auto(colony(Phase.COLONY), 'lay', automationBalance.targets.maxTarget);
    const after = tick(s, 60);
    const laid = after.stats.totalEggsLaid - s.stats.totalEggsLaid;
    expect(laid).toBeGreaterThan(0);
    expect(after.stats.totalClicks).toBe(s.stats.totalClicks); // no tap
    // Fewer eggs a second than one tap a second would lay.
    expect(automationBalance.targets.layTapsPerSec).toBeLessThan(1);
  });

  it('lay: a brood already over the target lays nothing', () => {
    const s = colony(Phase.COLONY);
    const full = auto({ ...s, resources: { ...s.resources, eggs: 50 }, eggPipeline: { count: 50, progress: 0 } }, 'lay', 10);
    const after = tick(full, 10);
    expect(after.stats.totalEggsLaid).toBe(full.stats.totalEggsLaid);
  });

  it('train: the army (trained and training) reaches the target and stops there, paying as TRAIN pays', () => {
    const target = 12;
    const s = auto(colony(Phase.COMBAT), 'train', target);
    const after = tick(s, TICK_MS / 1000);
    expect(automationCount(after, 'train')).toBe(target);
    const trained = automationCount(after, 'train') - automationCount(s, 'train');
    expect(after.resources.workers).toBe(s.resources.workers - trained * combatBalance.army.workersPerSoldier);
    expect(after.resources.food).toBeLessThanOrEqual(s.resources.food - trained * soldierBalance.costFood + 1);
    // Holding: the next step trains no one.
    const next = tick(after, TICK_MS / 1000);
    expect(automationCount(next, 'train')).toBe(target);
    expect(automationStatus(next, 'train').kind).toBe('holding');
  });

  it('train: losses are refilled, up to the target', () => {
    const s = { ...auto(colony(Phase.COMBAT), 'train', 10), combatSoldiers: 4 };
    expect(automationCount(tick(s, TICK_MS / 1000), 'train')).toBe(10);
  });

  it('train: a short colony holds where it is and says why (food short, no free workers)', () => {
    const poor = auto(colony(Phase.COMBAT, { food: soldierBalance.costFood * 3 }), 'train', 20);
    const a = tick(poor, TICK_MS / 1000);
    expect(automationCount(a, 'train')).toBeLessThan(20);
    expect(automationCount(a, 'train')).toBeGreaterThan(0);
    expect(automationStatus(a, 'train')).toMatchObject({ kind: 'blocked', block: 'food_short' });

    const busy = colony(Phase.COMBAT, { workers: 5 });
    const allBusy = auto({ ...busy, workersAssigned: { ...busy.workersAssigned, gather: 5 } }, 'train', 20);
    const b = tick(allBusy, TICK_MS / 1000);
    expect(automationCount(b, 'train')).toBe(0);
    expect(automationStatus(b, 'train')).toMatchObject({ kind: 'blocked', block: 'no_free_workers' });
  });

  it('train: a starving colony trains no one, whatever it holds', () => {
    const s = colony(Phase.COMBAT, { food: 0 });
    const starving = auto({ ...s, combatSoldiers: 200 }, 'train', 300);
    expect(isStarving(starving, new TerritorySystem().getBonuses(starving))).toBe(true);
    const out = tickAutomationTargets(starving, TICK_MS / 1000, new EventQueue(), new TerritorySystem().getBonuses(starving));
    expect(automationCount(out, 'train')).toBe(automationCount(starving, 'train'));
    expect(automationStatus(out, 'train', new TerritorySystem().getBonuses(out))).toMatchObject({ kind: 'blocked', block: 'food_short' });
  });

  it('scouts and warriors: recruited to the target, within the barracks cap', () => {
    const s = auto(auto(colony(Phase.EXPANSION), 'scout', 99), 'warrior', 1);
    const after = tick(s, TICK_MS / 1000);
    expect(after.soldiers.warriors).toBe(1);
    expect(after.soldiers.scouts).toBeGreaterThan(0);
    expect(automationStatus(after, 'scout')).toMatchObject({ kind: 'blocked', block: 'barracks_full' });
    expect(automationStatus(after, 'warrior').kind).toBe('holding');
    // Scouts away on an expedition still count: none are recruited to replace them.
    const kept = auto(after, 'scout', after.soldiers.scouts);
    const sent = { ...kept, soldiers: { ...kept.soldiers, scouts: 0 }, expeditions: [{ ...expedition(), scouts: kept.soldiers.scouts }] };
    expect(tick(sent, TICK_MS / 1000).soldiers.scouts).toBe(0);
  });

  it('AUTO off: nothing happens, whatever the target', () => {
    const s = auto(auto(colony(Phase.EXPANSION), 'train', 20, false), 'lay', 999, false);
    const after = tick(s, 5);
    expect(automationCount(after, 'train')).toBe(0);
    expect(after.stats.totalEggsLaid).toBe(s.stats.totalEggsLaid);
    expect(automationStatus(after, 'train').kind).toBe('off');
  });
});

function expedition() {
  return { id: 'exp-1', scouts: 0, warriors: 0, destination: 'FOREST', status: 'running' as const, remainingMs: HOUR_MS, durationMs: HOUR_MS, risk: 0 };
}

describe('offline runs the same targets', () => {
  it('a catch-up trains to the target and lays toward the brood target, never past either', () => {
    const s = auto(auto(colony(Phase.COMBAT), 'train', 15), 'lay', 40);
    const out = catchUp(s, 2 * HOUR_MS, Math.floor((2 * HOUR_MS) / TICK_MS), catchUpDeps());
    expect(automationCount(out, 'train')).toBe(15);
    expect(automationCount(out, 'lay')).toBeLessThanOrEqual(40);
    expect(out.stats.totalEggsLaid).toBeGreaterThan(s.stats.totalEggsLaid);
  });

  it('the offline starvation floor never hands back the workers automation trained', () => {
    const s = auto(colony(Phase.COMBAT, { workers: 40 }), 'train', 30);
    const out = catchUp(s, HOUR_MS, Math.floor(HOUR_MS / TICK_MS), catchUpDeps());
    const army = automationCount(out, 'train');
    expect(army).toBeGreaterThan(0);
    // No worker is made from nothing: the workers left are those there, less the trainees, plus those born.
    expect(out.resources.workers).toBe(s.resources.workers - army * combatBalance.army.workersPerSoldier
      + (out.stats.totalEggsLaid - s.stats.totalEggsLaid) - (out.resources.eggs - s.resources.eggs) - (out.resources.larvae - s.resources.larvae));
  });
});

describe('automation never answers a decision event', () => {
  it('an open decision is left exactly as it was, live and offline', () => {
    const s0 = auto(auto(auto(colony(Phase.EXPANSION), 'lay', 999), 'train', 50), 'scout', 3);
    const open = { id: DECISIONS[0].id, remainingMs: null, openedAtSessionMs: 0, roll: 0.5 };
    const s = { ...s0, decision: { open, nextSpawnSessionMs: null } };
    expect(tick(s, 10).decision).toBe(s.decision);
    expect(tickAutomationTargets(s, 10, new EventQueue()).decision).toBe(s.decision);
    expect(catchUp(s, HOUR_MS, Math.floor(HOUR_MS / TICK_MS), catchUpDeps()).decision).toEqual(s.decision);
  });
});
