import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { BattleSystem } from '../../../src/systems/BattleSystem';
import { getBuildCost, getEffects, isBuildingOpen } from '../../../src/systems/BuildingSystem';
import { prestige } from '../../../src/systems/PrestigeSystem';
import { BUILDING_UNLOCK_PHASE } from '../../../src/data/content/buildings';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase } from '../../../src/phases/phases';
import { rngFromSeed } from '../../../src/utils/rng';
import { makeState } from '../helpers/makeState';

/**
 * Story 4.8 (FR19, P1/P4): the Midden, a Combat building. The colony carries
 * its fallen to the midden: every soldier lost in a battle, won or lost,
 * leaves chitin there, more with each level. Invariants only.
 */

const fight = (s: GameState) => new BattleSystem(new EventBus()).resolveBattle(s);
const withMidden = (s: GameState, level: number): GameState => ({ ...s, buildings: { ...s.buildings, midden: { level } } });

/** Battles that cost soldiers: small armies against every enemy, many seeds. */
function bloodyBattles(): GameState[] {
  const out: GameState[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    for (const enemy of ['red_ant', 'termite', 'spider', 'beetle', 'wasp'] as const) {
      out.push(makeState({ phase: 'combat', combatSoldiers: 1 + (seed % 7), nextEnemy: enemy, rng: rngFromSeed(seed) }));
    }
  }
  return out;
}

describe('the Midden (Story 4.8)', () => {
  it('opens with the battles, in Combat, and starts unbuilt', () => {
    expect(BUILDING_UNLOCK_PHASE.midden).toBe(Phase.COMBAT);
    expect(createInitialState().buildings.midden.level).toBe(0);
    expect(isBuildingOpen('midden', makeState({ phase: 'colony' }))).toBe(false);
    expect(isBuildingOpen('midden', makeState({ phase: 'combat' }))).toBe(true);
  });

  it('costs only what the colony makes before Combat, in whole numbers, more each level', () => {
    const one = getBuildCost('midden', 1);
    const two = getBuildCost('midden', 2);
    expect(one.chitin + one.silk + one.venom).toBe(0);
    for (const v of Object.values(one)) expect(Number.isInteger(v)).toBe(true);
    expect(Object.values(one).some((v) => v > 0)).toBe(true);
    for (const k of Object.keys(one) as (keyof typeof one)[]) expect(two[k]).toBeGreaterThanOrEqual(one[k]);
  });

  it('salvages a whole number of chitin per fallen soldier, more with each level', () => {
    expect(getEffects('midden', 0).salvagePerFallen ?? 0).toBe(0);
    const one = getEffects('midden', 1).salvagePerFallen;
    const two = getEffects('midden', 2).salvagePerFallen;
    expect(Number.isInteger(one)).toBe(true);
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
  });

  it('every soldier lost leaves chitin to a standing midden, in victory and defeat alike', () => {
    let lossy = 0;
    const outcomes = new Set<string>();
    for (const s of bloodyBattles()) {
      const without = fight(s);
      const withIt = fight(withMidden(s, 1));
      // The midden changes no roll: the same soldiers fall.
      expect(withIt.result.outcome).toBe(without.result.outcome);
      expect(withIt.result.soldiersLost).toBe(without.result.soldiersLost);
      const extra = withIt.newState.combatResources.chitin - without.newState.combatResources.chitin;
      expect(Number.isInteger(extra)).toBe(true);
      expect(withIt.result.specialLoot.chitin - without.result.specialLoot.chitin).toBe(extra);
      if (without.result.soldiersLost > 0) {
        lossy++;
        outcomes.add(without.result.outcome);
        expect(extra).toBeGreaterThanOrEqual(without.result.soldiersLost);
        expect(withIt.result.narrative).toContain('MIDDEN');
      } else {
        expect(extra).toBe(0);
      }
    }
    expect(lossy).toBeGreaterThan(0);
    expect(outcomes.has('victory') && outcomes.has('defeat')).toBe(true);
  });

  it('without a midden the fallen leave nothing', () => {
    for (const s of bloodyBattles().slice(0, 20)) {
      expect(fight(s).result.narrative).not.toContain('MIDDEN');
    }
  });

  it('a prestige tears it down', () => {
    const s = withMidden(makeState({ phase: 'combat' }), 3);
    expect(prestige(s).buildings.midden.level).toBe(0);
  });
});
