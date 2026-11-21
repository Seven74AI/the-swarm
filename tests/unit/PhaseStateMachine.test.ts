import { describe, it, expect, beforeEach } from 'vitest';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import { EGG_TO_COLONY, SPACE_TO_TRANSCENDENCE, TRANSITIONS, type Transition } from '../../src/phases/transitions';
import { EventBus } from '../../src/engine/EventBus';
import { EventQueue } from '../../src/engine/events';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';

/** A state in `phase` that meets the real guard of the transition out of it (transitions.ts). */
function metState(phase: Phase): GameState {
  const base = createInitialState();
  const s: GameState = {
    ...base,
    phase,
    battlesWon: 1_000,
    resources: {
      ...base.resources,
      workers: 100_000,
      food: 100_000_000,
      voidCrystals: 100_000_000,
      antimatter: 100_000_000,
      darkMatter: 100_000_000,
    },
    workersAssigned: { ...base.workersAssigned, guard: 1_000 },
  };
  return s;
}

const outOf = (phase: Phase): Transition => TRANSITIONS.find((t) => t.from === phase)!;

describe('PhaseStateMachine (evaluate / commit, D3)', () => {
  let fsm: PhaseStateMachine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    fsm = new PhaseStateMachine(TRANSITIONS);
  });

  describe('evaluate', () => {
    it('returns null while the guard out of the current phase is not met', () => {
      expect(fsm.evaluate(createInitialState())).toBeNull();
    });

    it('returns the transition out of the current phase once its guard is met', () => {
      for (const phase of PHASE_ORDER.filter((p) => p !== Phase.TRANSCENDENCE)) {
        const t = fsm.evaluate(metState(phase));
        expect(t?.from).toBe(phase);
        expect(PHASE_ORDER.indexOf(t!.to)).toBeGreaterThan(PHASE_ORDER.indexOf(phase));
      }
    });

    it('is pure: it changes no state and raises no events', () => {
      const s = metState(Phase.EGG_LAYING);
      const snapshot = JSON.stringify(s);
      let heard = 0;
      bus.subscribe('phase_committed', () => heard++);
      fsm.evaluate(s);
      expect(JSON.stringify(s)).toBe(snapshot);
      expect(heard).toBe(0);
    });

    it('has nothing to offer from the last phase', () => {
      expect(fsm.evaluate(metState(Phase.TRANSCENDENCE))).toBeNull();
    });
  });

  describe('latch', () => {
    it('leaves the phase alone and writes phaseGoal when the guard first holds', () => {
      const s = metState(Phase.EGG_LAYING);
      const next = fsm.latch(s);
      expect(next.phase).toBe(Phase.EGG_LAYING);
      expect(next.phaseGoal).toMatchObject({ phase: EGG_TO_COLONY.to, latched: true });
      expect(s.phaseGoal).toBeNull(); // spread write, never in place
    });

    it('writes the latch once: a latched state comes back as the same reference', () => {
      const once = fsm.latch(metState(Phase.EGG_LAYING));
      expect(fsm.latch(once)).toBe(once);
    });

    it('returns the same reference while the guard is not met', () => {
      const s = createInitialState();
      expect(fsm.latch(s)).toBe(s);
    });

    it('survives a dip below target', () => {
      const latched = fsm.latch(metState(Phase.EGG_LAYING));
      const dipped = { ...latched, resources: { ...latched.resources, workers: 0 } };
      expect(fsm.evaluate(dipped)).toBeNull();
      expect(fsm.latch(dipped)).toBe(dipped);
      expect(fsm.pending(dipped)).toBe(outOf(Phase.EGG_LAYING));
    });

    it('records every condition value at the moment the goal was met', () => {
      const s = metState(Phase.COLONY);
      const goal = fsm.latch(s).phaseGoal!;
      for (const c of outOf(Phase.COLONY).conditions) expect(goal.reached[c.id]).toBe(Math.floor(c.current(s)));
    });

    it('records when the goal was met, in game time', () => {
      const s = metState(Phase.EGG_LAYING);
      const at = { ...s, stats: { ...s.stats, playTimeMs: 12_345 } };
      expect(fsm.latch(at).phaseGoal?.atMs).toBe(12_345);
    });
  });

  describe('pending', () => {
    it('is null without a latch', () => {
      expect(fsm.pending(metState(Phase.EGG_LAYING))).toBeNull();
    });

    it('ignores a latch that does not lead out of the current phase', () => {
      const s = { ...metState(Phase.COMBAT), phaseGoal: { phase: Phase.COLONY, latched: true as const, atMs: 0, reached: {} } };
      expect(fsm.pending(s)).toBeNull();
    });
  });

  describe('commit', () => {
    it('moves to the next phase and clears the latch', () => {
      const latched = fsm.latch(metState(Phase.EGG_LAYING));
      const t = fsm.pending(latched)!;
      const next = fsm.commit(t, latched, bus);
      expect(next.phase).toBe(t.to);
      expect(next.phaseGoal).toBeNull();
      expect(latched.phase).toBe(Phase.EGG_LAYING); // spread write, never in place
    });

    it('emits phase_committed with from and to', () => {
      const s = metState(Phase.COLONY);
      const t = outOf(Phase.COLONY);
      const heard: { from: Phase; to: Phase }[] = [];
      bus.subscribe('phase_committed', (p) => heard.push(p));
      fsm.commit(t, s, bus);
      expect(heard).toEqual([{ from: t.from, to: t.to }]);
    });

    it('runs the transition onEnter (its narrative, and the victory flag)', () => {
      const s = metState(Phase.SPACE);
      const queue = new EventQueue();
      const next = fsm.commit(SPACE_TO_TRANSCENDENCE, s, queue);
      expect(next.victoryAchieved).toBe(true);
      const seen: string[] = [];
      for (const name of ['phase_committed', 'victory', 'narrative'] as const) bus.subscribe(name, () => seen.push(name));
      queue.flushTo(bus);
      expect(seen).toContain('phase_committed');
      expect(seen).toContain('victory');
      expect(seen).toContain('narrative');
    });

    it('commits even after the numbers dipped below target', () => {
      const latched = fsm.latch(metState(Phase.EGG_LAYING));
      const dipped = { ...latched, resources: { ...latched.resources, workers: 0 } };
      const next = fsm.commit(fsm.pending(dipped)!, dipped, bus);
      expect(next.phase).toBe(EGG_TO_COLONY.to);
    });

    it('never moves backwards', () => {
      for (const t of TRANSITIONS) {
        const next = fsm.commit(t, metState(t.from), new EventQueue());
        expect(PHASE_ORDER.indexOf(next.phase as Phase)).toBeGreaterThan(PHASE_ORDER.indexOf(t.from));
      }
    });
  });
});
