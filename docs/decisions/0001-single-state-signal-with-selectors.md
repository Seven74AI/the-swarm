# 0001. One game-state signal, read through `computed` selectors

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md) D5; issue #186

## Context

`gameState` is one `signal<GameState>`. Signals track the signal, not object paths, so an `effect` that reads
`gameState.value.x` re-runs on every write (20 times a second). The repo also contains `StateManager` and `Store`
(unused outside their own tests) and `GameStatePool`, whose `spread()` is called every tick but never recycles.
Agents copy whichever primitive they find first.

## Decision

- Keep one `signal<GameState>` and one spread-based write per tick. Player actions write between ticks.
- `src/state/selectors.ts` exports `computed` slices. UI components and effects read only selectors, never
  `gameState.value`. UI changes state only through `src/actions/`.
- Delete `StateManager`, `Store` and `GameStatePool`.

## Consequences

- Components re-render only when their slice's reference changes; hand-written dirty checks go away.
- Object recycling is ruled out: it would break the reference equality that selectors rely on.
- Enforced by `tests/arch/architecture.test.ts` (no `gameState.value` under `src/ui/`).
