import { describe, expect, it } from 'vitest';
import { armyOf, fightRounds } from '../../../src/systems/CombatRounds';
import { getEnemyDef, scaleEnemy } from '../../../src/systems/EnemySystem';
import { getEffects } from '../../../src/systems/BuildingSystem';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';
import { fixedRng } from '../helpers/rng';

/**
 * Story 4.8: the Walls card says DEFENSE +N %, and the battle now agrees.
 * Each level raises the army's defence by its share, so enemy hits land
 * softer and fewer soldiers fall. Invariants only.
 */

const withWalls = (level: number): GameState => makeState({ phase: 'combat', combatSoldiers: 6, buildings: { walls: { level } } });

describe('Walls defend the army (Story 4.8)', () => {
  it('each level raises the army defence by the share its card shows', () => {
    const base = armyOf(withWalls(0)).defense;
    let before = base;
    for (const level of [1, 2, 5, 8]) {
      const d = armyOf(withWalls(level)).defense;
      expect(d).toBeGreaterThan(before);
      expect(d).toBeCloseTo(base * (1 + getEffects('walls', level).defenseBonus), 9);
      before = d;
    }
  });

  it('the army keeps more hit points against the same enemy behind higher walls', () => {
    const enemy = scaleEnemy(getEnemyDef('red_ant'), 2);
    const left = (level: number) => fightRounds(armyOf(withWalls(level)), enemy, fixedRng(0.5));
    const low = left(0);
    const high = left(5);
    expect(high.armyHp).toBe(low.armyHp);
    expect(low.outcome).toBe('victory');
    expect(high.armyHpLeft).toBeGreaterThan(low.armyHpLeft);
  });
});
