# 0052: Starvation runs on a clock in state, and picks the dead from a keyed stream

Status: accepted (Story 9.16, 2026-11-24)

## Context

Story 9.16 makes hunger kill: after a grace at zero food, one eater an interval, until production covers use. It must give the same deaths for any step length (Story 2.5), work in catch-up's macro-steps, and never wipe the run.

## Decision

- `state.starvation` holds the clock (`ms` starving in the current stretch, `stretchDeaths` in it) and the run's counts (`starvedWorkers`, `starvedSoldiers`). Deaths come due from the clock alone (`grace`, then one per `interval`), so one long step and many short ones owe the same deaths.
- Each due death happens only while the colony still starves (food at zero, net rate below zero), so it shrinks the colony to fit and stops. The clock resets once it no longer starves.
- The victim (a worker or a soldier, by their counts) comes from `keyedStream(hash('starvation'), seed, prestige count, death number)`: the order is fixed by the death's number, not by call order, so any step length kills the same kinds. A worker leaves the free pool first, then the role with the most on it.
- `systems/Starvation.ts` runs inside `processTick`, after production, training and automation. Catch-up passes two options: starvation waits until the closed-form food would have run out, and the run's deaths may not pass 20% of the eaters before the absence (`OFFLINE_WORKER_FLOOR_SHARE`, 0.8).
- Pantry rooms stretch the grace and the interval, up to `starvationBalance.pantryMaxFactor`; they never stop starvation.

## Consequences

- The deaths' kinds may differ between step lengths only when the counts that weight the pick differ; the number of deaths stays within one.
- `getSettlesAt` reuses the same death order, so the sheet's "settles at" line (Story 9.17) agrees with what starvation would do.
