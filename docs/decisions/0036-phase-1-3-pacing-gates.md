# 0036. Phases 1–3 are paced by the brood pipeline and the nest's room

- **Status:** accepted (2026-11-21)
- **Source:** GDD *Difficulty Curve* · Story 3.11 (#291) · FR40 · ADR 0034 (headless sim)

## Context

The Story 3.9 pacing report showed Phases 1–3 done within the first 4 minutes of play: 4 taps a second filled
a 50 s hatch-and-mature pipeline, each digger added a room every second, and role yields bought any building
after one offline gap. The GDD wants Phase 1 in 3–5 min of play, Colony within day 1 (20–40 min of play) and
Combat over days 2–3, for a player checking in about 6 times a day.

## Decision

- **Phase 1 is gated by the brood pipeline.** An egg hatches in about 15 min and a larva matures in about
  15 min (`resourceBalance.hatchMs`, `matureMs`): minutes of tapping reach the first 10 workers, and eggs laid
  in a check-in become workers while the player is away.
- **Phases 2 and 3 are gated by the nest's room.** Eggs are plentiful, so workers fill whatever room there is.
  Digging is a slow trickle (`roleBalance.digMsPerRoom`; Story 9.2 replaced it with DIG rooms, `data/balance/dig.ts`), and the Warehouse is the big step
  (`buildingBalance.warehouseNestCapacityPerLevel`): Colony's 50 workers need the first Warehouse plus some
  digging, Combat's 60 need more digging or a second level. Food upkeep against diggers gives the
  food-critical moments; a full nest gives the capacity-critical ones.
- **Basic-resource yields and building prices are set per offline gap**, not per second: a gap of a few hours
  buys the next building (`roleBalance` yields, `buildingBalance.baseCosts`).
- **The sim player taps while its goal lacks workers** (always in Egg Laying; afterwards only while the waiting
  brood does not cover the shortfall), because LAY EGG is the only egg source until automation (Story 4.10).
- **The report counts critical moments:** per check-in `foodCritical` / `capacityCritical` probes, and a report
  line against `pacingTargets.criticalMoments`.

## Consequences

- The before and after reports are in `_bmad-output/implementation-artifacts/3-11-tune-phases-1-3.md`. Tests
  read every tuned number from `data/balance/`; the reachability test (Story 3.8) still bounds each phase.
- Colony's window is narrow (only check-in 6 of day 1 satisfies both the play and the day target); a change to
  the check-in model needs a new pass.
- Pillar 3's "under 10% of eggs from tapping after Colony" cannot be measured until automation lays eggs in
  Colony (Story 4.10). Phases 4–5 are not tuned (Epic 6).

## Retuned for the first week (Story 9.9)

The DIG core (Epic 9) replaced digging-as-a-trickle with rooms dug a press at a time. Story 9.9 retuned Phases 1–2
against the first-week gates: the brood takes 10 min to hatch and 10 to mature, rooms are cheap at first and grow
slowly (`digBalance`), the Colony goal asks for 200 workers (GDD range 150–300), and every later worker goal stays
above the one before it (`tests/unit/phases/workerTargetsOrder.test.ts`). Gate 1 passes and Colony ends after
session 1. The before and after reports are in `_bmad-output/implementation-artifacts/9-9-tune-the-dig-core.md`.
Phase 3's length (gate 2) and post-week check-ins (gate 3) are batch 2's.
