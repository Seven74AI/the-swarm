# 0019. Decision events live in the game state, on a session clock

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.28 (#258) · FR13, FR46, AR11, UX-DR23 · arch D8, N3 · ADR 0005, 0011, 0014

## Context

The legacy `DecisionSystem` kept its spawn timer in a class and the open event only in the UI: an event spawned on
load for any save past 2 minutes of total play, a 30 s wall-clock `setTimeout` closed the sheet, and closing the app
dropped the event (a free escape). D8 asks for a session clock, data-declared ignore policies, a game-time countdown
that pauses when hidden or waiting, and the open event in the save.

## Decision

- **Content as data:** `src/data/content/decisions.ts` declares each event (`id, phases, ignorePolicy, timerMs?,
  title, situation, ignoreLine, choices[2], ignore?`). Outcomes are declarative effects (`add`, `lose_percent`,
  `reveal_tiles`, `lose_scouts`), a choice may `require` a resource and carry a `risk`. Timing is in
  `src/data/balance/decisions.ts`.
- **State:** `state.decision = { open: { id, remainingMs, openedAtSessionMs, roll } | null, nextSpawnSessionMs }`
  (save v18). `roll` is drawn at spawn and decides any risk, so leaving and coming back can't reroll an outcome.
- **Pure rules** in `src/systems/DecisionSystem.ts`: `startDecisionSession` (each launch: keep the open event, clear
  the spawn time), `tickDecisions(state, input)` (foreground ticks only; offline catch-up never calls it) and one
  `applyChoice(state, event, choice | 'ignore')` for choices and timeouts. `input` carries the session clock, `dtMs`,
  `shown`, `canSpawn`, the timer setting and `rand`.
- **Session clock** in main: ms of foreground ticks since launch. The first tick draws the spawn time 2–3 min ahead;
  after an event closes the next one is drawn again from then.
- **Gates from the UI layer, read by main:** `shown` = the decision sheet is the controller's open sheet and no overlay
  holds it (`bindDecisionSheets().shown()`); `canSpawn` = no overlay and no offline summary open or waiting.
- **Timer setting** (settings `decisionTimers`, Story 1.27): `double` halves the countdown step, `off` stops it.
  `remainingMs` stays in the event's own time, so a change applies at once in both directions.
- **The sheet follows the state:** `bindDecisionSheets` opens the decision sheet when `selectOpenDecision` holds an
  event (so a reload reopens it after the offline summary) and closes it when the event leaves the state.
- **Events:** `decision_spawned {id}` and `decision_resolved {id, choice, timedOut, policy}` replace
  `decision_event`, `decision_chosen` and `decision_applied`. A costly timeout is logged by `EventLog` and toasted
  once by main (the first `ToastHost`, mounted in `App`).

## Consequences

- `rand` is `Math.random` from main until Story 3.1 (ADR 0005) moves it to the seeded PRNG in state;
  `DecisionSystem.ts` itself has no `Math.random` (its `KNOWN_MATH_RANDOM` entry is gone).
- New events are data entries; a new effect kind needs a case in `applyChoice`'s interpreter.
- E2E tests open an event by seeding `gameState.decision.open`, never by waiting for a spawn.
