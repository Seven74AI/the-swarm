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
