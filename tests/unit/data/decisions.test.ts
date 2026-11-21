import { describe, it, expect } from 'vitest';
import { DECISIONS, DECISION_IDS, getDecision } from '../../../src/data/content/decisions';
import { PHASE_ORDER } from '../../../src/phases/phases';

/**
 * Story 1.28 (D8): decision events are data. Each declares its phases, an
 * ignore policy, an optional timer, the IGNORE line and exactly two choices.
 */
describe('decision content', () => {
  it('converts the 3 legacy events (beetle, overcrowding, scouts)', () => {
    expect(DECISIONS.length).toBe(3);
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
      if (e.ignorePolicy === 'free') expect(e.ignore?.length ?? 0).toBe(0);
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
