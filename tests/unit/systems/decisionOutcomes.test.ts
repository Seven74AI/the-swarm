import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import { DECISIONS, type DecisionDef } from '../../../src/data/content/decisions';
import { decisionBalance } from '../../../src/data/balance/decisions';
import { combatBalance } from '../../../src/data/balance/combat';
import { applyChoice, canChoose, type DecisionChoice } from '../../../src/systems/DecisionSystem';

/**
 * Story 4.5 (FR14): no decision outcome breaks the colony's books. Random
 * seeded states (fast-check, fixed seed) run every event's two choices and
 * its ignore outcome, under any spawn roll:
 * - every resource and every counted stock stays an integer ≥ 0;
 * - workers never go negative, and no role holds more workers than there are;
 * - the egg and larva pipelines stay in step with the stocks they hold;
 * - no outcome wipes the colony: a colony with workers keeps at least the
 *   share of them `decisionBalance.workerFloorShare` keeps, and never loses its last;
 * - an unavoidable event always leaves a choice the colony can take.
 */

const SEED = 4_5;
const RUNS = 400;
const amount = (max: number) => fc.integer({ min: 0, max });
const JOBS = ['gather', 'forage', 'tend', 'dig', 'guard'] as const;

const arbState: fc.Arbitrary<GameState> = fc
  .record({
    phase: fc.constantFrom(...PHASE_ORDER),
    workers: fc.oneof(amount(3), amount(400)),
    shares: fc.array(amount(100), { minLength: 5, maxLength: 5 }),
    researchers: amount(20),
    headroom: fc.integer({ min: -50, max: 100 }),
    eggs: fc.oneof(amount(5), amount(5000)),
    larvae: fc.oneof(amount(5), amount(3000)),
    food: fc.oneof(amount(30), amount(50_000)),
    wood: amount(5000),
    stone: fc.oneof(amount(150), amount(50_000)),
    nectar: amount(1000),
    soldiers: fc.oneof(amount(4), amount(200)),
    chitin: amount(50),
    scouts: amount(6),
    warehouse: amount(4),
    rng: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
  })
  .map((r) => {
    const s = createInitialState();
    s.phase = r.phase;
    s.rng = r.rng;
    s.resources = {
      ...s.resources,
      workers: r.workers,
      nestCapacity: Math.max(0, r.workers + r.headroom),
      eggs: r.eggs,
      larvae: r.larvae,
      food: r.food,
      wood: r.wood,
      stone: r.stone,
      nectar: r.nectar,
    };
    s.eggPipeline = { count: r.eggs, progress: 0.5 };
    s.larvaPipeline = { count: r.larvae, progress: 0.5 };
    const total = r.shares.reduce((a, b) => a + b, 0) || 1;
    const part = (i: number) => Math.floor((r.workers * r.shares[i]) / total);
    s.workersAssigned = { gather: part(0), forage: part(1), tend: part(2), dig: part(3), guard: part(4), researchers: r.researchers };
    s.combatSoldiers = r.soldiers;
    s.combatResources = { ...s.combatResources, chitin: r.chitin };
    s.soldiers = { ...s.soldiers, scouts: r.scouts };
    s.buildings = { ...s.buildings, warehouse: { level: r.warehouse } };
    return s;
  });

const arbOutcome: fc.Arbitrary<{ def: DecisionDef; choice: DecisionChoice; roll: number }> = fc
  .record({ def: fc.constantFrom(...DECISIONS), pick: fc.constantFrom(0, 1, 'ignore' as const), roll: fc.double({ min: 0, max: 0.999_999, noNaN: true }) })
  .map(({ def, pick, roll }) => ({ def, choice: pick === 'ignore' ? 'ignore' : def.choices[pick].id, roll }));

const withOpen = (s: GameState, def: DecisionDef, roll: number): GameState => ({
  ...s,
  decision: { open: { id: def.id, remainingMs: def.timerMs ?? null, openedAtSessionMs: 0, roll }, nextSpawnSessionMs: null },
});

const jobTotal = (s: GameState): number => JOBS.reduce((a, j) => a + s.workersAssigned[j], 0);
const whole = (n: number): boolean => Number.isInteger(n) && n >= 0;

function expectSound(before: GameState, after: GameState, where: string): void {
  for (const [k, v] of Object.entries(after.resources)) expect(whole(v), `${where}: resources.${k} = ${v}`).toBe(true);
  for (const [k, v] of Object.entries(after.workersAssigned)) expect(whole(v), `${where}: workersAssigned.${k} = ${v}`).toBe(true);
  for (const [k, v] of Object.entries(after.combatResources)) expect(whole(v), `${where}: ${k} = ${v}`).toBe(true);
  for (const v of [after.combatSoldiers, after.soldiers.scouts, after.soldiers.warriors, after.eggPipeline.count, after.larvaPipeline.count]) {
    expect(whole(v), `${where}: a count = ${v}`).toBe(true);
  }
  expect(jobTotal(after), `${where}: roles hold no more workers than there are`).toBeLessThanOrEqual(after.resources.workers);
  expect(after.eggPipeline.count, `${where}: eggs in step`).toBe(after.resources.eggs);
  expect(after.larvaPipeline.count, `${where}: larvae in step`).toBe(after.resources.larvae);
  expect(after.eggPipeline.progress).toBe(before.eggPipeline.progress);
  const had = before.resources.workers;
  if (had > 0) {
    expect(after.resources.workers, `${where}: never the last worker`).toBeGreaterThanOrEqual(1);
    expect(after.resources.workers, `${where}: keeps its floor share`).toBeGreaterThanOrEqual(Math.ceil(had * decisionBalance.workerFloorShare));
  }
  expect(after.workersAssigned.researchers, `${where}: researchers are not decision losses`).toBe(before.workersAssigned.researchers);
  expect(after.decision.open, `${where}: closes the event`).toBeNull();
}

