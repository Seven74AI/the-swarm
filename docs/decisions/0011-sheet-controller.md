# 0011. One SheetController; modal and peek sheets

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  D7 (UI shell) · Story 1.14 (#244) · AR10, UX-DR22

## Context

Overlays used to be built per feature: the offline summary appended its own overlay to `<body>`, the decision popup
sat bottom-right on its own timer. Two could be on screen at once, and none of them handled focus. Battle summaries,
the resource sheet, the corrupt-save sheet and the map/star/chamber peeks are still to come.

## Decision

- **`ui/shell/SheetController.ts`**: `createSheetController()` returns one signal, `state` = `{ open, queue }`, and
  `open(request) → id` / `close(id)`. A request is `{ priority, render(close), onClose? }`.
  Priority, highest first (`SHEET_PRIORITIES`): `offline` > `decision` > `battle` > `modal` > `peek`.
  - Modal sheets never stack: one is open; the rest wait in priority order, first come first served within one priority.
  - A higher-priority modal sends the open lower one back to the head of its group, so two sheets requested together
    open highest first whatever the call order.
  - Opening a modal closes an open peek (it does not come back); a newer peek replaces a peek; a peek waits behind a modal.
  - The element focused at request time is the sheet's `trigger`; a request made from inside a sheet inherits that
    sheet's trigger.
  - States are never mutated; `onClose` runs exactly once per sheet, opened or not.
- **`ui/shell/SheetHost.tsx`** draws only `state.open`, keyed by id, inside `SheetContext` (`close`, `trigger`). A
  sheet's timers start when it actually opens, never while it waits. `App` renders it after the legacy UI.
- **`ui/shell/Sheet.tsx`**:
  - `ModalSheet`: scrim, `raised` panel with an `accent` top rule, `────` handle, headline in `display`
    (`[data-sheet-headline]`), body, actions. `role="dialog"`, `aria-modal`, labelled by the headline; focus moves to the
    headline, Tab wraps inside, focus that lands outside is pulled back, and focus returns to the trigger on close.
    Dismissible (default): one `action` plus `[ CLOSE ]` (`[data-sheet-close]`, relabel with `closeLabel`); closes by
    swipe down (`SWIPE_CLOSE_PX`, started off a control), scrim tap, `[ CLOSE ]` or Esc (since Story 1.30 the
    close shortcut, through `SheetController.dismiss()`: ADR 0021).
    `dismissible={false}` (decision sheets): at most two `actions`, no `[ CLOSE ]`, ignores Esc, scrim and swipe, and its
    scrim lets taps through (`data-passthrough`) because the colony keeps running beneath it.
  - `PeekSheet`: no scrim, ≤ 160 px, header naming the target (`[data-sheet-header]`), one action plus `[ CLOSE ]`,
    Esc closes; it doesn't take focus.
- **Specific sheets live in `ui/sheets/`**: `OfflineSummarySheet` (`openOfflineSummary`) and `DecisionSheet`
  (`bindDecisionSheets({ bus, sheets, choose })`) replace `OfflineSummaryPopup` and `DecisionPopup`, keeping the
  `.offline-summary-popup` / `.offline-overlay` and `#decision-popup` / `.decision-popup-title` / `.decision-popup-desc`
  / `button[data-choice]` hooks. main.tsx creates the controller and returns it from `bootstrap()` as `sheets`.

## Consequences

- Every new sheet (battle summary, resource sheet, corrupt save, peeks) is a `sheets.open({ priority, render })` call
  from main or a screen that receives the controller; no feature mounts its own overlay.
- The legacy decision events keep 2–3 choices in the sheet body until the decision-event content stories (D8) bring
  two choices, an ignore line and a timer meter. Their 30 s auto-dismiss counts only while the sheet is open.
- The overlay layer (phase reveal, cinematic, ending) is a separate story; it will hold decision events back.
