# 0038. Counters, and the counter for a battle cause

- **Status:** accepted (2026-11-21)
- **Source:** Story 4.2 (#293) · FR9, FR10, FR12 (counterplay) · ADR 0037 (enemy traits)

## Context

Story 4.1 gave every enemy a trait, but equipment and mutations were plain stat bumps, two mutations (Efficient
Gatherers, Accelerated Hatching) did nothing in battle, Swift Soldiers' +1 speed changed no matchup, and Potent
Venom's `poisonDamage` was never applied. The battle summary (Story 4.3) needs to point at "the card that answers
this", so the relation between upgrades and traits has to be data the game can read.

## Decision

- **Marks are balance data.** `data/balance/combat.ts` holds `equipment.weapon` / `equipment.armor` (one entry per
  level, what it adds) and `mutations.<id>` (what the mutation does in battle). Each entry carries
  `strongAgainst` and `weakAgainst` (`CounterMarks`, trait ids). Costs and colony effects stay in `mutations.ts` /
  `soldiers.ts`; `soldiers.ts` keeps the base stats and `maxEquipmentLevel`.
- **Marks are checked against the fight, not trusted.** `tests/sim/counters.test.ts` measures, for every upgrade
  and every trait (the enemy type carrying it, over the battles won before the boss), how much smaller the army a
  win needs gets with the upgrade (bisection on a real-valued army, every roll fixed). Every strong mark must show a
  gain, larger than every weak mark's. Relations only: retuning keeps the test as long as the marks stay true.
- **Three fight effects, so every mutation counters something:** `webStrikers` (Efficient Gatherers: more soldiers
  strike past a web's limit), `healPerRound` (Accelerated Hatching: the army recovers hit points each round, never
  past its start), `firstStrike` (Swift Soldiers: the army strikes before any enemy, a swift one included). They
  join `Army` in `CombatRounds`. Potent Venom's share now raises `getPoisonDamagePerTick`.
- **`counterFor(cause, state)`** (`src/systems/Counters.ts`, re-exported by `state/queries`) returns the cheapest
  open WAR card (equipment below its last level with its workshop built, or an unowned mutation whose prerequisite
  is owned) marked strong against `cause.trait`, with its price and whether it is affordable now; an
  `equipment_gap` is answered by equipment only; null when no card is open. Equipment cards are judged by the
  marks of their next level. `BattleCause = { kind, trait }` with kinds `trait_beat_mutation`,
  `trait_beat_equipment`, `outnumbered`, `equipment_gap`; Story 4.3 decides which kind a battle gets and may add
  kinds.

## Consequences

- WAR's equipment and mutation cards end their effect line with `BEST AGAINST <TRAIT>`.
- No save change: marks are data, fight effects are derived from owned mutations and equipment levels.
- A new upgrade needs marks, or `tests/sim/counters.test.ts` fails.
