# Story 3.11: Tune Phases 1–3 to the target curve

- **Issue:** #291 · **Spec:** [epics.md, Story 3.11](../planning-artifacts/epics.md#story-311-tune-phases-13-to-the-target-curve)
- **Covers:** FR40 (tuning) · FR4, FR5, FR6 (tuned) · ADR 0036

This file records the `pnpm sim` pacing report (Story 3.9) before and after the tuning, as the story asks.
Both are seed 1, 7 days, 6 check-ins a day of 5 min each (the defaults in `src/data/balance/pacing.ts` and
`src/data/balance/sim.ts`). Tests never assert these numbers.

## Before (main at 9d7da47)

```
THE SWARM pacing report: seed 1, 7 day(s), 42 check-ins (6 a day, 5m 0s each)
Played 3h 30m over 6d 16h 5m of real time.

Phase         Active  Target               Real time  Ended              Target
1 Egg Laying  40s     3m 0s–5m 0s    FAST  40s        day 1, check-in 1  First session  ok
2 Colony      25s     20m 0s–40m 0s  FAST  25s        day 1, check-in 1  Day 1          ok
3 Combat      4m 0s   TBD                  3h 11m     day 1, check-in 2  Days 2–3       FAST

Eggs from tapping, first 2m 0s of play: 100% (target ≥ 80%)
Eggs from tapping, from Colony on: n/a (no eggs laid) (target < 10%)
Actions per check-in (taps excluded): median 0.5
Later phases (no GDD target in the MVP):
  - expansion: entered day 1 after 5m 5s of play; lasted 5s played, 5s real
  - space: entered day 1 after 5m 10s of play; run ended in it
Check-ins with nothing affordable within 4h 0m (pacing defects): 12
  - check-in 18 (day 3, space): next in 4h 54m
  - check-in 23 (day 4, space): next in 6h 1m
  - check-in 26 (day 5, space): next in 5h 6m
  - check-in 29 (day 5, space): next in 11h 0m
  - check-in 30 (day 5, space): next in 7h 48m
  - check-in 32 (day 6, space): next in 14h 25m
  - check-in 33 (day 6, space): next in 11h 13m
  - check-in 34 (day 6, space): next in 8h 1m
  - check-in 35 (day 6, space): next in 4h 49m
  - check-in 38 (day 7, space): next in 10h 55m
  - check-in 39 (day 7, space): next in 7h 43m
  - check-in 40 (day 7, space): next in 4h 31m
```

## After

```
THE SWARM pacing report: seed 1, 7 day(s), 42 check-ins (6 a day, 5m 0s each)
Played 3h 30m over 6d 16h 5m of real time.

Phase         Active   Target             Real time   Ended               Target
1 Egg Laying  3m 45s   3m 0s–5m 0s    ok  3m 45s      day 1, check-in 1   First session  ok
2 Colony      21m 25s  20m 0s–40m 0s  ok  15h 56m     day 1, check-in 6   Day 1          ok
3 Combat      47m 35s  TBD                1d 14h 26m  day 3, check-in 15  Days 2–3       ok

Eggs from tapping, first 2m 0s of play: 100% (target ≥ 80%)
Eggs from tapping, from Colony on: n/a (no eggs laid) (target < 10%)
Actions per check-in (taps excluded): median 29
Phase 2 Colony check-ins food-critical: 2, capacity-critical: 5 (target ≥ 1 each)
Later phases (no GDD target in the MVP):
  - expansion: entered day 3 after 1h 12m of play; lasted 5s played, 5s real
  - space: entered day 3 after 1h 12m of play; run ended in it
Check-ins with nothing affordable within 4h 0m (pacing defects): 0
```

The result holds across seeds: seeds 1, 2, 3, 5, 7, 11 and 288 all end Phase 1 in check-in 1 (3m 45s),
Phase 2 at check-in 6 of day 1 (21m 25s active) and Phase 3 on day 3, between check-in 13 and 18 (seed 7
ends it in check-in 18, the last of the window), with no idle check-in.

## What changed

| Value (`src/data/balance/`) | Before | After | Why |
|---|---|---|---|
| `resources.hatchMs`, `resources.matureMs` | 50 000 | 900 000 | Phase 1 took 40 s: 4 taps/s filled the pipeline and 10 workers came out within a minute. ~15 min per stage gives 3m 45s of tapping, and eggs laid in a check-in become workers while the player is away. |
| `roles.digMsPerRoom` | 1 000 | 96 000 000 | Each digger added a room every second (13 diggers took the nest from 25 to 3 275 in one check-in), so capacity never bit and workers exploded. Digging is now a slow trickle; the nest grows mostly through the Warehouse. |
| `roles.gatherWoodPerSec`, `forageNectarPerSec`, `digStonePerSec` | 0.25, 0.3, 0.2 | 0.01 each | A 3 h offline gap paid for every building many times over. |
| `buildings.baseCosts` (barracks, walls, warehouse, combat buildings) | | ×10 on food/wood/stone/nectar | Scaled with the slower yields; combat-drop costs (silk, chitin, venom) unchanged. |
| `buildings.warehouseNestCapacityPerLevel` | 25 | 20 | Colony's goal (50 workers) needs the first Warehouse plus some digging; Combat's (60) needs more digging or a second level, which takes days 2–3. |

Guard targets in `transitions.ts` are unchanged.

## Sim player (policy) decision

Story 3.9 found no eggs laid after Phase 1, because the default policy tapped only in Egg Laying. Nothing
automates laying before Story 4.10 (the automation panel opens in Transcendence today), so LAY EGG, which stays
on NEST in every phase, is the only egg source. The policy now taps while the phase goal still lacks workers:
always in Egg Laying (tapping is the phase), and later only while the eggs and larvae waiting do not already
cover the workers the goal lacks (a real player stops tapping a full nursery). With the new pipeline the
Phase 1 brood covers Colony and Combat, so the sim lays no eggs after Phase 1; tapping only speeds Phase 1.

## Probes added

Each check-in record has `foodCritical` and `capacityCritical` (`isFoodCritical` / `isCapacityCritical` held on
arrival or after any move or step of play in the phase the check-in started in). The report prints, for
`pacingTargets.criticalMoments.phase` (Colony), the check-ins where each held, against a minimum of 1.

## Remaining gaps

- **Tap share from Colony on (Pillar 3, < 10%):** n/a, no egg is laid after Phase 1 in the sim. The share can
  only be measured once something besides tapping lays eggs in Colony: automation opens there in Story 4.10
  (FR15, FR16).
- **Phase 3 active play** has no GDD target yet ([ASSUMPTION: TBD from E3 telemetry]); it comes out at about
  40–60 min.
- **Phases 4–5 are untuned** (Epic 6): Expansion lasts seconds (its guard, 80 workers and 5 000 food, is met on
  entry) and the run then sits in Space. The 7-day report shows no idle check-in, but that is not a target.
- **Colony's real-time window is narrow:** the 20–40 min active target and "day 1" together leave only
  check-in 6 of day 1 (check-in 5 gives under 20 min of Colony play). The goal latches in the gap before
  check-in 6 for every seed tried; a player with fewer or shorter check-ins lands outside it.
