# 0026. The save behind a SaveStore, a load status, and no silent reset

- **Status:** accepted (2026-11-21)
- **Source:** Story 2.2 (#268) · AR6 · UX-DR33 · NFR8 · arch D4, ADR 0007, 0013, 0018

## Context

`SaveManager.load()` read `localStorage` directly and returned `null` for anything it couldn't read: bad JSON, a
malformed envelope, a migration that threw. A save from a newer build was "migrated" by doing nothing and loaded.
`null` meant a fresh game, whose first autosave (or `beforeunload`) then rotated the damaged save into the backups
and, a few saves later, out of storage. A player's run could vanish without a word. A failed write was only toasted
once, with no lasting sign and no way to keep a copy.

## Decision

- **`SaveStore`** (`src/platform/storage/SaveStore.ts`, `createLocalSaveStore`): the only code that touches the
  save keys. Same keys as before (`the_swarm_save`, `_bak1`, `_bak2`) and the same 2-slot rotation on `write`, plus
  `the_swarm_save_unreadable`, where a save that couldn't be read is copied, as it was. `load(decode)` takes the
  decoder from the caller (platform/ imports no game code) and returns `{ status, state?, slot?, backup?, raw?,
  error? }`:
  - `ok`: the primary decoded.
  - `recoveredFromBackup`: there is no primary, but a backup decoded (main logs a `warn` and toasts once; the next
    save writes the primary again, so it is told once).
  - `unreadable`: a save exists but `decode` threw on it. The text is kept aside, the newest readable backup is
    offered, and no slot is changed.
  - `empty`: nothing was ever saved.
  `restore(slot)` (LOAD BACKUP), `discardPrimary()` (START OVER), `clear()`, `unreadable()`. `platform.saves` is
  the web store; a Capacitor build swaps it.
- **`SaveManager(store)`** keeps the format (version, migrations, deep-merged defaults, offline info). `decode`
  throws on bad JSON, a malformed envelope, a version newer than `SAVE_VERSION`, or a throwing migration.
  `open()` returns the load status; on `unreadable` it **holds**: every `save()` (actions, autosave,
  `beforeunload`, the tick-halt save) returns false and writes nothing until `loadBackup(slot)` or
  `startOver(state)`. `load()` stays as the plain "state or null". `onSaveStatus(failing)` reports writes going from
  working to failing and back.
- **Boot** (main): on `unreadable` the loop doesn't start, and the non-dismissible, tap-blocking
  `THIS SAVE COULDN'T BE READ.` sheet (`ui/sheets/UnreadableSaveSheet.tsx`, `offline` priority) offers
  LOAD BACKUP (disabled without a readable backup; makes it the save and reloads) and START OVER (hold-to-confirm:
  it is irreversible; drops the primary, writes the fresh run, starts the loop). EXPORT DIAGNOSTICS carries the
  kept-aside text (`unreadableSave`), so the damaged save stays downloadable.
- **Save failed:** `ui/shell/SaveFailedMarker.tsx` draws `• SAVE FAILED` under the resource strip while writes
  fail; tapping it opens `ui/sheets/SaveFailedSheet.tsx` (explains, EXPORT SAVE). The next good write clears it.
  A failed write never touches the primary (the store writes the primary last; a refused `setItem` leaves it).
- **Intro flag** (`src/platform/storage/introFlag.ts`, `platform.introFlag`): the onboarding flag moved behind
  platform/ too. `OnboardingManager` receives it and `hasSave` (any status but `empty`). (Story 8.10: the flag is
  the title cinematic's, `the_swarm_intro_seen`, and the tooltip onboarding is gone; see ADR 0048.)
- **Boundary:** `tests/arch/architecture.test.ts` fails on `localStorage` / `sessionStorage` outside platform/.

## Consequences

- No save field changed: `SAVE_VERSION` stays 19 and no fixture is needed.
- Tests build `new SaveManager(createLocalSaveStore(localStorage))` (or an in-memory store).
- A partial seed without `timestamp` or `gameState` is unreadable, not a fresh start: E2E seeds must be
  well-formed saves.
- Story 2.11 (import) should write through `SaveManager` (so through the store), never `localStorage`.
