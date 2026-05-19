import { describe, it, expect } from 'vitest';
import {
  getEnemyDef,
  getEnemyDefs,
  getRandomEnemy,
  scaleEnemy,
} from '../../src/systems/EnemySystem';

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
      // Scorpion gives both venom and chitin as special loot
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
      // Red Ant should be most common
      const redAntCount = counts['red_ant'] || 0;
      expect(redAntCount).toBeGreaterThan(counts['termite'] || 0);
      expect(redAntCount).toBeGreaterThan(counts['spider'] || 0);
      expect(redAntCount).toBeGreaterThan(counts['beetle'] || 0);
      expect(redAntCount).toBeGreaterThan(counts['wasp'] || 0);
    });
  });

  describe('scaleEnemy', () => {
    it('returns unmodified enemy at battlesWon=0', () => {
      const base = getEnemyDef('red_ant');
      const scaled = scaleEnemy(base, 0);
      expect(scaled.strength).toBe(base.strength);
      expect(scaled.hp).toBe(base.hp);
    });

    it('increases strength and hp with battlesWon', () => {
      const base = getEnemyDef('red_ant');
      // Red Ant scaling: strengthPerBattle=0.5, hpPerBattle=2
      const scaled = scaleEnemy(base, 4);
      expect(scaled.strength).toBe(base.strength + 2); // 3 + 0.5*4 = 5
      expect(scaled.hp).toBe(base.hp + 8); // 15 + 2*4 = 23
    });

    it('does not modify the original enemy def (immutable)', () => {
      const base = getEnemyDef('red_ant');
      const originalStrength = base.strength;
      const originalHp = base.hp;
      scaleEnemy(base, 5);
      expect(base.strength).toBe(originalStrength);
      expect(base.hp).toBe(originalHp);
    });

    it('scales Scorpion correctly', () => {
      const base = getEnemyDef('scorpion');
      // Scorpion: strengthPerBattle=1, hpPerBattle=5 (boss scales faster)
      const scaled = scaleEnemy(base, 3);
      expect(scaled.strength).toBe(base.strength + 3); // 20 + 1*3
      expect(scaled.hp).toBe(base.hp + 15); // 80 + 5*3
    });
  });
});
