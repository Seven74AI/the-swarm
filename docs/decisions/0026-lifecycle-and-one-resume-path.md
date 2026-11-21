# 0026. The Lifecycle service and the one resume path

- **Status:** accepted (2026-11-21)
- **Source:** Story 2.3 (#269) · FR22, AR2, AR12 · NFR3, NFR5 · arch D1 · ADR 0002, 0013, 0025

## Context

ADR 0002 says every return goes through one `resume(elapsedMs)`. The code had no such path. Offline time was worked
out only on a cold load, inside `SaveManager.load()`, from the save's write time. A hidden tab kept its rAF loop (the
browser throttled or froze it), and the first frame back was cut to 1 s by the frame cap, so the time away was lost.
The game saved only on `beforeunload` (often skipped on mobile) and every 30 s. A save written while the page was
hidden carried a fresh timestamp, which hid the time away from the next cold load.

## Decision

- **`Lifecycle`** (`src/platform/lifecycle.ts`, `platform.lifecycle`): `bind({ hidden, returned })` turns page events
  into two signals. `hidden`: `visibilitychange` to hidden, or `pagehide`. `returned`: `visibilitychange` to visible,
  `pageshow` (bfcache) or window `focus` (after sleep), only while the document is visible. `beforeunload` stays in
  main as a fallback save.
- **`resume(state, elapsedMs, deps)`** (`src/engine/resume.ts`) is pure. A gap of 0 or less, or one that isn't a
  number, simulates nothing. Under `RESUME_FULL_EFFICIENCY_MS` (60 s, `data/constants.ts`) the gap runs at full
  efficiency and `offline` is null. At 60 s or more it takes the offline path at `state.offlineEfficiency` (default
  50%) and returns `offline` (`OfflineLoadInfo`, which moved here from SaveManager). Both run `catchUp`.
- **`createResumePath(deps)`** is the only caller. Every trigger goes through its `apply`, which calls `resume` once,
  writes once, logs `log.info('resume', …)` and calls `onResumed` (main opens the offline summary when `offline`
  is set).
  - `coldStart(lastSeenAt)`: once at boot. Not called for an unreadable save, which waits with a fresh state.
  - `hide()`: the first hide records `hiddenAt`, stops the ticker if it runs, and forces a save.
  - `show()`: the first return after a hide resumes `now − hiddenAt` and restarts the ticker. Later returns, and
    returns with no hide before them, do nothing, so a burst (visible + pageshow + focus) applies the gap once.
  - `frameGap(ms)`: `Ticker.onGap` sends any visible frame gap over `FRAME_GAP_MS` (1 s) here whole, and doesn't
    tick through it.
  - Hidden time is simulated only if the game was running when it hid. A game that is waiting (unreadable save) or
    paused stays as it was. A halted simulation (ADR 0013) is never resumed.
- **`lastSeenAt`** goes in the save envelope (save v20): the wall-clock time the saved state was last simulated to.
  `SaveManager.setSeenAtSource` reads it from `resumePath.seenAt()`, which is `hiddenAt` while hidden and `now`
  otherwise. Autosaves and `beforeunload` saves written while hidden therefore keep the hidden moment. The v19 → v20
  migration takes it from `gameState.lastSaveTimestamp`, falling back to `timestamp`. `LoadedSave.offline` is gone:
  the loader returns `lastSeenAt`, and resuming is main's job.

## Consequences

- The offline summary now opens from 60 s away (it was 30 s). Gaps under 60 s, on a cold load included, show no sheet.
- Later stories change what `resume` does, not where it is called from. They are 2.4 (one cap; the 4 h, 8 h and frame
  caps stay until then), 2.6 (macro-steps), 2.7 (offline-only rules), 2.8 (the efficiency curve), 2.9 (the summary
  and strip flash) and 2.10 (hiding ends the pause).
- The dev `timeSkip` cheat still calls `catchUp` directly: it is a cheat, not a way back.
