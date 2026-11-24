import { describe, it, expect } from 'vitest';
import {
  applyChoice,
  canChoose,
  isEligible,
  startDecisionSession,
  tickDecisions,
  type DecisionTickInput,
} from '../../../src/systems/DecisionSystem';
import { DECISIONS, getDecision, type DecisionDef } from '../../../src/data/content/decisions';
import { decisionBalance } from '../../../src/data/balance/decisions';
import { EventQueue } from '../../../src/engine/events';
import { EventBus } from '../../../src/engine/EventBus';
import { Phase } from '../../../src/phases/phases';
import type { GameState } from '../../../src/state/GameState';
import { makeState, type StateOverrides } from '../helpers/makeState';
import { crowdedPercent } from '../../../src/systems/Crowding';

/**
 * Story 1.28 (D8, N3): decision events spawn on the session clock, at most one
 * open; the countdown runs on game time, only while the sheet is shown; choices
 * and timeouts go through one pure `applyChoice`.
 */

const STEP_MS = 1000;

const BASE_RESOURCES = { workers: 20, food: 500, nestCapacity: 100, eggs: 100, larvae: 100 };
const colony = (over: StateOverrides = {}): GameState =>
  makeState({
    phase: Phase.COLONY,
    eggPipeline: { count: BASE_RESOURCES.eggs, progress: 0 },
    larvaPipeline: { count: BASE_RESOURCES.larvae, progress: 0 },
    ...over,
    resources: { ...BASE_RESOURCES, ...(over.resources as object | undefined) },
  });

const byPolicy = (p: DecisionDef['ignorePolicy']): DecisionDef => DECISIONS.find((d) => d.ignorePolicy === p)!;

function input(over: Partial<DecisionTickInput> = {}): DecisionTickInput {
  return {
    sessionMs: 0,
    dtMs: STEP_MS,
    shown: true,
    canSpawn: true,
    timers: 'normal',
    rand: () => 0.5,
    events: new EventQueue(),
    ...over,
  };
}

/** Run the session clock forward `ms` in steps; returns the state and the events raised. */
function run(s: GameState, ms: number, over: Partial<DecisionTickInput> = {}, from = 0) {
  const events = new EventQueue();
  const seen: string[] = [];
  const bus = new EventBus();
  bus.subscribe('decision_spawned', () => seen.push('spawned'));
  bus.subscribe('decision_resolved', () => seen.push('resolved'));
  let state = s;
  for (let t = from + STEP_MS; t <= from + ms; t += STEP_MS) {
    state = tickDecisions(state, input({ ...over, sessionMs: t, events }));
  }
  events.flushTo(bus);
  return { state, seen };
}

/** A state with `def` open and the given time left. */
function withOpen(def: DecisionDef, over: StateOverrides = {}, remainingMs = def.timerMs ?? null, roll = 0.99): GameState {
  return colony({
    phase: def.phases[0],
    ...over,
    decision: { open: { id: def.id, remainingMs, openedAtSessionMs: 0, roll }, nextSpawnSessionMs: null },
  });
}

