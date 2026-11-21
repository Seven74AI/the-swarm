import { describe, it, expect } from 'vitest';
import {
  DECISIONS,
  DECISION_IDS,
  DECISION_STOCKS,
  getDecision,
  type DecisionChoiceDef,
  type DecisionDef,
  type DecisionEffect,
} from '../../../src/data/content/decisions';
import { PHASE_ORDER, Phase } from '../../../src/phases/phases';
import { isUnlocked } from '../../../src/data/content/tabs';
import { ROLES } from '../../../src/data/content/roles';
import { RESOURCES } from '../../../src/ui/shell/resourceCatalog';

/**
 * Story 1.28 (D8): decision events are data. Each declares its phases, an
 * ignore policy, an optional timer, the IGNORE line and exactly two choices.
 *
 * Story 4.5 (FR13, FR14): each MVP phase has its own dilemmas. Egg Laying,
 * Colony and Combat each have at least 3 events unique to that phase, every
 * choice shows what it costs or risks, and the content names nothing the
 * player has not met yet. Invariants only: no amount is restated here.
 */

const MVP: readonly Phase[] = [Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT];
const firstPhase = (d: DecisionDef): Phase => PHASE_ORDER.find((p) => d.phases.includes(p))!;
const mvpPhases = (d: DecisionDef): Phase[] => d.phases.filter((p) => MVP.includes(p));
const texts = (d: DecisionDef): string[] => [d.title, d.situation, d.ignoreLine, ...d.choices.flatMap((c) => [c.label, c.costLine])];
const effectsOf = (c: DecisionChoiceDef): DecisionEffect[] => [...c.effects, ...(c.risk?.effects ?? [])];
const allEffects = (d: DecisionDef): DecisionEffect[] => [...d.choices.flatMap(effectsOf), ...(d.ignore ?? [])];
const stockOf = (e: DecisionEffect): keyof typeof DECISION_STOCKS | null => ('stock' in e ? e.stock : null);
const MINUS = '−';

describe('decision content', () => {
  it('has unique ids, each found by getDecision', () => {
    expect(new Set(DECISION_IDS).size).toBe(DECISIONS.length);
    for (const id of DECISION_IDS) expect(getDecision(id).id).toBe(id);
  });

  it('gives every event two choices with a visible cost or risk line', () => {
    for (const e of DECISIONS) {
      expect(e.choices.length).toBe(2);
      expect(new Set(e.choices.map((c) => c.id)).size).toBe(2);
      for (const c of e.choices) {
        expect(c.label.trim()).not.toBe('');
        expect(c.costLine.trim()).not.toBe('');
      }
    }
  });

  it('times free and costly events; unavoidable ones have no timer', () => {
    for (const e of DECISIONS) {
      if (e.ignorePolicy === 'unavoidable') expect(e.timerMs).toBeUndefined();
      else expect(e.timerMs).toBeGreaterThan(0);
    }
  });

  it('a costly ignore has an outcome; a free one has none', () => {
    for (const e of DECISIONS) {
      if (e.ignorePolicy === 'costly') expect(e.ignore?.length ?? 0).toBeGreaterThan(0);
      if (e.ignorePolicy !== 'costly') expect(e.ignore?.length ?? 0).toBe(0);
      expect(e.ignoreLine.trim()).not.toBe('');
    }
  });

  it('covers every ignore policy, and only real phases', () => {
    expect(new Set(DECISIONS.map((e) => e.ignorePolicy))).toEqual(new Set(['free', 'costly', 'unavoidable']));
    for (const e of DECISIONS) {
      expect(e.phases.length).toBeGreaterThan(0);
      for (const p of e.phases) expect(PHASE_ORDER).toContain(p);
    }
  });

  it('getDecision throws on an unknown id', () => {
    expect(() => getDecision('nope' as never)).toThrow();
  });
});

describe('each MVP phase has its own dilemmas (Story 4.5)', () => {
  it('Egg Laying, Colony and Combat each have at least 3 events unique to that phase', () => {
    for (const phase of MVP) {
      const own = DECISIONS.filter((d) => mvpPhases(d).length === 1 && mvpPhases(d)[0] === phase);
      expect(own.length, phase).toBeGreaterThanOrEqual(3);
    }
  });

  it('no event is shared between two MVP phases', () => {
    for (const d of DECISIONS) expect(mvpPhases(d).length, d.id).toBeLessThanOrEqual(1);
  });

  it('the MVP set has a free, a costly and an unavoidable ignore (EXPERIENCE Flow 4)', () => {
    const mvpSet = DECISIONS.filter((d) => mvpPhases(d).length > 0);
    expect(new Set(mvpSet.map((d) => d.ignorePolicy))).toEqual(new Set(['free', 'costly', 'unavoidable']));
    expect(getDecision('beetle_sighting').ignorePolicy).toBe('costly');
    expect(getDecision('overcrowding').ignorePolicy).toBe('unavoidable');
    for (const id of ['beetle_sighting', 'overcrowding'] as const) expect(mvpPhases(getDecision(id)).length).toBe(1);
  });

  it('an unavoidable event always has a choice the colony can take (one with no requirement)', () => {
    for (const d of DECISIONS.filter((x) => x.ignorePolicy === 'unavoidable')) {
      expect(d.choices.some((c) => !c.requires), d.id).toBe(true);
    }
  });

  it('a free ignore says so: IGNORE: NOTHING HAPPENS', () => {
    for (const d of DECISIONS.filter((x) => x.ignorePolicy === 'free')) expect(d.ignoreLine, d.id).toBe('NOTHING HAPPENS');
  });
});

