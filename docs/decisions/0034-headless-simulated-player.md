# 0034. A headless simulated player plays the real game

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  D12, N2 · Story 3.7 (#287) · AR15

## Context

Pacing and soft-locks (Stories 3.8 and 3.9) need the game played for days of game time without a browser. A
harness that takes shortcuts (writes resources, ticks systems directly, mocks combat) measures a different game
from the one players get.

## Decision

- **`src/sim/`** holds the simulated player: `SimRunner` (`runner.ts`, also `runSim(options)`),
  `CheckInSchedule` (`schedule.ts`: `dailySchedule`, `repeatCheckIns`, `scheduleMs`), `PlayerPolicy` and
  `defaultPolicy` (`policy.ts`) and `Probes` (`probes.ts`). Its player model (check-ins a day, play length,
  look interval, tap rate, move cap) is `simBalance` in `src/data/balance/sim.ts`.
- **A run starts from a seed and a state.** The seed replaces the state's `seed` and restarts `rng`
  (`rngFromSeed`), so a run is deterministic.
- **Time moves only through `resume(elapsedMs)`.** A check-in's gap is one call (the offline path and its cap
  and efficiency from 60 s on); the check-in itself is played as `activeStepMs` calls, the gaps between the
  player's looks. The runner never ticks, never calls the catch-up and never runs the live decision clock, so
  decision events never fire.
- **Moves go only through `actions/`.** The runner binds `createActions` to real systems on its own `EventBus`
  and its own `StateStore`, as main does (`phases` = a default `PhaseStateMachine`). A move is data (`SimMove`:
  an `ActionIntent` for `actions.perform`, `layEgg` taps, `stepRole`, `moveWorkers`, `trainSoldier`, `fight`);
  the action validates it, and a refusal is counted, not worked around.
- **A policy is a pure function** `(state, turn) → SimMove[]`. `turn.taps` is the LAY EGG taps the player has
  had time for since the last look (only on the first ask of a look), which keeps tapping a property of the
  player model rather than of the policy. The runner applies the moves in order, then asks again while moves
  keep landing, at most `maxMovesPerTurn` non-tap moves a look.
- **The default policy** follows `getNextAction` (which taps CONTINUE once the goal has latched), rebalances
  with WRKR's `getReallocation`, and does the goal verbs that are not purchases: taps in Egg Laying, puts a
  worker on any role a goal condition counts (the Colony GUARD, read through `goalFor` in `state/queries`),
  and in Combat trains soldiers until the enemy on the card is no longer dangerous (`assessMatchup`,
  `peekEnemy`), then fights it. It never prestiges and answers no decision.
- **Probes** report each phase entry (real time, played time, check-in) and, per check-in, the phase on
  arrival, the decisions available (every affordable item, plus CONTINUE when latched), the moves that landed
  by action name, the taps and the refusals.
- **Boundary:** `tests/arch/simBoundary.test.ts` fails if sim/ imports `ui/`, `platform/` or `debug/`, uses the
  DOM, imports a value from the catch-up, the tick, the game loop or the ticker, touches the live `gameState`,
  calls a system instance's method, or draws `Math.random`.

## Consequences

- Sim tests (`tests/sim/`) assert what a run does (it taps, guards, trains, fights, continues; the probes add
  up), never how fast. Durations against the GDD targets are Story 3.9's report (`pnpm sim`, not CI);
  reachability ceilings are Story 3.8's test, which can build on `runSim({ stopWhen })`.
- Because active play goes through `resume`, it runs under the offline rules (no decisions, the starvation
  floor) at full efficiency, the same path a short frame gap takes in the browser.
- `log.info` prints in dev, and catch-up logs a line per resume: a Node script for `pnpm sim` must provide
  `import.meta.env` (run it through Vite or vite-node) and should silence info lines.
- A new player verb is a new `SimMove` kind that calls the action a button calls.
