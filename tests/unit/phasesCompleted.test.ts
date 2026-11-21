import { describe, expect, it, afterEach } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { PHASE_ORDER, Phase } from '../../src/phases/phases';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { TRANSITIONS, goalFor } from '../../src/phases/transitions';
import { EventBus } from '../../src/engine/EventBus';
import { prestige, startPhaseFor } from '../../src/systems/PrestigeSystem';
import { getPrestigeBonuses } from '../../src/systems/PrestigeBonusSystem';
import { migrateSave } from '../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../src/platform/storage/SaveStore';
import { PRESTIGE_UPGRADES } from '../../src/data/prestigeTree';

/**
 * Story 5.6 (FR32): Phase Skip never skips a phase the player hasn't
 * completed. `lifetime.phasesCompleted` records each phase a run has moved
 * out of (commit), survives prestige, and caps where Phase Skip starts the
 * next run: never later than the first phase not completed.
 */

const IDS = PRESTIGE_UPGRADES.map((u) => u.id);
const at = (p: Phase) => PHASE_ORDER.indexOf(p);
const firstNotCompleted = (done: readonly string[]): Phase => PHASE_ORDER.find((p) => !done.includes(p)) ?? PHASE_ORDER[PHASE_ORDER.length - 1];

function withHistory(done: readonly string[], bought: readonly string[], phase: Phase = Phase.SPACE): GameState {
  const s = createInitialState();
  return { ...s, phase, lifetime: { ...s.lifetime, phasesCompleted: [...done] }, prestigeTree: { purchased: [...bought] } };
}

describe('phasesCompleted (Story 5.6, FR32)', () => {
  it('starts empty', () => {
    expect(createInitialState().lifetime.phasesCompleted).toEqual([]);
  });

  it('commit adds the phase the run leaves, once', () => {
    const fsm = new PhaseStateMachine(TRANSITIONS);
    const bus = new EventBus();
    let s = createInitialState();
    for (const from of PHASE_ORDER.slice(0, -1)) {
      s = fsm.commit(goalFor(from)!, { ...s, phase: from }, bus);
      expect(s.lifetime.phasesCompleted).toContain(from);
    }
    expect([...s.lifetime.phasesCompleted].sort()).toEqual(PHASE_ORDER.slice(0, -1).sort());
    // Committing out of a phase already completed (a later run) adds nothing twice.
    const again = fsm.commit(goalFor(Phase.EGG_LAYING)!, { ...s, phase: Phase.EGG_LAYING }, bus);
    expect(again.lifetime.phasesCompleted.filter((p) => p === Phase.EGG_LAYING)).toHaveLength(1);
  });

  it('survives prestige', () => {
    const s = withHistory([Phase.EGG_LAYING, Phase.COLONY], []);
    expect(prestige(s).lifetime.phasesCompleted).toEqual(s.lifetime.phasesCompleted);
  });

  it('with Phase Skip, the new run never starts later than the first phase not completed (random histories)', () => {
    fc.assert(
      fc.property(fc.subarray(PHASE_ORDER as string[]), fc.subarray(IDS), (done, bought) => {
        const s = withHistory(done, bought);
        const start = prestige(s).phase as Phase;
        expect(startPhaseFor(s)).toBe(start);
        expect(at(start)).toBeLessThanOrEqual(at(firstNotCompleted(done)));
        if (!getPrestigeBonuses(s).phaseSkip) expect(start).toBe(Phase.EGG_LAYING);
      }),
      { numRuns: 200 },
    );
  });

  it('Phase Skip still skips Egg Laying once it has been completed', () => {
    expect(prestige(withHistory([Phase.EGG_LAYING], ['phase_skip'])).phase).toBe(Phase.COLONY);
    expect(prestige(withHistory([], ['phase_skip'])).phase).toBe(Phase.EGG_LAYING);
  });
});

describe('v33 → v34: phasesCompleted from the save\'s history (Story 5.6)', () => {
  const FROM = 33;
  const TO = 34;
  afterEach(() => localStorage.clear());

  function oldSave(over: Partial<{ phase: string; count: number; victory: boolean; seen: string[] }>): SaveData {
    const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    return {
      version: FROM,
      timestamp: 1,
      playTimeMs: 0,
      gameState: {
        ...s,
        phase: over.phase ?? Phase.EGG_LAYING,
        prestige: { ...(s.prestige as object), count: over.count ?? 0 },
        victoryAchieved: over.victory ?? false,
        lifetime: { revealsSeen: over.seen ?? [] },
      } as unknown as GameState,
    };
  }
  const derived = (d: SaveData) => migrateSave(d, FROM, TO).gameState.lifetime.phasesCompleted;
  const before = (p: Phase) => PHASE_ORDER.slice(0, at(p));

  it('a new save has completed nothing', () => {
    expect(derived(oldSave({}))).toEqual([]);
  });

  it('every phase before the current one is completed (only commit moves the phase forward)', () => {
    for (const p of PHASE_ORDER) expect([...derived(oldSave({ phase: p }))].sort()).toEqual(before(p).sort());
  });

  it('a prestige implies Egg Laying and Colony: its buildings cost Combat loot', () => {
    expect([...derived(oldSave({ count: 1 }))].sort()).toEqual(before(Phase.COMBAT).sort());
  });

  it('a seen reveal implies the phases before it; the victory, every phase before Transcendence', () => {
    expect([...derived(oldSave({ seen: [Phase.EXPANSION] }))].sort()).toEqual(before(Phase.EXPANSION).sort());
    expect([...derived(oldSave({ victory: true }))].sort()).toEqual(before(Phase.TRANSCENDENCE).sort());
  });

  it('the derivation never claims a phase the history doesn\'t imply, and lists each once (random histories)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PHASE_ORDER),
        fc.integer({ min: 0, max: 5 }),
        fc.boolean(),
        fc.subarray(PHASE_ORDER as string[]),
        (phase, count, victory, seen) => {
          const out = derived(oldSave({ phase, count, victory, seen }));
          expect(new Set(out).size).toBe(out.length);
          const implied = new Set<string>([
            ...before(phase),
            ...(count > 0 ? before(Phase.COMBAT) : []),
            ...(victory ? before(Phase.TRANSCENDENCE) : []),
            ...seen.flatMap((p) => before(p as Phase)),
          ]);
          expect([...out].sort()).toEqual([...implied].sort());
        },
      ),
      { numRuns: 200 },
    );
  });

  it('keeps a list already there, and leaves a partial save for the defaults', () => {
    const d = oldSave({});
    (d.gameState.lifetime as unknown as Record<string, unknown>).phasesCompleted = [Phase.COLONY];
    expect(derived(d)).toEqual([Phase.COLONY]);
    const partial = migrateSave({ version: FROM, timestamp: 1, playTimeMs: 0, gameState: { phase: 'colony' } as unknown as GameState }, FROM, TO);
    expect(partial.version).toBe(TO);
    expect(partial.gameState).toEqual({ phase: 'colony' });
  });

  it('an old save loads through SaveManager with its history filled in', () => {
    localStorage.setItem('the_swarm_save', JSON.stringify(oldSave({ phase: Phase.COMBAT })));
    const loaded = new SaveManager(createLocalSaveStore(localStorage)).load();
    expect([...loaded!.gameState.lifetime.phasesCompleted].sort()).toEqual(before(Phase.COMBAT).sort());
  });
});
