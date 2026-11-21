import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/state/GameState';
import { rngFromSeed, rngStream } from '../../src/utils/rng';
import { assessMatchup } from '../../src/systems/CombatRounds';
import {
  getEnemyDef,
  getEnemyDefs,
  getRandomEnemy,
  peekEnemy,
  scaleEnemy,
  type EnemyDef,
} from '../../src/systems/EnemySystem';
import { enemyBalance } from '../../src/data/balance/enemies';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { combatBalance } from '../../src/data/balance/combat';

const BOSS = enemyBalance.bossFromBattlesWon;

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
    trait: 'swarm',
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
    it('every enemy has a name and positive whole-number stats', () => {
      for (const def of getEnemyDefs()) {
        expect(getEnemyDef(def.type)).toEqual(def);
        expect(def.name, def.type).toBeTruthy();
        for (const stat of ['strength', 'defense', 'speed', 'hp'] as const) {
          expect(Number.isInteger(def[stat]) && def[stat] > 0, `${def.type}.${stat}`).toBe(true);
        }
      }
    });

    it('loot ranges never go negative and min ≤ max', () => {
      for (const def of getEnemyDefs()) {
        expect(def.loot.foodMin, def.type).toBeGreaterThanOrEqual(0);
        expect(def.loot.foodMin, def.type).toBeLessThanOrEqual(def.loot.foodMax);
        const special = def.loot.specialResource;
        if (special === undefined) continue;
        expect(special.min, def.type).toBeGreaterThanOrEqual(0);
        expect(special.min, def.type).toBeLessThanOrEqual(special.max);
      }
    });

    it('each combat resource drops from its enemy: spider silk, beetle chitin, wasp and scorpion venom', () => {
      expect(getEnemyDef('red_ant').loot.specialResource).toBeUndefined();
      expect(getEnemyDef('spider').loot.specialResource?.type).toBe('silk');
      expect(getEnemyDef('beetle').loot.specialResource?.type).toBe('chitin');
      expect(getEnemyDef('wasp').loot.specialResource?.type).toBe('venom');
      expect(getEnemyDef('scorpion').loot.specialResource?.type).toBe('venom');
    });

    it('the red ant is the weakest enemy and the scorpion the toughest and richest', () => {
      const defs = getEnemyDefs();
      const red = getEnemyDef('red_ant');
      const scorpion = getEnemyDef('scorpion');
      for (const def of defs) {
        expect(red.strength, def.type).toBeLessThanOrEqual(def.strength);
        expect(red.hp, def.type).toBeLessThanOrEqual(def.hp);
        expect(scorpion.hp, def.type).toBeGreaterThanOrEqual(def.hp);
        expect(scorpion.loot.foodMax, def.type).toBeGreaterThanOrEqual(def.loot.foodMax);
      }
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
    // A fixed seed (Story 3.1): one stream drawn on across the rolls.
    const rng = rngStream(rngFromSeed(31));

    it('draws from the stream it is given: the same state gives the same enemy, and peeking does not draw', () => {
      const state = rngFromSeed(8);
      const a = rngStream(state);
      expect(getRandomEnemy(5, a)).toEqual(getRandomEnemy(5, rngStream(state)));
      expect(a.state).not.toBe(state);
      expect(peekEnemy(state, 5)).toEqual(getRandomEnemy(5, rngStream(state)));
    });

    it('returns a valid enemy def', () => {
      const enemy = getRandomEnemy(0, rng);
      const defs = getEnemyDefs();
      const found = defs.find((d) => d.type === enemy.type);
      expect(found).toBeDefined();
    });

    it('never returns Scorpion before the boss threshold (test 200 rolls)', () => {
      for (let i = 0; i < 200; i++) {
        const enemy = getRandomEnemy(BOSS - 1, rng);
        expect(enemy.type).not.toBe('scorpion');
      }
    });

    it('can return Scorpion from the boss threshold (test 500 rolls)', () => {
      let foundScorpion = false;
      for (let i = 0; i < 500; i++) {
        const enemy = getRandomEnemy(BOSS, rng);
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
        const enemy = getRandomEnemy(0, rng);
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
    it('the exponent lives in data/balance/combat.ts and is below 1 (Story 4.1)', () => {
      expect(combatBalance.enemyScalingExponent).toBeGreaterThan(0);
      expect(combatBalance.enemyScalingExponent).toBeLessThan(1);
    });

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

describe('assessMatchup (Story 1.25: the enemy card)', () => {
  const ORDER = ['dangerous', 'even', 'favoured'] as const;
  const rank = (m: string) => ORDER.indexOf(m as (typeof ORDER)[number]);
  const army = (combatSoldiers: number, weapon = 0) => {
    const s = createInitialState();
    return { ...s, combatSoldiers, equipment: { ...s.equipment, weapon } };
  };

  it('calls an empty army outmatched by every enemy', () => {
    for (const e of getEnemyDefs()) expect(assessMatchup(army(0), e)).toBe('dangerous');
  });

  it('never gets worse with more soldiers or better weapons', () => {
    for (const e of getEnemyDefs()) {
      let last = -1;
      for (const n of [1, 2, 5, 10, 50, 500]) {
        const r = rank(assessMatchup(army(n), e));
        expect(r).toBeGreaterThanOrEqual(last);
        last = r;
      }
      expect(rank(assessMatchup(army(5, 5), e))).toBeGreaterThanOrEqual(rank(assessMatchup(army(5, 0), e)));
    }
  });

  it('favours a big enough, fully armed army against anything, whatever its trait', () => {
    for (const e of getEnemyDefs()) expect(assessMatchup(army(100_000, soldierBalance.maxEquipmentLevel), e)).toBe('favoured');
  });

  it('reads the same army differently against different traits (Story 4.1)', () => {
    const reads = new Set(getEnemyDefs().map((e) => assessMatchup(army(5), e)));
    expect(reads.size).toBeGreaterThan(1);
  });
});
