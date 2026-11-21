# 0005. Seeded PRNG stored in game state

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md) D6

## Context

About 30 `Math.random` calls (combat, decision events, expeditions, exploration, map generation) make the pacing
simulation and bug reports non-reproducible.

## Decision

- A small seeded PRNG (`src/utils/rng.ts`) with its state in `GameState`. Systems take it as input and return the
  advanced state.
- No `Math.random` in `src/systems/` or `src/sim/`; UI-only effects may still use it.

## Consequences

- A seed reproduces a run or a reported bug.
- Tests still assert invariants and outcome sets, never one specific outcome.
- Adds the PRNG state to the save (one migration step).

## Implementation (Story 3.1)

- `src/utils/rng.ts`: mulberry32 (the generator MapSystem already used, so a given map seed lays out the same map).
  The state is one u32, `GameState.rng` (save v24, started from `rngFromSeed(state.seed)`); `RngStream` draws from it,
  with `between`, `intBetween`, `pick` and `chance` helpers.
- The tick context carries `rng`, a stream opened on the state's `rng` at the tick's start; systems in the tick draw
  from it and the step folds its state into the tick's one write. Actions (battles) open a stream on `state.rng` and
  write the advanced state back.
- Outcomes that run over game time (expedition and exploration rolls, probe launches) use `keyedStream(seed, run,
  kind, id or tick)` instead of the shared stream. That keeps the Story 2.5 step-length invariance exact: the same
  game time gives the same draws whatever the step length or the order things resolve in (per game time, never per call).
- Systems take an optional `RngStream` (`resolveBattle`, `resolveExpedition`, `resolveExploration`, `generateMap`),
  which tests use to pin a roll.
