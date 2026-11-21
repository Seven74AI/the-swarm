# 0017. FRONT → WAR: the enemy card, the battle replay and the summary sheet

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.25 (#255) · UX-DR10, UX-DR26 · EXPERIENCE.md "Tabs" (FRONT), "Enemy card", empty and running states · review-code-feasibility.md #29 · ADRs 0006, 0011 (sheets), 0016

## Context

WAR replaces SoldierPanel, BattlePanel, CombatLogPanel and MutationPanel. The legacy flow was SCOUT → ENGAGE, and
the scouted enemy was not the one fought: `fight(enemyType)` only used the type for the `battle_engage` line, while
`resolveBattle` drew its own random enemy. UX-DR26 wants the enemy shown before committing, `> FIGHT` as the
primary action and a round counter "while a battle runs", but battles resolve synchronously in one loop.

## Decision

- **The enemy fought is the enemy shown.** `BattleSystem.resolveBattle(state, enemyType?)` fights the given type;
  `actions.fight(enemyType)` refuses an unknown type with `unknown_id`. `BattleResult` gains `outcome`
  (`victory | defeat | draw`, the value written to `lastBattle.result`) and `rounds` (1 to `MAX_BATTLE_ROUNDS`).
- **The enemy card's enemy is session UI state** (`src/ui/war/warSession.ts`, `createWarSession`): drawn at start
  and after each battle, scaled by battles won, never saved (no migration). Story 4.1 moves the draw to the seeded
  generator and adds the trait.
- **The round counter is a presentational replay.** The battle is written at once; the session then counts
  `ROUND 1 … n` on the enemy card (between `MIN_REPLAY_MS` and `MAX_REPLAY_MS` in total), refuses a second FIGHT with
  `already_running`, keeps the battle in a 5-entry session log and opens the **battle summary sheet**
  (`src/ui/sheets/BattleSummarySheet.tsx`) at `battle` priority. Story 4.3 adds the cause line and `> CHANGE`.
- **Layout and mounting.** The tab registry orders WAR soldier_panel (training and equipment), mutation_panel,
  battle_panel (enemy card), combat_log, and adds `war_primary` (FRONT's primary zone). UIRoot keeps the hosts and
  their ids (`#soldier-panel`, `#mutation-panel`, `#battle-panel`, `#combat-log-panel`); main renders the
  components of `src/ui/war/WarSegment.tsx` into them. `WarPrimary` reads the tab shell's segment and renders only
  in WAR (MAP and STARS get their own primary actions in Epic 6).
- **Training takes a free worker** (as `assignResearcher`, ADR 0016): `trainSoldier` refuses `no_free_workers`
  when every worker has a job, matching what the legacy panel disabled.

## Consequences

- No scout step any more: `#scout-enemy` and `enemy_scouted` are no longer used by the UI. `#engage-battle` is
  FIGHT; `#battle-result` is the summary sheet; `#enemy-name` and `#mutation-card-<id>` are kept.
- Soldier counts change the moment FIGHT is pressed, before the replay ends; the summary arrives within ~1.2 s.
