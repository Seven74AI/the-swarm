import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_TYPES, TRAITS, enemyCardTitle, isEnemyType } from '../../../src/data/content/enemies';
import { enemyBalance } from '../../../src/data/balance/enemies';
import { getEnemyDefs, getRandomEnemy } from '../../../src/systems/EnemySystem';
import { rngStream } from '../../../src/utils/rng';
import { colonyVoiceProblem } from '../../arch/voice';

/**
 * Story 4.1 (FR12, UX-DR26): the enemy types are content, each with a trait
 * and the stats the trait changes; their numbers stay in data/balance.
 */
describe('enemy content (Story 4.1)', () => {
  it('lists the starting six, each with a name and a trait', () => {
    expect([...ENEMY_TYPES].sort()).toEqual(['beetle', 'red_ant', 'scorpion', 'spider', 'termite', 'wasp']);
    for (const type of ENEMY_TYPES) {
      expect(ENEMIES[type].name.length).toBeGreaterThan(0);
      expect(Object.keys(TRAITS)).toContain(ENEMIES[type].trait);
    }
  });

  it('every trait names the stats it affects and has numbers in the balance file', () => {
    for (const [id, trait] of Object.entries(TRAITS)) {
      expect(trait.affects.length, id).toBeGreaterThan(0);
      expect(Object.keys(enemyBalance.traits), id).toContain(id);
      expect(Object.keys(enemyBalance.traits[id as keyof typeof enemyBalance.traits]).length, id).toBeGreaterThan(0);
    }
  });

  it('every enemy has balance stats, and no balance entry lacks content', () => {
    expect(Object.keys(enemyBalance.stats).sort()).toEqual([...ENEMY_TYPES].sort());
  });

  it('a trait line keeps the colony voice', () => {
    for (const [id, trait] of Object.entries(TRAITS)) {
      expect(colonyVoiceProblem(trait.line), id).toBeNull();
      expect(trait.label, id).toBe(trait.label.toUpperCase());
    }
  });

  it('the card title is the type and the trait, upper case: ARMORED BEETLE · THICK SHELL', () => {
    const title = enemyCardTitle('beetle');
    expect(title).toBe(`${ENEMIES.beetle.name.toUpperCase()} · ${TRAITS[ENEMIES.beetle.trait].label}`);
    expect(title).toBe(title.toUpperCase());
  });

  it('isEnemyType knows the types and nothing else', () => {
    for (const t of ENEMY_TYPES) expect(isEnemyType(t)).toBe(true);
    for (const x of ['none', '', 42, null, undefined, 'BEETLE']) expect(isEnemyType(x)).toBe(false);
  });

  it('the generator can draw at least 3 types, with different traits, in Phase 3 (before the boss)', () => {
    const rng = rngStream(1);
    const seen = new Set<string>();
    for (let won = 0; won < enemyBalance.bossFromBattlesWon; won++) {
      for (let i = 0; i < 200; i++) seen.add(getRandomEnemy(won, rng).type);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    const traits = new Set([...seen].map((t) => ENEMIES[t as keyof typeof ENEMIES].trait));
    expect(traits.size).toBeGreaterThanOrEqual(3);
  });

  it('every enemy definition carries its trait', () => {
    for (const def of getEnemyDefs()) expect(def.trait).toBe(ENEMIES[def.type as keyof typeof ENEMIES].trait);
  });
});
