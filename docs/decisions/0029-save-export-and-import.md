# 0029. Save export and import

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  Persistence (D4) · Story 2.11 (#277) · AR6, UX-DR32, UX-DR33

## Context

A run has to survive a browser wipe or a move to a new phone, so settings offer EXPORT SAVE and IMPORT
SAVE. A save file from any shipped version must import. A file that isn't a save, or comes from a newer
build, must never overwrite the run. Settings and the intro flag live outside the save (D4) and stay out
of the file.

## Decision

- **The file is the save text.** EXPORT SAVE downloads `SaveManager.serialize(...)` (the envelope with the
  game state, chronicle and play time) through `platform.browser.download`, the same text the save slot
  holds. Settings and the intro flag have their own keys and never enter it.
- **Import decodes like a load.** `SaveManager.readImport(text)` runs the load decoder: envelope checks,
  migrations to `SAVE_VERSION`, a known phase and a resources object, and the current defaults. Anything
  that throws is refused (`not_a_save`); a version newer than the build is `newer_version` with its number.
  Files over `MAX_IMPORT_CHARS` are refused unparsed. `readImport` never writes.
- **Confirm, write, hold, reload.** A valid file opens a sheet that says it replaces the current run, with a
  HoldToConfirm. On confirm, `SaveManager.replaceWith(save)` writes it as the primary (the replaced run
  rotates into backup 1) and holds every later save, so autosave, pagehide and beforeunload can't
  overwrite it. main loads the imported chronicle, stops the loop and reloads the page, so panels, the
  phase and session state are rebuilt from the save by the normal boot path instead of being patched in
  place. A failed write holds nothing and toasts that the current run is unchanged.
- **No offline time for the file's age.** The written save's `lastSeenAt` is the import time: the run
  resumes where the file left off.
- **File picking is a platform service.** `platform.browser.pickFile(accept)` puts a hidden file input in
  the page and resolves with the file's text, or null when the player cancels.

## Consequences

- Any later change to the save envelope goes through `serialize` and the decoder, so export and import
  follow it with no extra work. The round trip is tested over every fixture in `tests/saves/`.
- The import sheets (`src/ui/sheets/ImportSaveSheet.tsx`) are in the axe and text-reflow specs.
