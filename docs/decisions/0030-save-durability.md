# 0030. Save durability: persistent storage and the home-screen hint

- **Status:** accepted (2026-11-21)
- **Source:** Story 2.12 (#278) · AR6 · arch D4 (Durability) · ADR 0007, 0026

## Context

A browser may delete a site's storage. Safari deletes a site's script-written storage (localStorage included) after
7 days without a visit, unless the site runs as a home-screen web app. Other browsers may evict "best-effort"
storage under pressure unless the site asked for persistent storage. The save lives in localStorage (ADR 0026), so
either can end a run.

## Decision

- **`Durability`** (`src/platform/storage/durability.ts`, `platform.durability`), built from `navigator.storage`,
  the same storage as the save store and the capability snapshot:
  - `requestPersist()` never rejects. It resolves with a `PersistOutcome`: `granted` / `denied` (the browser's
    answer), `already` (persisted before: nothing asked), `asked` (an earlier load asked: nothing asked now),
    `unsupported` or `failed`. It asks at most once per load and, once the browser answered, never again on this
    device: the answer is kept under `the_swarm_storage_persist`. Firefox shows a prompt for it, so a run must not
    meet that prompt on every load. `status()` gives this session's outcome; diagnostics export it as `storage`.
  - `wantsHomeScreenHint()` is true on a mobile browser (`capabilities.mobile`, `(pointer: coarse)`, new in the
    capability snapshot) that isn't the installed app (`capabilities.standalone`) and hasn't shown the hint
    (`the_swarm_home_hint`). `markHomeScreenHintSeen()` records it.
  - Both keys live outside the save (D4): they survive prestige and import and are never exported. Blocked storage
    never throws; the flags then last the session.
- **`bindDurability`** (`src/persistence/durability.ts`), bound by main after the offline summary opens. The first
  meaningful play is the first `phase_committed`, or a load already past Egg Laying (a run from an earlier build
  never commits its first phase again). Then it requests persistence and logs the outcome (`log.info('storage', …)`,
  `log.warn` when the API failed), and opens the hint where wanted, marking it seen when it opens.
- **The hint** (`src/ui/sheets/HomeScreenHintSheet.tsx`, `[data-home-screen-hint]`) is a dismissible modal at
  `modal` priority, so it waits behind the offline summary, decision sheets and the phase reveal. Its close button
  reads `GOT IT`.

## Consequences

- A denied request is not retried on later loads, even though Chrome may grant it later with more engagement.
  Export (Story 2.11) is the player's backup either way.
- Desktop Safari has the same 7-day cap but gets no hint: the story scopes the hint to mobile browsers.
- A store build (Capacitor) can return `unsupported` and `false` from this service without touching game code.
