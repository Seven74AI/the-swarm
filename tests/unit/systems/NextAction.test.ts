import { describe, it, expect } from 'vitest';
import {
  getNextAction,
  isBroodOnly,
  isCapacityCritical,
  itemCost,
  itemKey,
  isItemAffordable,
  listItems,
  type ItemRef,
  type NextAction,
  type SuggestedAction,
} from '../../../src/systems/NextAction';
import { CRITICAL_PATH } from '../../../src/data/content/criticalPath';
import { PANEL_PLACEMENT, isUnlocked } from '../../../src/data/content/tabs';
import { nextActionBalance } from '../../../src/data/balance/nextAction';
import { MS_PER_SEC } from '../../../src/data/constants';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import { goalFor } from '../../../src/phases/transitions';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { computeResourceRates, getAssignedWorkers } from '../../../src/systems/ResourceSystem';
import { getEffects } from '../../../src/systems/BuildingSystem';
import type { GameState } from '../../../src/state/GameState';
import { makeState, type StateOverrides } from '../helpers/makeState';
import { testActions } from '../helpers/actions';
import { EventBus } from '../../../src/engine/EventBus';
import fc from 'fast-check';
import { arbState } from '../helpers/randomPlay';

/**
 * Story 1.21 (UX-DR12): `getNextAction(state)` picks the one most useful next
 * action. First match wins: goal met → CONTINUE; food critical → the
 * allocation fix; capacity critical → DIG or Warehouse; an affordable
 * critical-path item; any affordable item; otherwise none, with the next
 * affordable item and how long until it is. Thresholds come from
 * `data/balance/nextAction.ts`; costs come from the systems.
 */

const fsm = new PhaseStateMachine();

function act(n: NextAction): SuggestedAction {
  if (n.kind !== 'act') throw new Error(`expected a suggestion, got ${JSON.stringify(n)}`);
  return n;
}

/** Run the suggestion through the real action and return the new state (fails the test on a refusal). */
function perform(s: GameState, n: NextAction): GameState {
  let cur = s;
  const actions = testActions(new EventBus(), () => cur, (next) => {
    cur = next;
  });
  const r = actions.perform(act(n).intent);
  expect(r).toEqual({ ok: true });
  return cur;
}

/** Add exactly an item's cost to the state's stock, on top of what it has (unchanged when it can't be bought now). */
function withCost(s: GameState, ref: ItemRef): GameState {
  const cost = itemCost(s, ref);
  if (!cost) return s;
  const resources = { ...s.resources };
  const combat = { ...s.combatResources };
  for (const [k, v] of Object.entries(cost)) {
    if (k in combat) combat[k as keyof typeof combat] += v;
    else resources[k as keyof typeof resources] += v;
  }
  return { ...s, resources, combatResources: combat };
}

/** A colony with some workers, food not critical and capacity free. */
function colony(over: StateOverrides = {}): GameState {
  return makeState({
    phase: Phase.COLONY,
    resources: { workers: 10, food: 0, nestCapacity: 1000 },
    workersAssigned: { gather: 10 },
    ...over,
  });
}

/** Meet and latch the current phase's goal through the real phase layer. */
function latched(s: GameState): GameState {
  const goal = goalFor(s.phase)!;
  let met = s;
  for (const c of goal.conditions) {
    const need = c.target(met) - c.current(met);
    if (need <= 0) continue;
    if (c.id === 'workers') met = { ...met, resources: { ...met.resources, workers: c.target(met) } };
    else if (c.id === 'guard') met = { ...met, workersAssigned: { ...met.workersAssigned, guard: c.target(met) } };
    else if (c.id === 'battlesWon') met = { ...met, battlesWon: c.target(met) };
    else met = { ...met, resources: { ...met.resources, [c.id]: c.target(met) } };
  }
  const out = fsm.latch(met);
  expect(out.phaseGoal?.latched).toBe(true);
  return out;
}

