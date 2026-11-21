import { describe, expect, it } from 'vitest';
import {
  armyHitPerRound,
  armyStrikesFirst,
  enemyStrikesPerRound,
  fightRounds,
  poisonPerRound,
  soldierHit,
  strikers,
  type Army,
} from '../../src/systems/CombatRounds';
import { getEnemyDef, type EnemyDef } from '../../src/systems/EnemySystem';
import { enemyBalance } from '../../src/data/balance/enemies';
import { combatBalance } from '../../src/data/balance/combat';
import type { TraitId } from '../../src/data/content/enemies';
import { fixedRng } from './helpers/rng';

/**
 * Story 4.1 (FR12): each trait changes the stats it names, so an enemy
 * rewards one kind of army over another. These pin the direction of each
 * trait against the same enemy with a trait that leaves that stat alone.
 */

const army = (over: Partial<Army> = {}): Army => ({
  soldiers: 10,
  strength: 1,
  defense: 1,
  speed: 5,
  maxHp: 10,
  poisonPerRound: 0,
  webStrikers: 0,
  healPerRound: 0,
  firstStrike: false,
  ...over,
});

/** The same enemy (a beetle's stats) with another trait. */
const withTrait = (trait: TraitId, over: Partial<EnemyDef> = {}): EnemyDef => ({ ...getEnemyDef('beetle'), trait, ...over });
/** A trait that changes nothing the test looks at. */
const plain = (over: Partial<EnemyDef> = {}) => withTrait('venom_resistance', over);

describe('enemy traits (Story 4.1)', () => {
  it('swarm: strength past its cap lands no harder, so more soldiers beat sharper weapons', () => {
    const cap = enemyBalance.traits.swarm.hitCap;
    const swarm = withTrait('swarm');
    expect(soldierHit(cap + 1, swarm)).toBe(soldierHit(cap + 5, swarm));
    expect(soldierHit(cap + 5, plain())).toBeGreaterThan(soldierHit(cap + 1, plain()));
    expect(armyHitPerRound(army({ soldiers: 30 }), swarm)).toBeGreaterThan(armyHitPerRound(army({ soldiers: 10, strength: cap + 5 }), swarm));
  });

  it('thick shell: weak bites glance off, but still land (no unbeatable enemy)', () => {
    const shell = withTrait('thick_shell');
    expect(soldierHit(1, shell)).toBeLessThan(soldierHit(1, plain()));
    expect(soldierHit(1, shell)).toBeGreaterThan(0);
    // A sharper weapon keeps a bigger share of its strength.
    expect(soldierHit(6, shell) / 6).toBeGreaterThan(soldierHit(1, shell) / 1);
  });

  it('thick shell and venom resistance: venom lands only in part', () => {
    const venomous = army({ poisonPerRound: 10 });
    for (const t of ['thick_shell', 'venom_resistance'] as const) {
      expect(poisonPerRound(venomous, withTrait(t))).toBeLessThan(poisonPerRound(venomous, withTrait('swarm')));
    }
  });

  it('web: soldiers past the few that strike add no damage, only hit points', () => {
    const web = withTrait('web');
    const most = enemyBalance.traits.web.strikersMax;
    expect(strikers(army({ soldiers: most * 3 }), web)).toBe(most);
    expect(armyHitPerRound(army({ soldiers: most * 3 }), web)).toBe(armyHitPerRound(army({ soldiers: most }), web));
    expect(armyHitPerRound(army({ soldiers: most * 3 }), plain())).toBeGreaterThan(armyHitPerRound(army({ soldiers: most }), plain()));
  });

  it('swift: strikes first however fast the soldiers are, and more than once', () => {
    const fast = army({ speed: 1_000 });
    expect(armyStrikesFirst(fast, withTrait('swift'))).toBe(false);
    expect(armyStrikesFirst(fast, plain())).toBe(true);
    expect(enemyStrikesPerRound(withTrait('swift'))).toBeGreaterThan(enemyStrikesPerRound(plain()));
  });

  it('regrowth: an army too weak to outpace the healing never wins, unless venom stops it', () => {
    // Harmless to the army, so only the healing decides it; without it the army needs half the rounds.
    const heal = enemyBalance.traits.regrowth.regrowthPerRound;
    const harmless = { strength: 0, hp: (heal * combatBalance.maxRounds) / 4, defense: 1 };
    const weak = army({ soldiers: 1, strength: heal / 2 });
    const rng = () => fixedRng(0.5);
    expect(fightRounds(weak, withTrait('regrowth', harmless), rng()).outcome).toBe('draw');
    expect(fightRounds(weak, plain(harmless), rng()).outcome).toBe('victory');
    const poisoned = { ...weak, poisonPerRound: 1 };
    expect(fightRounds(poisoned, withTrait('regrowth', harmless), rng()).outcome).toBe('victory');
  });

  it('a fight lasts 1 to maxRounds rounds and leaves the army no more hit points than it had', () => {
    for (const type of ['red_ant', 'termite', 'spider', 'beetle', 'wasp', 'scorpion']) {
      for (const soldiers of [1, 5, 50]) {
        const r = fightRounds(army({ soldiers }), getEnemyDef(type), fixedRng(0.3));
        expect(r.rounds).toBeGreaterThanOrEqual(1);
        expect(r.rounds).toBeLessThanOrEqual(combatBalance.maxRounds);
        expect(r.armyHpLeft).toBeLessThanOrEqual(r.armyHp);
        expect(r.armyHpLeft).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('counter effects (Story 4.2)', () => {
  it('first strike: the army strikes before any enemy, swift ones included', () => {
    const slow = army({ speed: 0 });
    expect(armyStrikesFirst(slow, withTrait('swift'))).toBe(false);
    expect(armyStrikesFirst({ ...slow, firstStrike: true }, withTrait('swift'))).toBe(true);
    expect(armyStrikesFirst({ ...slow, firstStrike: true }, plain({ speed: 1_000 }))).toBe(true);
  });

  it('web strikers: more soldiers strike through a web, and nothing changes elsewhere', () => {
    const most = enemyBalance.traits.web.strikersMax;
    const big = army({ soldiers: most * 3 });
    expect(strikers({ ...big, webStrikers: 2 }, withTrait('web'))).toBeGreaterThan(strikers(big, withTrait('web')));
    expect(strikers({ ...big, webStrikers: 2 }, withTrait('web'))).toBeLessThanOrEqual(big.soldiers);
    expect(strikers({ ...big, webStrikers: 2 }, plain())).toBe(strikers(big, plain()));
  });

  it('healing: the army ends with at least the hit points it had without it, never more than it started with', () => {
    for (const type of ['red_ant', 'termite', 'spider', 'beetle', 'wasp', 'scorpion']) {
      for (const soldiers of [3, 10, 40]) {
        const a = army({ soldiers });
        const plainFight = fightRounds(a, getEnemyDef(type), fixedRng(0.5));
        const healed = fightRounds({ ...a, healPerRound: 3 }, getEnemyDef(type), fixedRng(0.5));
        expect(healed.armyHpLeft).toBeGreaterThanOrEqual(plainFight.armyHpLeft);
        expect(healed.armyHpLeft).toBeLessThanOrEqual(healed.armyHp);
        if (plainFight.outcome === 'victory') expect(healed.outcome).toBe('victory');
      }
    }
  });
});
