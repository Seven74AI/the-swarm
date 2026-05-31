import { describe, it, expect } from 'vitest';
import {
  getEnemyDef,
  getEnemyDefs,
  getRandomEnemy,
  scaleEnemy,
  type EnemyDef,
} from '../../src/systems/EnemySystem';

/** Helper: a minimal EnemyDef for scaleEnemy invariant testing. */
function makeEnemy(overrides: {
  baseStrength?: number;
  baseHp?: number;
  strengthPerBattle?: number;
  hpPerBattle?: number;
}): EnemyDef {
  return {
    type: 'test_dummy',
    name: 'Test Dummy',
    strength: overrides.baseStrength ?? 0,
    defense: 1,
    speed: 5,
    hp: overrides.baseHp ?? 0,
    loot: { foodMin: 0, foodMax: 0 },
    scaling: {
      strengthPerBattle: overrides.strengthPerBattle ?? 1,
      hpPerBattle: overrides.hpPerBattle ?? 5,
    },
  };
}

describe('EnemySystem', () => {
  describe('getEnemyDef', () => {
    it('returns correct stats for Red Ant', () => {
      const def = getEnemyDef('red_ant');
      expect(def.type).toBe('red_ant');
      expect(def.name).toBe('Red Ant');
      expect(def.strength).toBe(3);
      expect(def.defense).toBe(1);
      expect(def.speed).toBe(10);
      expect(def.hp).toBe(15);
      expect(def.loot.foodMin).toBe(5);
      expect(def.loot.foodMax).toBe(10);
      expect(def.loot.specialResource).toBeUndefined();
    });

    it('returns correct stats for Termite', () => {
      const def = getEnemyDef('termite');
      expect(def.type).toBe('termite');
      expect(def.name).toBe('Termite');
      expect(def.strength).toBe(5);
      expect(def.defense).toBe(4);
      expect(def.speed).toBe(4);
      expect(def.hp).toBe(25);
      expect(def.loot.foodMin).toBe(10);
      expect(def.loot.foodMax).toBe(20);
    });

    it('returns correct stats for Spider', () => {
      const def = getEnemyDef('spider');
      expect(def.type).toBe('spider');
      expect(def.strength).toBe(12);
      expect(def.defense).toBe(2);
      expect(def.speed).toBe(8);
      expect(def.hp).toBe(30);
      expect(def.loot.specialResource).toEqual({ type: 'silk', min: 1, max: 3 });
    });

    it('returns correct stats for Beetle', () => {
      const def = getEnemyDef('beetle');
      expect(def.strength).toBe(8);
      expect(def.defense).toBe(8);
      expect(def.hp).toBe(50);
      expect(def.loot.specialResource).toEqual({ type: 'chitin', min: 1, max: 3 });
    });

    it('returns correct stats for Wasp', () => {
      const def = getEnemyDef('wasp');
      expect(def.strength).toBe(15);
      expect(def.speed).toBe(12);
      expect(def.hp).toBe(20);
      expect(def.loot.specialResource).toEqual({ type: 'venom', min: 1, max: 3 });
    });

    it('returns correct stats for Scorpion', () => {
      const def = getEnemyDef('scorpion');
      expect(def.strength).toBe(20);
      expect(def.defense).toBe(6);
      expect(def.hp).toBe(80);
      expect(def.loot.foodMin).toBe(60);
      expect(def.loot.foodMax).toBe(100);
      expect(def.loot.specialResource).toEqual({ type: 'venom', min: 3, max: 8 });
    });

    it('throws for unknown enemy type', () => {
      expect(() => getEnemyDef('nonexistent')).toThrow();
    });
  });

  describe('getEnemyDefs', () => {
    it('returns all 6 enemy types', () => {
      const defs = getEnemyDefs();
      expect(defs).toHaveLength(6);
      const types = defs.map((d) => d.type).sort();
      expect(types).toEqual([
        'beetle',
        'red_ant',
        'scorpion',
        'spider',
        'termite',
        'wasp',
      ]);
    });
  });

  describe('getRandomEnemy', () => {
    it('returns a valid enemy def', () => {
      const enemy = getRandomEnemy(0);
      const defs = getEnemyDefs();
      const found = defs.find((d) => d.type === enemy.type);
      expect(found).toBeDefined();
    });

    it('never returns Scorpion when battlesWon < 5 (test 200 rolls)', () => {
      for (let i = 0; i < 200; i++) {
        const enemy = getRandomEnemy(3);
        expect(enemy.type).not.toBe('scorpion');
      }
    });

    it('can return Scorpion when battlesWon >= 5 (test 500 rolls)', () => {
      let foundScorpion = false;
      for (let i = 0; i < 500; i++) {
        const enemy = getRandomEnemy(5);
        if (enemy.type === 'scorpion') {
          foundScorpion = true;
          break;
        }
      }
      expect(foundScorpion).toBe(true);
    });

    it('returns Red Ant most frequently (40% weight)', () => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < 500; i++) {
        const enemy = getRandomEnemy(0);
        counts[enemy.type] = (counts[enemy.type] || 0) + 1;
      }
      const redAntCount = counts['red_ant'] || 0;
      expect(redAntCount).toBeGreaterThan(counts['termite'] || 0);
      expect(redAntCount).toBeGreaterThan(counts['spider'] || 0);
      expect(redAntCount).toBeGreaterThan(counts['beetle'] || 0);
      expect(redAntCount).toBeGreaterThan(counts['wasp'] || 0);
    });
  });

  describe('scaleEnemy — sub-linear scaling (pow 0.6)', () => {
    it('returns base stats at 0 battles', () => {
      const enemy = makeEnemy({ baseStrength: 20, baseHp: 80 });
      const result = scaleEnemy(enemy, 0);
      expect(result.strength).toBe(20);
      expect(result.hp).toBe(80);
    });

    it('scales up as battles increase', () => {
      const enemy = makeEnemy({ baseStrength: 20, baseHp: 80, strengthPerBattle: 1, hpPerBattle: 5 });
      const at10 = scaleEnemy(enemy, 10);
      const at100 = scaleEnemy(enemy, 100);
      expect(at100.strength).toBeGreaterThan(at10.strength);
      expect(at100.hp).toBeGreaterThan(at10.hp);
    });

    it('growth is sub-linear (diminishing returns)', () => {
      const enemy = makeEnemy({ baseStrength: 0, strengthPerBattle: 1 });
      const at10 = scaleEnemy(enemy, 10);
      const at100 = scaleEnemy(enemy, 100);
      const growthRatio = at100.strength / at10.strength;
      expect(growthRatio).toBeLessThan(10);
      expect(growthRatio).toBeGreaterThan(1.5);
    });

    it('growth rate decelerates from 10→100 vs 100→200', () => {
      const enemy = makeEnemy({ baseStrength: 0, strengthPerBattle: 1 });
      const at10 = scaleEnemy(enemy, 10);
      const at100 = scaleEnemy(enemy, 100);
      const at200 = scaleEnemy(enemy, 200);

      const growth10to100 = at100.strength - at10.strength;
      const growth100to200 = at200.strength - at100.strength;

      expect(growth100to200).toBeLessThan(growth10to100);
    });

    it('does not mutate the original enemy definition', () => {
      const enemy = makeEnemy({ baseStrength: 20, baseHp: 80 });
      const originalStr = enemy.strength;
      const originalHp = enemy.hp;
      scaleEnemy(enemy, 100);
      expect(enemy.strength).toBe(originalStr);
      expect(enemy.hp).toBe(originalHp);
    });

    it('preserves all non-scaled properties', () => {
      const enemy = makeEnemy({ baseStrength: 20, baseHp: 80 });
      const result = scaleEnemy(enemy, 50);
      expect(result.type).toBe('test_dummy');
      expect(result.name).toBe('Test Dummy');
      expect(result.defense).toBe(1);
      expect(result.speed).toBe(5);
      expect(result.loot).toEqual(enemy.loot);
    });

    it('handles large battle counts without exploding', () => {
      const enemy = makeEnemy({ baseStrength: 20, baseHp: 80, strengthPerBattle: 1, hpPerBattle: 5 });
      const result = scaleEnemy(enemy, 10000);
      expect(Number.isFinite(result.strength)).toBe(true);
      expect(Number.isFinite(result.hp)).toBe(true);
      expect(result.strength).toBeGreaterThan(0);
      expect(result.hp).toBeGreaterThan(0);
      // sub-linear at 10000: pow=251.2, str≈271, hp≈1336 — far below linear (10020/50080)
      expect(result.strength).toBeLessThan(1000);
      expect(result.hp).toBeLessThan(2500);
    });
  });
});