describe('decision outcomes on random states (Story 4.5)', () => {
  it('keep every stock whole and non-negative, and never wipe the colony', () => {
    fc.assert(
      fc.property(arbState, arbOutcome, (base, { def, choice, roll }) => {
        const s = withOpen(base, def, roll);
        const where = `${def.id} ${choice} roll ${roll}`;
        const frozen = JSON.stringify(s);
        const out = applyChoice(s, def, choice);
        expect(JSON.stringify(s), `${where}: input untouched`).toBe(frozen);
        if (!canChoose(s, def, choice)) {
          expect(out, `${where}: refused`).toBe(s);
          return;
        }
        expectSound(s, out, where);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('every event and outcome is reached: each choice and each ignore, at both ends of the roll', () => {
    const rich = createInitialState();
    rich.resources = { ...rich.resources, workers: 100, food: 1e6, wood: 1e6, stone: 1e6, nectar: 1e6, eggs: 100, larvae: 100, nestCapacity: 100 };
    rich.eggPipeline = { count: 100, progress: 0 };
    rich.larvaPipeline = { count: 100, progress: 0 };
    rich.workersAssigned = { ...rich.workersAssigned, guard: 10, gather: 10 };
    rich.combatSoldiers = 50;
    rich.soldiers = { ...rich.soldiers, scouts: 5 };
    for (const def of DECISIONS) {
      for (const choice of [...def.choices.map((c) => c.id), 'ignore']) {
        for (const roll of [0, 0.999]) {
          const s = withOpen({ ...rich, phase: def.phases[0] }, def, roll);
          if (choice === 'ignore' && def.ignorePolicy === 'unavoidable') {
            expect(canChoose(s, def, choice)).toBe(false);
            continue;
          }
          expect(canChoose(s, def, choice), `${def.id} ${choice}`).toBe(true);
          expectSound(s, applyChoice(s, def, choice), `${def.id} ${choice} ${roll}`);
        }
      }
    }
  });

  it('an unavoidable event always leaves a choice the colony can take', () => {
    const unavoidable = DECISIONS.filter((d) => d.ignorePolicy === 'unavoidable');
    expect(unavoidable.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(arbState, fc.constantFrom(...unavoidable), (base, def) => {
        const s = withOpen(base, def, 0.5);
        expect(def.choices.some((c) => canChoose(s, def, c.id)), def.id).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it('no outcome mints workers: soldiers sent back to work return at most the workers training them took (Story 4.4)', () => {
    for (const def of DECISIONS) {
      for (const c of def.choices) {
        const all = [...c.effects, ...(c.risk?.effects ?? [])];
        const net = (stock: string) => all.reduce((a, e) => a + (e.kind === 'add' && e.stock === stock ? e.amount : 0), 0);
        const soldiersLost = -Math.min(0, net('soldiers'));
        if (soldiersLost === 0) continue;
        expect(net('workers'), `${def.id}.${c.id}`).toBeLessThanOrEqual(soldiersLost * combatBalance.army.workersPerSoldier);
      }
    }
  });

  it('a worker loss takes free workers first, then workers off their roles', () => {
    const loses = DECISIONS.flatMap((d) =>
      [...d.choices.map((c) => [d, c.id, [...c.effects, ...(c.risk?.effects ?? [])]] as const), [d, 'ignore', d.ignore ?? []] as const].filter(([, , effects]) =>
        effects.some((e) => 'stock' in e && e.stock === 'workers' && (e.kind === 'lose_percent' || e.amount < 0)),
      ),
    );
    expect(loses.length).toBeGreaterThan(0);
    for (const [def, choice] of loses) {
      const s = withOpen({ ...createInitialState(), phase: Phase.COLONY }, def, 0);
      // Every worker on a role: the loss must come off the roles.
      const busy: GameState = {
        ...s,
        resources: { ...s.resources, workers: 40, food: 1e6, stone: 1e6 },
        workersAssigned: { ...s.workersAssigned, gather: 20, dig: 20 },
        combatSoldiers: 50,
      };
      const out = applyChoice(busy, def, choice);
      if (out.resources.workers < busy.resources.workers) expect(jobTotal(out)).toBeLessThan(jobTotal(busy));
      // Plenty free: the roles are untouched.
      const idle: GameState = { ...busy, resources: { ...busy.resources, workers: 400 } };
      const out2 = applyChoice(idle, def, choice);
      expect(out2.workersAssigned).toEqual(idle.workersAssigned);
    }
  });
});
