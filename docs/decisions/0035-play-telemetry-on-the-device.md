# 0035. Play telemetry stays on the device

- **Status:** accepted (2026-11-21)
- **Source:** Story 3.10 (#290) · FR38 · NFR10 · arch D12 (Pacing harness: telemetry) · ADR 0018, 0026, 0034

## Context

The owner tunes pacing from real play: how long each phase takes, how long a check-in lasts and how many choices a
player has on arrival. The game has no accounts and no server, and must never call home (NFR10). The headless sim
(Story 3.7, ADR 0034) measures the same things for a scripted player; telemetry measures them for a person.

## Decision

- **A ring buffer beside the game, outside the save** (`src/state/telemetry.ts`, `createTelemetry`). Like the
  chronicle (ADR 0018) it is pure and DOM-free, but unlike the chronicle it is not in the save envelope: it survives
  prestige and import, and an exported save never carries it. At most `TELEMETRY_MAX_ENTRIES` entries
  (`src/data/constants.ts`); the oldest drop first. Two entry kinds:
  - `check_in`: arrival (cold start or return to the page) to the page hiding. `lengthMs`, `awayMs` (since the last
    check-in ended on this device; null for the first), the arrival `phase` and `decisionsAvailable`.
  - `phase`: a phase left (CONTINUE, prestige, or a save in another phase than the stored one). `activeMs`
    (foreground time in it, summed over check-ins) and `elapsedMs` (wall time, time away included), and `next`.
- **"Decisions available"** is `decisionsAvailable(state)` in `systems/NextAction.ts`: each affordable item plus
  CONTINUE when the goal has latched, the same count the sim's probes make. Decision events are not counted.
  Telemetry does not import `sim/`, which stays headless-only.
- **Storage only through platform/:** `platform.telemetry` (`src/platform/storage/telemetryStore.ts`), key
  `the_swarm_telemetry`. Written after each entry. Blocked or full storage never throws; the buffer then lasts the
  session. Stored text that is foreign, from another version or unreadable starts an empty buffer; malformed
  entries are dropped one by one.
- **main drives it:** the first check-in begins after the cold-start resume; `platform.lifecycle`'s `hidden` ends a
  check-in and `returned` begins one (repeats in a burst are ignored, like the resume path's); `phase_committed`
  and `prestige_triggered` tell it the phase.
- **Export only by the player:** settings' `EXPORT TELEMETRY` (`[data-action="export-telemetry"]`) downloads
  `the-swarm-telemetry.json` through `platform.browser.download` (the save export's path, Story 2.11). The file
  has the entries, the check-in under way (with its length so far), the phase under way and `phaseActiveMs`, the
  foreground time per phase.
- **No network, enforced twice:** `tests/arch/noNetwork.test.ts` fails on any network API in `src/` (`fetch(`,
  `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `RTCPeerConnection`, `WebTransport`).
  `tests/e2e/telemetry.spec.ts` plays, hides and returns, exports, reloads, and asserts no outgoing request: none to
  any origin but the app's own, and no fetch/XHR/beacon/EventSource/WebSocket request to any origin. Loading the
  app's own assets is not outgoing; the dev server's hot-reload socket is local tooling and is ignored.

## Consequences

- Paused time counts as check-in time: the player is there. A check-in cut short by a crash (no hide) is lost.
- Time per phase is foreground time; a phase passed mostly offline shows a small `activeMs` and a large `elapsedMs`.
- The sim's probes (Story 3.7) can import `decisionsAvailable` from `systems/NextAction.ts` instead of their own copy.
- A store build keeps the same buffer: only the platform store and the download change.
