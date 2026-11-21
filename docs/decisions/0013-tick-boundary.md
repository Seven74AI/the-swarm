# 0013. The tick boundary: a failed tick is discarded, three stop the run

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  Error Handling · Story 1.17 (#247) · AR16

## Context

The live tick was one closure in `main.tsx` that computed the next state, wrote `gameState.value` and flushed the
tick's events. An exception in any system escaped into the rAF loop: the ticker stopped silently, and nothing
stopped the autosave from writing whatever state the page held next.

## Decision

- **`GameLoop.bindTick({ read, step, write, flush, onHalt })`** registers the one live tick on the `Ticker` and
  returns it. `step(state, ctx)` computes the next state and raises events on `ctx.events` (the `TickContext` of
  Story 1.3); it never writes state. The boundary makes the tick's one write, then flushes the events. A `step`
  that returns the state it was given writes nothing.
- **A tick that throws is discarded whole**: nothing is written (the state reference stays the last good snapshot),
  its queued events are dropped, and the error goes to `log.error('tick', …)`. The next tick runs normally; a good
  tick resets the count.
- **`MAX_FAILED_TICKS` (3) failures in a row halt the run**: the ticker stops, `isHalted()` turns true, `start()`
  and `resume()` do nothing from then on, and `onHalt` runs once.
- **main's `onHalt`** keeps the last good snapshot as the save: it stops the autosave, writes the snapshot, and the
  `beforeunload` and action saves write that snapshot too. It opens `ui/sheets/TickFailureSheet` at `offline`
  priority (ahead of every other sheet): not dismissible, scrim not passthrough (`ModalSheet passthrough={false}`),
  two actions, EXPORT SAVE and RELOAD.
- **`platform.browser`** (`platform/browser.ts`): `download(filename, text) → boolean` and `reload()`. EXPORT SAVE
  downloads `SaveManager.serialize(snapshot)` (the same text `save()` writes) as `the-swarm-save.json`.
  Story 2.11 builds the full export/import on top.
- `processTick` (offline catch-up) moved to `engine/processTick.ts`; `main` re-exports it.

## Consequences

- Systems must still never mutate state in place: the boundary can only keep the previous reference, so a system
  that changed it in place before throwing would leak that change (`TerritorySystem.claimTile()` is the known case,
  and its callers spread first).
- Offline catch-up is not guarded: it runs before the boundary exists, and a throw there fails the boot like a
  corrupt save (the corrupt-save sheet, D4, is a later story).