describe('spawning on the session clock', () => {
  it('never spawns in the first 2 minutes of a session, however long the save has played', () => {
    const s = startDecisionSession(colony({ stats: { playTimeMs: 10 * 3_600_000 } }));
    const { state, seen } = run(s, decisionBalance.spawnMinMs - STEP_MS);
    expect(state.decision.open).toBeNull();
    expect(seen).toEqual([]);
  });

  it('spawns one event by the end of the spawn window, for the current phase', () => {
    for (const r of [0, 0.5, 0.999]) {
      const { state, seen } = run(startDecisionSession(colony()), decisionBalance.spawnMaxMs + STEP_MS, { rand: () => r, shown: false });
      expect(state.decision.open).not.toBeNull();
      expect(getDecision(state.decision.open!.id).phases).toContain(Phase.COLONY);
      expect(seen).toEqual(['spawned']);
    }
  });

  it('keeps at most one open: an open event blocks the next spawn', () => {
    const { state, seen } = run(startDecisionSession(colony()), decisionBalance.spawnMaxMs * 4, { shown: false });
    expect(state.decision.open).not.toBeNull();
    expect(seen).toEqual(['spawned']);
  });

  it('spawns nothing while an overlay or the offline summary is up', () => {
    const { state } = run(startDecisionSession(colony()), decisionBalance.spawnMaxMs * 2, { canSpawn: false });
    expect(state.decision.open).toBeNull();
  });

  it('spawns nothing in a phase without events', () => {
    expect(DECISIONS.some((d) => d.phases.includes(Phase.TRANSCENDENCE))).toBe(false);
    const s = startDecisionSession(colony({ phase: Phase.TRANSCENDENCE }));
    expect(run(s, decisionBalance.spawnMaxMs * 2).state.decision.open).toBeNull();
  });

  it("spawns in Egg Laying too, from that phase's own events (Story 4.5)", () => {
    const { state } = run(startDecisionSession(colony({ phase: Phase.EGG_LAYING })), decisionBalance.spawnMaxMs + STEP_MS, { shown: false });
    expect(getDecision(state.decision.open!.id).phases).toContain(Phase.EGG_LAYING);
  });

  it('an event that needs a crowded nest spawns only when the nest is crowded', () => {
    const crowdedOnly = DECISIONS.filter((d) => d.spawnsWhen === 'crowded');
    expect(crowdedOnly.length).toBeGreaterThan(0);
    for (const def of crowdedOnly) {
      const phase = def.phases[0];
      const roomy = colony({ phase, resources: { workers: 10, nestCapacity: 1000 } });
      // Story 9.18: crowding has to cost at least `overcrowdingMinWorkPercent` of the work, not just bite.
      const barely = colony({ phase, resources: { workers: 1001, nestCapacity: 1000, eggs: 0, larvae: 0 } });
      const full = colony({ phase, resources: { workers: 1000, nestCapacity: 100, eggs: 0, larvae: 0 } });
      // It bites (some work is lost), just not enough.
      expect(crowdedPercent(barely)).not.toBeNull();
      expect(crowdedPercent(barely)!).toBeLessThan(decisionBalance.overcrowdingMinWorkPercent);
      expect(crowdedPercent(full)).toBeGreaterThanOrEqual(decisionBalance.overcrowdingMinWorkPercent);
      expect(isEligible(roomy, def)).toBe(false);
      expect(isEligible(barely, def)).toBe(false);
      expect(isEligible(full, def)).toBe(true);
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        const { state } = run(startDecisionSession(roomy), decisionBalance.spawnMaxMs + STEP_MS, { rand: () => r, shown: false });
        expect(state.decision.open?.id).not.toBe(def.id);
      }
    }
  });

  it('a new session draws a new spawn time: the old one does not carry over', () => {
    const due = colony({ decision: { open: null, nextSpawnSessionMs: STEP_MS } });
    expect(run(due, STEP_MS * 2).state.decision.open).not.toBeNull();
    expect(run(startDecisionSession(due), STEP_MS * 2).state.decision.open).toBeNull();
  });

  it('a new session keeps an open event, and drops one whose id no longer exists', () => {
    const open = withOpen(byPolicy('costly'), {}, 1234);
    expect(startDecisionSession(open).decision.open).toEqual(open.decision.open);
    const stale = colony({ decision: { open: { id: 'gone' as never, remainingMs: 1, openedAtSessionMs: 0, roll: 0 }, nextSpawnSessionMs: 0 } });
    expect(startDecisionSession(stale).decision.open).toBeNull();
  });

  it('after a choice, the next event waits a full spawn interval again', () => {
    const { state } = run(startDecisionSession(colony()), decisionBalance.spawnMaxMs + STEP_MS, { shown: false });
    const def = getDecision(state.decision.open!.id);
    const closed = applyChoice(state, def, def.choices.find((c) => canChoose(state, def, c.id))!.id);
    const from = decisionBalance.spawnMaxMs + STEP_MS;
    expect(run(closed, decisionBalance.spawnMinMs - STEP_MS, {}, from).state.decision.open).toBeNull();
  });
});

