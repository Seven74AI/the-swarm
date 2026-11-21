# 0021. Keyboard shortcuts act on the shell, through one listener

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.30 (#260) · FR47, UX-DR41 · arch D7 · ADR 0007, 0010, 0011, 0014

## Context

Story 1.27 stored `keyboardShortcuts` (on/off) and `keyBindings` (ShortcutId → `KeyboardEvent.key`) in the settings,
but nothing acted on them. UIRoot had a hard-coded Space-to-pause listener, and every sheet had its own Esc handler,
so a remap or the off switch could not reach them. Hover tips (`[data-tooltip]`) showed text a tap never showed, could
not be hovered and could not be dismissed (WCAG 1.4.13).

## Decision

- **`ui/shell/shortcuts.ts`**: `bindShortcuts({ settings, sheets, overlayHeld?, pause, root? }) → unbind`, bound once in
  main.tsx with `platform.settings.settings` (settings come from main; ui/ imports platform types only). One `keydown`
  listener on the document maps the key (single characters lower-cased, as 1.27 stores them) to a ShortcutId:
  - `primary` presses the button in the visible `[data-primary-zone]` slot (on desktop columns, ADR 0020, the slot of
    columns 2–3, not NEST's) (its `data-kind="primary"` button), with
    `click()`: exactly what a tap does, refusals included. Only with focus on the page or on that button; a focused
    control keeps Space, Enter and the arrow keys.
  - `tab1`–`tab5` press the Nth button of the visible tab bar (so scroll memory and dots behave as on a tap).
  - `pause` calls `UIRoot.togglePause()` (now public). Space no longer pauses.
  - `close` calls `SheetController.dismiss()`.
- **Nothing fires** when shortcuts are off, with Ctrl/Alt/Meta, on auto-repeat, in text fields, while an overlay is
  up, while a press or hold runs (`[data-pressed="true"]`), while a remap listens (`[data-listening="true"]`), or when
  an earlier listener consumed the key (`defaultPrevented`). While a modal sheet is open only `close` acts.
- **`SheetController.dismiss()`** closes the open sheet unless it isn't dismissible: requests take `dismissible?`
  (default: everything but `decision` priority; the tick-failure sheet passes `false`), and a drawn
  `ModalSheet dismissible={false}` (`data-dismissible="false"`) is never dismissed either. `ModalSheet` and
  `PeekSheet` no longer listen for Esc themselves.
- **Off means off, Esc included.** A keyboard player with shortcuts off still reaches `[ CLOSE ]` inside the sheet's
  focus trap.
- **Tips (`ui/shell/tips.ts`, `bindTips()`)**: a tap toggles `data-tip-open` (one at a time), the CSS shows the
  bubble for hover (only under `@media (hover: hover)`), focus or `data-tip-open`, the bubble takes the pointer and a
  bridge covers the gap, and Esc dismisses a showing tip (`data-tip-dismissed` until pointer or focus leaves). Tip
  dismissal is not a shortcut: it works with shortcuts off, and it consumes Esc so no sheet closes with it.

## Consequences

- A new screen gets the primary shortcut for free by putting its primary button in its tab's primary-zone slot.
- A sheet that must not close on Esc opens with `dismissible: false` or at `decision` priority.
- Unit tests that expect Esc to close a sheet bind the shortcuts (`tests/unit/ui/shell/sheets.test.tsx`).