describe('the sheet shows what each choice costs or risks', () => {
  const mentions = (line: string, stock: keyof typeof DECISION_STOCKS): boolean =>
    line.includes(DECISION_STOCKS[stock].name) || line.includes(DECISION_STOCKS[stock].one);

  it('every amount a choice changes is on its cost line, with its sign and its stock', () => {
    for (const d of DECISIONS) {
      for (const c of d.choices) {
        for (const e of effectsOf(c)) {
          const where = `${d.id}.${c.id}: "${c.costLine}"`;
          if (e.kind === 'add') {
            expect(c.costLine, where).toContain(`${e.amount < 0 ? MINUS : '+'}${Math.abs(e.amount)}`);
            expect(mentions(c.costLine, e.stock), where).toBe(true);
          } else if (e.kind === 'lose_percent') {
            expect(c.costLine, where).toContain(`${MINUS}${e.percent}%`);
            expect(mentions(c.costLine, e.stock), where).toBe(true);
          } else {
            expect(c.costLine, where).toContain(`${e.count}`);
          }
        }
      }
    }
  });

  it('a risk shows its odds as 1 IN N', () => {
    for (const d of DECISIONS) {
      for (const c of d.choices) {
        if (!c.risk) continue;
        expect(c.risk.chance).toBeGreaterThan(0);
        expect(c.risk.chance).toBeLessThan(1);
        expect(c.costLine, `${d.id}.${c.id}`).toContain(`1 IN ${Math.round(1 / c.risk.chance)}`);
      }
    }
  });

  it("a costly ignore's outcome is in its ignore line", () => {
    for (const d of DECISIONS.filter((x) => x.ignorePolicy === 'costly')) {
      for (const e of d.ignore ?? []) {
        const s = stockOf(e);
        if (s) expect(d.ignoreLine.includes(DECISION_STOCKS[s].name) || d.ignoreLine.includes(DECISION_STOCKS[s].one), d.id).toBe(true);
      }
    }
  });

  it('a requirement is for a stock the choice spends', () => {
    for (const d of DECISIONS) {
      for (const c of d.choices) {
        if (!c.requires) continue;
        const spends = effectsOf(c).some((e) => stockOf(e) === c.requires!.stock && (e.kind !== 'add' || e.amount < 0));
        expect(spends, `${d.id}.${c.id}`).toBe(true);
        expect(Number.isInteger(c.requires.amount) && c.requires.amount > 0).toBe(true);
      }
    }
  });
});

describe('content names nothing from a later phase (UX-DR42)', () => {
  const word = (w: string): RegExp => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
  /** [term, the phase it first appears in]: stocks, roles, the resource catalog. */
  const vocabulary: [string, Phase][] = [
    ...Object.values(DECISION_STOCKS).flatMap((s): [string, Phase][] => [[s.name, s.firstIn], [s.one, s.firstIn]]),
    ...ROLES.flatMap((r): [string, Phase][] => [[r.label, r.unlockPhase], [r.worker, r.unlockPhase]]),
    ...RESOURCES.flatMap((r): [string, Phase][] => [[r.name, r.unlockPhase], [r.label, r.unlockPhase]]),
  ];

  it('an event names no stock, role or resource that opens after its first phase', () => {
    const bad = DECISIONS.flatMap((d) => {
      const from = firstPhase(d);
      return texts(d).flatMap((t) =>
        vocabulary.filter(([term, phase]) => !isUnlocked(phase, from) && word(term).test(t)).map(([term, phase]) => `${d.id}: "${t}" names ${term} (${phase})`),
      );
    });
    expect(bad).toEqual([]);
  });

  it('an event changes only stocks that exist by its first phase', () => {
    for (const d of DECISIONS) {
      for (const e of allEffects(d)) {
        const s = stockOf(e);
        if (s) expect(isUnlocked(DECISION_STOCKS[s].firstIn, firstPhase(d)), `${d.id} touches ${s}`).toBe(true);
      }
      for (const c of d.choices) {
        if (c.requires) expect(isUnlocked(DECISION_STOCKS[c.requires.stock].firstIn, firstPhase(d)), `${d.id}.${c.id}`).toBe(true);
      }
    }
  });

  it('the check catches what it should', () => {
    const later = vocabulary.filter(([, p]) => !isUnlocked(p, Phase.EGG_LAYING)).map(([t]) => t);
    expect(later.some((t) => word(t).test('SEND THE SOLDIERS.'))).toBe(true);
    expect(later.some((t) => word(t).test('+10 STONE'))).toBe(true);
    expect(later.some((t) => word(t).test('THE QUEEN LAYS EGGS.'))).toBe(false);
  });
});
