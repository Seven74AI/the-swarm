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

## Pacing report (Story 3.9)

- **`pnpm sim`** runs `scripts/sim.mjs`, which loads `src/sim/report.ts` through Vite's `runnerImport` (so
  `import.meta.env` exists; no extra dependency) and silences `console.info`. It is not part of CI.
- **The GDD targets are data:** `pacingTargets` (`src/data/balance/pacing.ts`): per MVP phase an active-play
  window (null where the GDD has none) and a finish window (within the first N check-ins, or on day A to B),
  the tap-share targets and the idle-check-in limit. `pacingReportDefaults` holds the default seed and days.
- **The report is pure functions over the probes** (`phaseSpans`, `judgeSpan`, `tapShare`, `median`,
  `idleCheckIns`, `buildPacingReport`, `formatPacingReport`); `runPacingReport` plays a fresh game.
  `tests/sim/report.test.ts` checks the computation on made-up probes and the report's shape on a real run,
  never a duration or a share.
- **An idle check-in** (the GDD's pacing defect) is one where, on arrival, nothing could be done within the
  limit (`waitMs`: 0 when a move is open, else the soonest affordable item at the current rates, null when
  never) and no move landed during it. Phase 1 arrivals with nothing affordable are not defects, because
  tapping makes things affordable.
- **Tap share** comes from the probes' egg ledger: each sample is the eggs laid since the last look (the
  `stats.totalEggsLaid` delta), the ones LAY EGG taps laid, and the phase they were laid in.