/** Food is critical: everyone tends, so nothing gathers, and the stock is empty. */
function starving(s: GameState): GameState {
  const w = s.resources.workers;
  return { ...s, resources: { ...s.resources, food: 0 }, workersAssigned: { ...s.workersAssigned, gather: 0, tend: w, dig: 0, guard: 0 } };
}

function effectiveCap(s: GameState): number {
  return s.resources.nestCapacity + (getEffects('warehouse', s.buildings.warehouse.level).nestCapacity ?? 0);
}

/** Workers fill the nest to its capacity, with one left free. */
function full(s: GameState): GameState {
  const cap = effectiveCap(s);
  return { ...s, resources: { ...s.resources, workers: cap }, workersAssigned: { ...s.workersAssigned, gather: cap - 1, tend: 0, dig: 0, guard: 0 } };
}

describe('getNextAction (Story 1.21)', () => {
  describe('rule 1: goal met → CONTINUE', () => {
    it('suggests CONTINUE exactly when the phase layer has a pending goal, and CONTINUE succeeds', () => {
      for (const phase of PHASE_ORDER) {
        if (!goalFor(phase)) continue;
        const s = latched(colony({ phase }));
        const n = act(getNextAction(s));
        expect(n.rule).toBe('goal');
        expect(n.intent).toEqual({ action: 'continuePhase' });
        expect(fsm.pending(s)).not.toBeNull();
        const after = perform(s, n);
        expect(after.phase).not.toBe(phase);
      }
    });

    it('a met but not yet latched goal is not CONTINUE (the latch is the authority)', () => {
      const s = latched(colony());
      const unlatched = { ...s, phaseGoal: null };
      expect(fsm.pending(unlatched)).toBeNull();
      const n = getNextAction(unlatched);
      expect(n.kind === 'act' && n.rule === 'goal').toBe(false);
    });

    it('a latch left over from another phase is not CONTINUE', () => {
      const s = latched(colony());
      const stale = { ...s, phase: Phase.EXPANSION };
      expect(fsm.pending(stale)).toBeNull();
      const n = getNextAction(stale);
      expect(n.kind === 'act' && n.rule === 'goal').toBe(false);
    });

    it('beats food and capacity being critical', () => {
      const s = latched(starving(full(colony())));
      expect(act(getNextAction(s)).rule).toBe('goal');
    });
  });

  describe('rule 2: food critical → the allocation fix', () => {
    it('with a free worker, puts it on GATHER', () => {
      const base = starving(colony());
      const s = { ...base, workersAssigned: { ...base.workersAssigned, tend: base.resources.workers - 1 } };
      const n = act(getNextAction(s));
      expect(n.rule).toBe('food');
      expect(n.intent).toEqual({ action: 'assignWorker', role: 'gather' });
      const after = perform(s, n);
      expect(after.workersAssigned.gather).toBeGreaterThan(s.workersAssigned.gather);
    });

    it('with no free worker, frees one from another job, then puts it on GATHER', () => {
      const s = starving(colony());
      const first = act(getNextAction(s));
      expect(first.rule).toBe('food');
      expect(first.intent.action).toBe('unassignWorker');
      const freed = perform(s, first);
      expect(getAssignedWorkers(freed)).toBeLessThan(getAssignedWorkers(s));
      expect(freed.workersAssigned.gather).toBe(s.workersAssigned.gather);

      const second = act(getNextAction(freed));
      expect(second.rule).toBe('food');
      expect(second.intent).toEqual({ action: 'assignWorker', role: 'gather' });
      const fixed = perform(freed, second);
      const before = computeResourceRates(s);
      const now = computeResourceRates(fixed);
      expect(now.foodProducedPerSec).toBeGreaterThan(before.foodProducedPerSec);
    });

    it('never takes the last guard', () => {
      const base = starving(colony());
      const s = { ...base, workersAssigned: { ...base.workersAssigned, tend: 0, guard: base.resources.workers } };
      const n = act(getNextAction(s));
      expect(n.rule).toBe('food');
      let cur = s;
      for (let i = 0; i < s.resources.workers * 2; i++) {
        const next = getNextAction(cur);
        if (next.kind !== 'act' || next.rule !== 'food') break;
        cur = perform(cur, next);
        expect(cur.workersAssigned.guard).toBeGreaterThanOrEqual(1);
      }
    });

    it('is not critical while the stock covers the upkeep window, even when the rate is negative', () => {
      const s = starving(colony());
      const upkeep = computeResourceRates(s).foodConsumedPerSec;
      const enough = Math.ceil(upkeep * (nextActionBalance.foodCriticalMs / MS_PER_SEC));
      const covered = { ...s, resources: { ...s.resources, food: enough } };
      const n = getNextAction(covered);
      expect(n.kind === 'act' && n.rule === 'food').toBe(false);
      const short = { ...s, resources: { ...s.resources, food: enough - 1 } };
      expect(act(getNextAction(short)).rule).toBe('food');
    });

    it('is not critical when the net rate is not negative, even with an empty stock', () => {
      const s = colony();
      const r = computeResourceRates(s);
      expect(r.foodProducedPerSec).toBeGreaterThanOrEqual(r.foodConsumedPerSec);
      const n = getNextAction(s);
      expect(n.kind === 'act' && n.rule === 'food').toBe(false);
    });

    it('beats capacity being critical', () => {
      const s = starving(full(colony()));
      expect(act(getNextAction(s)).rule).toBe('food');
    });

    it('has no fix before workers can be assigned (Phase 1)', () => {
      const s = starving(colony({ phase: Phase.EGG_LAYING }));
      const n = getNextAction(s);
      expect(n.kind === 'act' && n.rule === 'food').toBe(false);
    });
  });

  describe('rule 3: capacity critical → DIG or Warehouse', () => {
    it('at the threshold, puts a free worker on DIG', () => {
      const s = full(colony());
      const n = act(getNextAction(s));
      expect(n.rule).toBe('capacity');
      expect(n.intent).toEqual({ action: 'assignWorker', role: 'dig' });
      const after = perform(s, n);
      expect(after.workersAssigned.dig).toBeGreaterThan(s.workersAssigned.dig);
    });

    it('just under the threshold is not critical', () => {
      const s = full(colony());
      const cap = effectiveCap(s);
      const below = Math.ceil((cap * nextActionBalance.capacityCriticalPercent) / 100) - 1;
      const under = { ...s, resources: { ...s.resources, workers: below }, workersAssigned: { ...s.workersAssigned, gather: below - 1 } };
      const n = getNextAction(under);
      expect(n.kind === 'act' && n.rule === 'capacity').toBe(false);
    });

    it('buys a Warehouse when one is affordable and the BUILD panel is open', () => {
      const s = withCost(full(colony({ phase: Phase.EXPANSION })), { kind: 'building', id: 'warehouse' });
      const n = act(getNextAction(s));
      expect(n.rule).toBe('capacity');
      expect(n.intent).toEqual({ action: 'buyBuilding', id: 'warehouse' });
      const after = perform(s, n);
      expect(effectiveCap(after)).toBeGreaterThan(effectiveCap(s));
    });

    it('beats an affordable critical-path item', () => {
      const phase = Phase.EXPANSION;
      const ref = CRITICAL_PATH[phase].find((r) => r.kind !== 'building' || r.id !== 'warehouse')!;
      const s = withCost(full(colony({ phase })), ref);
      expect(isItemAffordable(s, ref)).toBe(true);
      expect(act(getNextAction(s)).rule).toBe('capacity');
    });
  });

  describe('capacity critical: no brood boosters (#495)', () => {
    const ref = (key: string): ItemRef => listItems().find((r) => itemKey(r) === key)!;
    /** The item a result points at: the suggestion's target, or NEXT AFFORDABLE's. */
    const pointedAt = (n: NextAction): ItemRef | undefined =>
      listItems().find((r) => itemKey(r) === (n.kind === 'act' ? n.key : n.nextAffordable?.key));

    it('Click Power and Warm Brood only add eggs or larvae; a Warehouse, Lean Rations and Side Chamber do more', () => {
      const s = colony();
      expect(isBroodOnly(s, ref('upgrade:click_power'))).toBe(true);
      expect(isBroodOnly(s, ref('upgrade:warm_brood'))).toBe(true);
      expect(isBroodOnly(s, ref('building:warehouse'))).toBe(false);
      expect(isBroodOnly(s, ref('upgrade:lean_rations'))).toBe(false);
      expect(isBroodOnly(s, ref('upgrade:side_chamber'))).toBe(false);
    });

    it('in Colony with the nest full and no Warehouse or DIG fix, BUILD does not suggest Click Power', () => {
      const base = full(colony());
      const s = withCost({ ...base, workersAssigned: { ...base.workersAssigned, gather: base.resources.workers } }, ref('upgrade:click_power'));
      expect(isCapacityCritical(s)).toBe(true);
      expect(isItemAffordable(s, ref('upgrade:click_power'))).toBe(true);
      const n = getNextAction(s);
      expect(n.kind === 'act' ? n.key : n.nextAffordable?.key).not.toBe('upgrade:click_power');
    });

    it('while the nest is capacity-critical, never points at an item that only adds eggs or larvae', () => {
      fc.assert(
        fc.property(arbState, fc.integer({ min: 0, max: 50 }), (st, extra) => {
          const cap = effectiveCap(st);
          fc.pre(cap > 0);
          const workers = cap + extra;
          const s: GameState = {
            ...st,
            resources: { ...st.resources, workers },
            workersAssigned: { ...st.workersAssigned, gather: workers, tend: 0, forage: 0, dig: 0, guard: 0 },
          };
          fc.pre(isCapacityCritical(s));
          const target = pointedAt(getNextAction(s));
          if (target) expect(isBroodOnly(s, target), itemKey(target)).toBe(false);
        }),
        { numRuns: 300 },
      );
    });

    it('out of capacity trouble, brood boosters are still suggested', () => {
      const s = withCost(colony(), ref('upgrade:click_power'));
      expect(isCapacityCritical(s)).toBe(false);
      const n = act(getNextAction(s));
      expect(isBroodOnly(s, pointedAt(n)!)).toBe(true);
    });
  });

  describe('rules 4 and 5: affordable items', () => {
    it('prefers an affordable critical-path item over any other affordable item', () => {
      let checked = 0;
      for (const phase of PHASE_ORDER) {
        const table = CRITICAL_PATH[phase];
        const other = listItems().find((r) => !table.some((t) => itemKey(t) === itemKey(r)) && isItemAffordable(withCost(colony({ phase }), r), r));
        const pick = table.find((r) => isItemAffordable(withCost(colony({ phase }), r), r));
        if (!other || !pick) continue;
        const s = withCost(withCost(colony({ phase }), other), pick);
        const n = act(getNextAction(s));
        expect(n.rule).toBe('critical_path');
        expect(table.map(itemKey)).toContain(n.key);
        perform(s, n);
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    });

    it('follows the table order among affordable critical-path items', () => {
      let checked = 0;
      for (const phase of PHASE_ORDER) {
        const table = CRITICAL_PATH[phase].filter((r) => isItemAffordable(withCost(colony({ phase }), r), r));
        if (table.length < 2) continue;
        const s = table.reduce((acc, r) => withCost(acc, r), colony({ phase }));
        expect(act(getNextAction(s)).key).toBe(itemKey(table[0]));
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    });

    it('falls back to any affordable item, and the action accepts it', () => {
      let checked = 0;
      for (const phase of PHASE_ORDER) {
        const table = CRITICAL_PATH[phase].map(itemKey);
        for (const r of listItems()) {
          if (table.includes(itemKey(r))) continue;
          const s = withCost(colony({ phase }), r);
          if (!isItemAffordable(s, r)) continue;
          if (CRITICAL_PATH[phase].some((t) => isItemAffordable(s, t))) continue;
          const n = act(getNextAction(s));
          expect(n.rule).toBe('affordable');
          perform(s, n);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
    });

    it('never suggests an item whose panel is not open in this phase', () => {
      // Resources for everything, in Colony: the space research, the ship and automation are later.
      let s = listItems().reduce((acc, r) => withCost(acc, r), colony());
      for (let i = 0; i < 12; i++) {
        const n = getNextAction(s);
        expect(n.kind).toBe('act');
        if (n.kind !== 'act' || n.rule === 'goal') break;
        expect(isUnlocked(PANEL_PLACEMENT[n.panel].unlockPhase, Phase.COLONY), n.key).toBe(true);
        expect(n.intent.action, n.key).not.toBe('buildShip');
        expect(n.intent.action, n.key).not.toBe('researchAutomation');
        s = perform(s, n);
      }
    });

    it('every suggestion is accepted by its action, across phases and stock levels', () => {
      for (const phase of PHASE_ORDER) {
        let s = listItems().reduce((acc, r) => withCost(acc, r), colony({ phase }));
        for (let i = 0; i < 12; i++) {
          const n = getNextAction(s);
          if (n.kind !== 'act' || n.rule === 'goal') break;
          s = perform(s, n);
        }
      }
    });
  });

  describe('rule 6: none → NEXT AFFORDABLE', () => {
    it('with nothing affordable, names the soonest reachable item and a whole number of seconds', () => {
      const s = colony();
      const n = getNextAction(s);
      expect(n.kind).toBe('none');
      if (n.kind !== 'none') return;
      expect(n.nextAffordable).not.toBeNull();
      const next = n.nextAffordable!;
      expect(Number.isInteger(next.inSec)).toBe(true);
      expect(next.inSec).toBeGreaterThan(0);
      expect(next.name.length).toBeGreaterThan(0);
    });

    it('the estimate shrinks as the stock grows, and the item becomes the suggestion once paid for', () => {
      const s = colony();
      const n = getNextAction(s);
      if (n.kind !== 'none' || !n.nextAffordable) throw new Error('expected NEXT AFFORDABLE');
      const ref = listItems().find((r) => itemKey(r) === n.nextAffordable!.key)!;
      const cost = itemCost(s, ref)!;
      const half = { ...s, resources: { ...s.resources, food: Math.floor((cost.food ?? 0) / 2) } };
      const later = getNextAction(half);
      if (later.kind === 'none' && later.nextAffordable) expect(later.nextAffordable.inSec).toBeLessThanOrEqual(n.nextAffordable.inSec);
      expect(act(getNextAction(withCost(s, ref))).key).toBe(itemKey(ref));
    });

    it('with no income, nothing is reachable by waiting', () => {
      const s = colony({ resources: { workers: 0 }, workersAssigned: { gather: 0 } });
      const n = getNextAction(s);
      expect(n).toEqual(expect.objectContaining({ kind: 'none', nextAffordable: null }));
    });
  });

  describe('purity', () => {
    it('never changes the state and gives the same answer for the same state', () => {
      const s = starving(full(colony()));
      const json = JSON.stringify(s);
      const a = getNextAction(s);
      const b = getNextAction(s);
      expect(JSON.stringify(s)).toBe(json);
      expect(b).toEqual(a);
    });

    it('every suggestion has a key, a verb and a panel', () => {
      const samples = [colony(), starving(colony()), full(colony()), latched(colony()), withCost(colony({ phase: Phase.EXPANSION }), { kind: 'building', id: 'warehouse' })];
      for (const s of samples) {
        const n = getNextAction(s);
        expect(n.key.length).toBeGreaterThan(0);
        if (n.kind === 'act') {
          expect(n.verb.length).toBeGreaterThan(0);
          expect(n.panel.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe('research-gated automation buildings (#193)', () => {
  it('offers a gated automation building only once its research is done', () => {
    const base = makeState({});
    const nursery: ItemRef = { kind: 'auto_building', id: 'nursery' };
    expect(itemCost(base, nursery)).toBeNull();
    const researched: GameState = {
      ...base,
      autoProduction: { ...base.autoProduction, researches: { ...base.autoProduction.researches, thermal_regulation: true } },
    };
    expect(itemCost(researched, nursery)).not.toBeNull();
  });
});
