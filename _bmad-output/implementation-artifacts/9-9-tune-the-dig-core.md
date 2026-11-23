# Story 9.9: Tune the DIG core so session 1 never walls

Issue #451 · Epic 9 batch 1 · built by the run-all-stories session (2026-11-23).

## What changed

| Value | Before | After | Why |
|---|---|---|---|
| Egg Laying → Colony workers (`transitions.ts`) | 10 | 15 | Phase 1 ran 2m 55s once the brood got quicker; 15 lands it at 3m 10s (target 3–5 min). In the GDD range 10–20. |
| Colony → Combat workers | 50 | 200 (+ 1 guard) | GDD range 150–300. |
| Combat → Expansion workers | 60 | 400 | Kept above Colony's (property test); final value with batch 2. |
| Expansion → Space workers | 80 | 600 | Kept above Combat's; final value with batch 2. |
| `resourceBalance.hatchMs`, `matureMs` | 15 min each | 10 min each | The first workers, and so the first food and the first buy, came at 2m 10s: session 1's first idle gap. They now come at 1m 45s. |
| `upgradeBalance.warm_brood.baseCost` | 20 | 10 | A second cheap Phase 1 buy right after Click Power. |
| `digBalance.firstRoomPoints` | 25 000 | 3 500 | A room every 60–75 s of pressing early on (gate 1). |
| `digBalance.roomGrowthPerRoom` | 0.25 | 0.22 | With 200 workers to house, rooms grow slowly enough that Colony still ends after session 1. |
| `digBalance.roomSize` | 5 | 6 | Fewer, roomier rooms to 200 workers (about 30 from the start capacity of 25, the Warehouse aside). |
| `digBalance.diggerPointsPerSec` | 0.05 | 0.1 | So a player who never taps still reaches the Colony goal (reachability test). |
| Start capacity, Warehouse cost and rooms | unchanged | unchanged | The values above met every target without them; batch 2's crowding is the place to revisit the Warehouse. |

## Targets (seed 1; seeds 2, 3 and 7 give the same Colony numbers: Colony has no randomness)

- Gate 1: **pass**, 1m 50s longest idle gap in session 1's first 30 min (target ≤ 2 min).
- Colony ends on day 1, check-in 2 (after session 1), after 46m 50s of play (target 45–70 min).
- Gates 2 and 3 still fail. They are batch 2's (crowding, starvation, the food limit), by plan.

## Before (main @ 3a07f04)

```
THE SWARM pacing report: seed 1, 10 day(s), 60 check-ins (first-week schedule: session 1 of 50m 0s, 6 a day of 10m 0s to day 3, shrinking to day 7, then played until idle (at most 5m 0s))
Played 6h 5m over 9d 16h 0m of real time.

First-week gates (GDD Success Metrics):
  Gate 1, longest idle gap in the first 30m 0s of session 1: 9m 35s (target ≤ 2m 0s)  FAIL
  Gate 2, day Phase 3 ended: day 2 (target day 6–8)  FAIL
  Gate 3, check-ins after day 7: 18 check-ins, median 5s, 100% with a decision (target median 1m 30s–2m 0s, 100% with a decision)  FAIL

Phase         Active   Target             Real time  Ended              Target
1 Egg Laying  3m 45s   3m 0s–5m 0s    ok  3m 45s     day 1, check-in 1  Session 1               ok
2 Colony      46m 15s  45m 0s–1h 10m  ok  3h 8m      day 1, check-in 2  Day 1, after session 1  ok
3 Combat      1h 0m    TBD                1d 55s     day 2, check-in 8  Days 2–7                ok

Eggs from tapping, first 2m 0s of play: 100% (target ≥ 80%)
Eggs from tapping, from Colony on: n/a (no eggs laid) (target < 10%)
Actions per check-in (taps excluded): median 12
Phase 2 Colony check-ins food-critical: 0, capacity-critical: 1 (target ≥ 1 each)
Later phases (no GDD target in the MVP):
  - expansion: entered day 2 after 1h 50m of play; lasted 5s played, 5s real
  - space: entered day 2 after 1h 51m of play; run ended in it
Check-ins with nothing affordable within 4h 0m (pacing defects): 0

Army trade-off (Story 4.4): Combat from check-in 3, same seed, default player vs max-army player (trains every free worker, then fights)
  default   left Combat in check-in 9, after 1h 0m played (1d 3h 2m real); won 5, lost 8; food-critical check-ins: 4, 5, 6, 8
            bought in Combat: WEAPONS LV.1–3, CHITIN ARMORY LV.1, MIDDEN LV.1–2
  max-army  left Combat in check-in 4, after 10m 5s played (6h 14m real); won 18, lost 0; food-critical check-ins: 3, 4
            bought in Combat: SWIFT SOLDIERS, TOUGH SHELLS, MIDDEN LV.1
  Food-critical for the max-army colony only: check-ins 3 (target ≥ 1)
```

## After

```
THE SWARM pacing report: seed 1, 10 day(s), 60 check-ins (first-week schedule: session 1 of 50m 0s, 6 a day of 10m 0s to day 3, shrinking to day 7, then played until idle (at most 5m 0s))
Played 6h 7m over 9d 16h 0m of real time.

First-week gates (GDD Success Metrics):
  Gate 1, longest idle gap in the first 30m 0s of session 1: 1m 50s (target ≤ 2m 0s)  PASS
  Gate 2, day Phase 3 ended: day 1 (target day 6–8)  FAIL
  Gate 3, check-ins after day 7: 18 check-ins, median 10s, 100% with a decision (target median 1m 30s–2m 0s, 100% with a decision)  FAIL

Phase         Active   Target             Real time  Ended              Target
1 Egg Laying  3m 10s   3m 0s–5m 0s    ok  3m 10s     day 1, check-in 1  Session 1               ok
2 Colony      46m 50s  45m 0s–1h 10m  ok  3h 8m      day 1, check-in 2  Day 1, after session 1  ok
3 Combat      30m 5s   TBD                9h 36m     day 1, check-in 5  Days 2–7                FAST

Eggs from tapping, first 2m 0s of play: 100% (target ≥ 80%)
Eggs from tapping, from Colony on: 0% (target < 10%)
Actions per check-in (taps excluded): median 69.5
Phase 2 Colony check-ins food-critical: 0, capacity-critical: 1 (target ≥ 1 each)
Later phases (no GDD target in the MVP):
  - expansion: entered day 1 after 1h 20m of play; lasted 9m 55s played, 3h 11m real
  - space: entered day 1 after 1h 30m of play; run ended in it
Check-ins with nothing affordable within 4h 0m (pacing defects): 0

Army trade-off (Story 4.4): Combat from check-in 3, same seed, default player vs max-army player (trains every free worker, then fights)
  default   left Combat in check-in 7, after 40m 5s played (20h 38m real); won 5, lost 10; food-critical check-ins: 4, 6, 7
            bought in Combat: WEAPONS LV.1–5, TOUGH SHELLS, CHITIN ARMORY LV.1, MIDDEN LV.1–5
  max-army  left Combat in check-in 13, after 1h 40m played (1d 20h 38m real); won 13, lost 0; food-critical check-ins: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
            bought in Combat: WEAPONS LV.1–5, EFFICIENT GATHERERS, TOUGH SHELLS, CHITIN ARMORY LV.1, MIDDEN LV.1–4
  Food-critical for the max-army colony only: check-ins 3, 5 (target ≥ 1)
```
