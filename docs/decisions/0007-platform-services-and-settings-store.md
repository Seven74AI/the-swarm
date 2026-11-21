# 0007. Platform services are built once in main; settings are a separate signal outside the save

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  D4, D9, AR12 · Story 1.10 (#240)

## Context

Device features (vibration, standalone mode, reduced motion, contrast) and player preferences had no home. Putting
preferences in the game save would let prestige, loading or importing a save reset them, and a store build will need
to swap the web implementations for native ones.

## Decision

- **`src/platform/`** holds interfaces plus web implementations: `capabilities.ts` (`detectCapabilities`, one frozen
  snapshot at boot, every probe degrading to `false`), `haptics.ts` (`Haptics.play('light'|'medium'|'heavy'|'double')`,
  `navigator.vibrate` or a no-op, never throws, reads the haptics setting at each call), `settings.ts` and
  `feedback.ts` (event → haptic wiring, sound setting → `audio.muted`). `createWebPlatform()` in `platform/index.ts`
  builds them all.
- **Only `main` imports values from `platform/`** (and `platform/` itself); other layers may import its types to
  declare what they receive, and game layers may not import it at all. Enforced by `tests/arch/architecture.test.ts`.
  Services reach the rest of the game only through what `main` passes in.
- **Settings** are one `signal<Settings>` (frozen values) in a `SettingsStore` with `update(patch)`, stored under
  `the_swarm_settings` as `{ version, settings }` with their own `SETTINGS_VERSION`. Every field is validated on read
  and update; invalid fields fall back to the default, corrupt data or an unknown version to all defaults. Storage
  errors are swallowed (the session keeps the change). Defaults: sound off, haptics on where the device vibrates,
  reduced motion `os` (follows the OS; `reducedMotion` computed gives the effective value), CRT `scene`, decision
  timers `normal`, confirm `hold` at 1000 ms, lay mode `hold`, keyboard shortcuts on.

## Consequences

- Settings survive prestige, save load/import and save deletion, and are never in a save export. They need no
  game-save migration; a settings schema change bumps `SETTINGS_VERSION` and handles older versions in `settings.ts`.
- `platform/` cannot use `utils/log` (value import from a game layer), so it reports nothing and degrades silently.
- Later stories (settings screen 1.27, buttons 1.11, decision timers, CRT) read `settings`/`reducedMotion` from the
  platform object `main` hands them.

## Addendum: the settings screen (Story 1.27)

- **Settings v3:** `keyBindings: Readonly<Record<ShortcutId, string>>` (shortcut → `KeyboardEvent.key`, single
  characters lower case). Defaults in `DEFAULT_KEY_BINDINGS`: Space = primary action, P = pause, 1–5 = tabs,
  Esc = close a sheet. A stored or updated map is merged shortcut by shortcut onto the current one; unknown
  shortcuts and empty keys are dropped, and a map where two shortcuts share a key is refused as a whole.
  Versions 1 and 2 are still read field by field and get the default keys. Story 1.30 acts on the bindings and on
  `keyboardShortcuts`.
- **Screen:** `src/ui/sheets/SettingsSheet.tsx` `openSettings(sheets, { store, capabilities, onExportDiagnostics,
  onReplayIntro? })`, a modal through the SheetController. It gets the store from main (no platform value import)
  and calls `store.update` on every tap. Remapping swaps keys, so no two shortcuts ever share one. REPLAY INTRO is
  disabled with its reason until Story 8.10 passes `onReplayIntro`.
- **Diagnostics:** `src/debug/diagnostics.ts` `buildDiagnostics(...)` (log ring buffer, the serialized save,
  settings, capabilities, build id, user agent) is built in main and downloaded with `platform.browser.download`;
  nothing leaves the device. The build id is Vite's `__BUILD_ID__` define (the commit in CI, `dev` locally).

## Addendum: the Audio service (Story 8.8)

`bindSoundSetting` (sound setting → `audio.muted`) is gone. `platform.audio` reads the sound setting at every
call, as haptics does, and `bindSoundFeedback` wires the events to it. See ADR 0039. `Capabilities` gained
`audio` (Web Audio exists).