describe('the countdown (game time, only while shown)', () => {
  const costly = byPolicy('costly');

  it('counts down while the sheet is shown', () => {
    const s = withOpen(costly);
    const after = tickDecisions(s, input({ sessionMs: 1 }));
    expect(after.decision.open!.remainingMs!).toBeLessThan(s.decision.open!.remainingMs!);
  });

  it('does not run while the sheet waits behind another sheet or overlay', () => {
    const s = withOpen(costly);
    const { state } = run(s, costly.timerMs! * 3, { shown: false });
    expect(state.decision.open).toEqual(s.decision.open);
  });

  it('runs slower with doubled timers and not at all with timers off', () => {
    const s = withOpen(costly);
    const left = (timers: DecisionTickInput['timers']) => run(s, STEP_MS * 3, { timers }).state.decision.open!.remainingMs!;
    expect(left('double')).toBeGreaterThan(left('normal'));
    expect(left('off')).toBe(s.decision.open!.remainingMs);
  });

  it('never times out an unavoidable event', () => {
    const s = withOpen(byPolicy('unavoidable'));
    expect(s.decision.open!.remainingMs).toBeNull();
    const { state, seen } = run(s, decisionBalance.spawnMaxMs * 2);
    expect(state.decision.open?.id).toBe(byPolicy('unavoidable').id);
    expect(seen).toEqual([]);
  });

  it('a costly timeout applies the ignore outcome and announces it', () => {
    const s = withOpen(costly, {}, STEP_MS);
    const { state, seen } = run(s, STEP_MS);
    expect(state.decision.open).toBeNull();
    expect(state).toEqual(applyChoice(s, costly, 'ignore'));
    expect(seen).toEqual(['resolved']);
  });

  it('the remaining time stays an integer', () => {
    const s = withOpen(costly);
    for (const timers of ['normal', 'double'] as const) {
      let st = s;
      for (let i = 0; i < 7; i++) st = tickDecisions(st, input({ sessionMs: i, dtMs: 50, timers }));
      expect(Number.isInteger(st.decision.open!.remainingMs)).toBe(true);
    }
  });
});

describe('applyChoice (pure)', () => {
  // Every choice, and the ignore outcome of every event that can be ignored.
  const allOutcomes = DECISIONS.flatMap((d) => [
    ...d.choices.map((c) => [d, c.id] as const),
    ...(d.ignorePolicy === 'unavoidable' ? [] : [[d, 'ignore'] as const]),
  ]);

  it('an unavoidable event cannot be ignored: ignoring changes nothing, not even the event', () => {
    for (const def of DECISIONS.filter((d) => d.ignorePolicy === 'unavoidable')) {
      const s = withOpen(def);
      expect(applyChoice(s, def, 'ignore')).toBe(s);
    }
  });

  it('closes the event, never mutates its input, and leaves resources whole and non-negative', () => {
    for (const roll of [0, 0.99]) {
      for (const [def, choice] of allOutcomes) {
        const s = withOpen(def, { soldiers: { scouts: 3 }, workersAssigned: { guard: 4 }, resources: { stone: 1000 }, combatSoldiers: 10 }, def.timerMs ?? null, roll);
        const frozen = JSON.stringify(s);
        const out = applyChoice(s, def, choice);
        expect(JSON.stringify(s)).toBe(frozen);
        expect(out.decision.open).toBeNull();
        for (const v of Object.values(out.resources)) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
        expect(out.soldiers.scouts).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a free ignore changes nothing but the event; a costly ignore costs something', () => {
    const free = byPolicy('free');
    const s = withOpen(free);
    const out = applyChoice(s, free, 'ignore');
    expect(out.resources).toEqual(s.resources);

    const costly = byPolicy('costly');
    const c = withOpen(costly);
    const total = (x: GameState) => Object.values(x.resources).reduce((a, b) => a + b, 0);
    expect(total(applyChoice(c, costly, 'ignore'))).toBeLessThan(total(c));
  });

  it('the same roll gives the same outcome (no hidden randomness)', () => {
    for (const [def, choice] of allOutcomes) {
      const s = withOpen(def, { soldiers: { scouts: 3 } }, def.timerMs ?? null, 0.1);
      expect(applyChoice(s, def, choice)).toEqual(applyChoice(s, def, choice));
    }
  });

  it('a choice the colony cannot pay for is refused', () => {
    const paid = DECISIONS.flatMap((d) => d.choices.filter((c) => c.requires).map((c) => [d, c] as const));
    expect(paid.length).toBeGreaterThan(0);
    for (const [def, c] of paid) {
      const broke = withOpen(def, { resources: { food: 0, stone: 0 }, workersAssigned: { guard: 0 }, combatSoldiers: 0 });
      expect(canChoose(broke, def, c.id)).toBe(false);
      expect(applyChoice(broke, def, c.id)).toBe(broke);
      expect(canChoose(withOpen(def, { resources: { stone: 1000 }, workersAssigned: { guard: 4 }, combatSoldiers: 10 }), def, c.id)).toBe(true);
    }
  });
});
