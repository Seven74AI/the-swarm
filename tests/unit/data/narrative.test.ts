import { describe, expect, it } from 'vitest';
import { PHASE_ORDER, Phase } from '../../../src/phases/phases';
import { MVP_PHASES, NARRATIVE_BEATS, beatsFor, entryBeatMilestone, nearGoalMilestone } from '../../../src/data/content/narrative';
import { REVEAL_LINES } from '../../../src/data/content/phaseReveal';
import { COLONY_LINES } from '../../../src/data/content/colonyLines';
import { narrativeBalance } from '../../../src/data/balance/narrative';
import { colonyVoiceProblem, namesLaterPhase } from '../../arch/voice';

/** Story 4.9 (FR19, GDD Pillar 2): each MVP phase has a story beat on entry and one near its goal. */
describe('narrative beats (Story 4.9)', () => {
  const beats = MVP_PHASES.flatMap((p) => [
    { phase: p, kind: 'entry', line: NARRATIVE_BEATS[p].entry },
    { phase: p, kind: 'nearGoal', line: NARRATIVE_BEATS[p].nearGoal },
  ]);

  it('covers exactly the MVP phases, in phase order', () => {
    expect(MVP_PHASES).toEqual(PHASE_ORDER.slice(0, MVP_PHASES.length));
    expect(MVP_PHASES).toContain(Phase.EGG_LAYING);
    expect(MVP_PHASES).toContain(Phase.COMBAT);
    expect(Object.keys(NARRATIVE_BEATS).sort()).toEqual([...MVP_PHASES].sort());
  });

  it('every beat keeps the colony voice (UX-DR42)', () => {
    const bad = beats.flatMap((b) => {
      const problem = colonyVoiceProblem(b.line.text);
      return problem ? [`${b.phase}.${b.kind}: "${b.line.text}" ${problem}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('every beat is shown from its own phase and names no later phase', () => {
    for (const b of beats) expect(b.line.from, `${b.phase}.${b.kind}`).toBe(b.phase);
    const bad = beats.flatMap((b) => {
      const later = namesLaterPhase(b.line.text, b.phase);
      return later ? [`${b.phase}.${b.kind}: "${b.line.text}" names ${later}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('every beat is its own line, not a copy of another line', () => {
    const texts = beats.map((b) => b.line.text);
    expect(new Set(texts).size).toBe(texts.length);
    const others = Object.entries(COLONY_LINES)
      .filter(([id]) => id !== 'opening')
      .map(([, l]) => l.text);
    expect(texts.filter((t) => others.includes(t))).toEqual([]);
  });

  it('the reveal types the entry beat of each MVP phase', () => {
    for (const p of MVP_PHASES) expect(REVEAL_LINES[p]).toBe(NARRATIVE_BEATS[p].entry.text);
  });

  it('a new chronicle opens with the first phase entry beat', () => {
    expect(COLONY_LINES.opening.text).toBe(NARRATIVE_BEATS[Phase.EGG_LAYING].entry.text);
  });

  it('beatsFor finds the MVP beats and nothing for later phases', () => {
    for (const p of MVP_PHASES) expect(beatsFor(p)).toBe(NARRATIVE_BEATS[p]);
    for (const p of PHASE_ORDER.slice(MVP_PHASES.length)) expect(beatsFor(p)).toBeUndefined();
    expect(beatsFor('nowhere')).toBeUndefined();
  });

  it('milestone ids differ per phase and kind', () => {
    const ids = MVP_PHASES.flatMap((p) => [entryBeatMilestone(p), nearGoalMilestone(p)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the near-goal threshold is a whole percentage short of the goal', () => {
    expect(Number.isInteger(narrativeBalance.nearGoalPercent)).toBe(true);
    expect(narrativeBalance.nearGoalPercent).toBeGreaterThan(0);
    expect(narrativeBalance.nearGoalPercent).toBeLessThan(100);
  });
});
