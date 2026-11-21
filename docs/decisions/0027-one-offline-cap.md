# 0027. One offline cap, read through getOfflineCapMs

- **Status:** accepted (2026-11-21)
- **Source:** Story 2.4 (#270) · FR20, AR3 · ADR 0002, 0026

## Context

Three different caps limited resumed time:
- 4 h in `calculateOfflineTicks` (`OfflineProgression.ts`), used on load;
- 8 h in `GameLoop.setOfflineAccumulator`, which nothing called;
- 1 s in the Ticker's frame cap, which Story 2.3 bypassed only when a gap handler was set.

A player couldn't tell how long the nest keeps working, and Story 2.8's Legacy upgrades need one cap to raise.

## Decision

- **`getOfflineCapMs(state)`** (`src/systems/OfflineProgression.ts`) is the only source of the cap. It returns
  `OFFLINE_CAP_BASE_MS` (12 h, `src/data/constants.ts`) plus the `offlineCapRaiseMs` of every owned prestige-tree
  upgrade (`PrestigeUpgrade.offlineCapRaiseMs`; no node sets it until Story 2.8), and never more than
  `OFFLINE_CAP_MAX_MS` (24 h).
- **Two cuts, both through it:**
  - `planOffline(state, elapsedMs, efficiency)` is used by `resume()` for every gap of 60 s or more. It returns an
    `OfflinePlan` `{elapsedMs, effectiveMs, offlineTicks, capMs, capped}`, which `OfflineLoadInfo` extends.
  - `catchUp` cuts its `ms` and its ticks with `capOfflineMs`, whatever the caller passes. This covers the dev time
    skip, whose `MAX_SKIP_HOURS` is derived from the ceiling.
- **The summary sheet** shows `THE NEST WORKED THE FIRST <cap>.` (`[data-offline-cap=<capMs>]`) when `capped`.
- **The old caps are gone:**
  - the 4 h constant;
  - `GameLoop.setOfflineAccumulator`;
  - the Ticker's frame clamp. A frame gap over `FRAME_GAP_MS` is never ticked: it goes to the gap handler
    (`resume(gap)`), or, with no handler, is not simulated.
- **`tests/arch/offlineCap.test.ts`** fails in three cases:
  - an hour-sized ms literal outside `data/constants.ts`;
  - a `Math.min` clamp over elapsed, offline, accumulated or frame time outside `OfflineProgression.ts`;
  - an offline-cap constant declared outside `data/constants.ts`.

## Consequences

- Story 2.8 adds cap-raise nodes by setting `offlineCapRaiseMs`; nothing else changes.
- A 12 h catch-up at 50% is about 432k ticks (about 0.8 s in Node) until Story 2.6's macro-steps.
