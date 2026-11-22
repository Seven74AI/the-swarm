# 0040. Prestige wipes the run: a fresh state plus a short keep list

- **Status:** accepted (2026-11-22)
- **Source:** Story 5.3 (#305) · FR30 · GDD "Prestige" (every run revisits every phase)

## Context

`prestige()` built the new run field by field on top of the old state (`...state`). Anything it didn't name
survived: void crystals, antimatter, dark matter and survey data (on purpose, so a run could skip Space's
decisions), but also mutations, research, the entropy dampener, battles won, conversions, the open decision event
and any field added later. Story 5.3 wants every run to start clean, with only the Legacy layer and the lifetime
record kept.

## Decision

- **The new run is `createInitialState()` plus `PRESTIGE_KEEPS`** (`src/systems/PrestigeSystem.ts`): `seed` and
  `rng` (the generator keeps running, ADR 0005), `prestige` (LP and lifetime LP raised by the award, the count, the
  lifetime totals), `prestigeTree` (bought Legacy upgrades), `stats` and `lifetime` (lifetime statistics),
  `victoryAchieved` (the victory record), `automation` (learned verbs, ADR 0039), and `nextIds` and
  `lastSaveTimestamp` (bookkeeping, not part of a run). `soldiers.totalKilled` is a lifetime tally and is kept too.
- **Legacy grants on top:** the royal cache's eggs (in `eggPipeline.count`) and food, and Phase Skip's start in
  Colony. Nothing else differs from a fresh state.
- **The next enemy** is `peekEnemy(rng, 0)`: the kept generator's first draw for a run with no battles won (battles
  won reset). This supersedes ADR 0037's "prestige keeps it, as it keeps battles won".
- **A new field is wiped by default.** `tests/unit/prestigeWipe.test.ts` checks, over random pre-prestige states,
  that every field outside the keep list and the grants equals its initial value, and that the keep list is exactly
  the story's. Keeping a new field across prestige means adding it to `PRESTIGE_KEEPS` and to that test.

## Consequences

- Space resources no longer carry over. Saves from before this rule that carried them into an earlier phase are
  migrated by Story 5.4.
- Mutations, the entropy dampener, conversions and Particle Lab levels are run purchases and reset.
- The new run opens the chronicle with `A QUEEN, AGAIN.` and plays no phase reveal; settings are outside the save.
