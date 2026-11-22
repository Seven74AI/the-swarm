# 0028. Systems are correct for any step length

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  Offline Catch-up (D2) · Units and Integers · Story 2.5 (#271) · AR4, AR20, FR2

## Context

Catch-up will advance in macro-steps (Story 2.6: 10 s) through the same `processTick` the game uses, so every
system must give the same result for one step of `n × 50 ms` as for `n` steps of 50 ms. Several did not:
nest digging counted calls, not time; spaceship missions counted down one per call; probe launches rolled
once per call; conversions floored `rate × dt` each step, so a rate under 20 a second never ran at 20 Hz;
pipelines used `k·dt`, which overshoots on long steps; automation eggs never entered the egg pipeline;
food, wood, stone and nectar were stored as fractions. main's live tick was also a second copy of
`processTick`, so a fix in one did not reach the other.

## Decision

- **One step function.** main's `step` calls `processTick` and adds only the foreground parts (pause, the
  session clock, decision events, the latch). The return events (`expedition_return`, `exploration_return`,
  `spaceship_return`) moved into `processTick`.
- **Pipelines use the exact share.** A step moves `count × (1 − e^(−k·dt))` of a pipeline, and larvae also
  gain the share of eggs that hatch and mature in the same step (`completedShare`, `chainedShare` in
  `src/utils/decay.ts`). Fractions still carry in `progress`.
- **Whole numbers, carried fractions.** `creditWhole(amount, remainder, delta)` (`src/utils/math.ts`) credits
  the whole part of a rate and carries the rest: `resourceRemainder` (food, wood, stone, nectar) and
  `conversions.remainder` (one per conversion). Save v21 splits an older save's fractional stock into the two.
- **Time, not calls.** Digging and mission countdowns advance by `dtMs / TICK_MS` ticks; the probe swarm draws
  the ticks to its next launch from the geometric distribution of its per-tick chance.
- **All eggs are pipeline eggs.** Automation and the prestige auto egg layer share `autoProduction.progress`
  and add every egg to `eggPipeline.count`.

## Consequences

- `tests/unit/engine/stepLength.test.ts` is the contract: seeded property tests compare the two runs, exact on
  the integer invariants, within a stated tolerance where a rate is set by state that changes inside the window.
  A new per-step system must join it.
- Balance stays in ticks until Story 3.2; `TICK_MS` converts. Story 3.3 still owns integer costs and the
  catch-up integer property; the rate-credited resources are already whole here.
- Conversions run at their stated rate at 20 Hz (they were stuck at 0 below 20 runs a second).
