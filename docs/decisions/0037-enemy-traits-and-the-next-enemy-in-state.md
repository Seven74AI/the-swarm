# 0037. Enemy traits, and the next enemy in state

- **Status:** accepted (2026-11-21)
- **Source:** Story 4.1 (#292) · FR12 (combat interest bar) · UX-DR26 (enemy card) · ADR 0005 (seeded randomness), 0017 (WAR segment)

## Context

The enemy card (Story 1.25) showed an enemy peeked from the seeded generator, per session: any draw elsewhere (a
decision, a tick) moved the generator, so a reload could show a different enemy, and enemies differed only in raw
stats. FR12 asks for at least three enemy types in Combat, each with a type and trait shown before the fight, that
reward different soldier, equipment or mutation choices.

## Decision

- **Content and balance apart.** `src/data/content/enemies.ts` lists the enemy types (`ENEMY_TYPES`), each with a
  name and one trait, and each trait (`TRAITS`) with its card label, the line the card shows and the stats it
  affects (`TraitStat`). Every trait's numbers are in `data/balance/enemies.ts` (`enemyBalance.traits`), beside the
  enemy stats. A new enemy is an entry in both. The scaling exponent with battles won moved to
  `data/balance/combat.ts` (`enemyScalingExponent`, below 1: strength still grows sub-linearly).
- **Traits are optional modifiers of one fight,** not per-trait code: `hitCap` (swarm: strength past it lands no
  harder, so numbers win), `shell` + `glanceShare` (thick shell: weak bites lose most of their strength but still land,
  so a beetle is never unbeatable before weapons), `poisonShare` (thick shell, venom resistance), `strikersMax` (web:
  only a few soldiers strike), `strikesPerRound` + `strikesFirst` (swift), `regrowthPerRound` (regrowth: heals each
  round unless venom hit it). `src/systems/CombatRounds.ts` holds the round loop (`fightRounds`) and the army's stats
  (`armyOf`); `BattleSystem` resolves a battle through it.
- **The matchup hint plays the same rounds** once with every roll fixed (`enemyBalance.matchup.roll`):
  not a win is dangerous, a win with at least `favouredHpShare` of the army's hit points left is favoured, else even.
  So the hint knows the trait. `assessMatchup(state, enemy, soldiers?)` lives in `CombatRounds`; the card reads
  `selectMatchup`, the sim's policy calls it with candidate army sizes.
- **The next enemy is in state** (`GameState.nextEnemy`, save v27). A new game's first enemy is the starting
  generator's peek; each battle draws the next one from its own stream after its rolls, folded into the battle's one
  write. `actions.fight(enemyType?)` fights `state.nextEnemy` and refuses (`unavailable`) a named enemy that is no
  longer next. The v26 → v27 migration stores the enemy the card would have shown (the generator's peek), without
  advancing the generator; `SaveManager` replaces an unknown type the same way. Prestige keeps it, as it keeps
  battles won. *(Superseded by ADR 0040: prestige resets battles won and re-peeks the next enemy for a fresh run.)*
- **The interest bar is a test:** `tests/sim/combatMatchups.test.ts` fights four builds (twice the plain soldiers;
  or weapons, armor or a Venom Lab three levels deep) at several army sizes against every type the generator draws
  before the boss, over fixed seeds and battle counts, and asserts that every build is beaten by another against
  some type. It asserts the relation, never a rate.

## Consequences

- The card shows `ARMORED BEETLE · THICK SHELL` and the trait's line, and the same enemy after a reload.
- Story 4.2 marks each upgrade strong against at least one trait, using `TRAITS[...].affects`; Potent Venom's
  `poisonDamage` is still not applied in `VenomSystem` (left to 4.2's counters).
- Story 4.3's `BattleCause` can read the trait from `EnemyDef.trait`.
- `peekEnemy` remains only for the migration and the first enemy; nothing on the card peeks the generator any more.
