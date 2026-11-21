# 0009. Stepper, Card, Meter, Toast and CoachMark primitives; coach marks remembered in settings

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  UI component patterns, `ui/primitives/` · Story 1.12 (#242) · FR45, UX-DR15, UX-DR17, UX-DR29

## Context

WRKR, BUILD, FRONT and the sheets all need the same stepper, card, meter, toast and coach mark. Built per screen,
they would drift in behavior and in their accessibility floor, and the coach marks need a memory that survives
prestige and save import.

## Decision

- **`Stepper`** (`ui/primitives/Stepper.tsx`): `[−] value [+]`, each bracket a `Button` (ADR 0008) with `repeat`,
  so hold-repeat and its timing come from `holdRepeat.ts`. `stepAmount(direction, value, available, multiplier)`
  gives the signed whole step that keeps the value within 0..`available`; ×1, ×10 or ×MAX. Steps apply at once through
  `onStep(delta)` (an action). A step of 0 is a refusal, so a hold stops at the limit. The stepper keeps the value it
  has already stepped to since its last render, because hold repeats can outrun Preact's batched re-renders.
  Accessible names come from the caller (`addLabel` / `removeLabel`, a string or a function of the step size).
  Without a `multiplier` prop the stepper shows its own `MultiplierRow`; with one, the caller shares a row.
  `Button` gained an optional `label` (accessible name) for typed-decoration labels like `[+]`.
- **`Card`**: an `article` whose only interactive content is its `action` slot. While unaffordable it shows
  `needs <formatFull(n)> more <glyph>` in `warn` (`data-shortfall`). The first false → true change of `affordable`
  while mounted sets `data-highlight` for `CARD_HIGHLIGHT_MS` (2 s); mounting affordable, or a later dip and recovery,
  doesn't highlight.
- **`Meter`**: `role="progressbar"` with integer `aria-valuenow` clamped to 0..max and a caller-written
  `aria-valuetext`; the typed cells (`meterCells`, floor) and the percentage are `aria-hidden`. `warn` marks the fill.
- **`Toast`**: `createToasts()` is a queue of one (`current` signal, `show(text)`); a new toast replaces the shown one
  and restarts the `TOAST_MS` (2 s) timer. `ToastHost` renders it in a polite live region, flattened to one line.
- **`CoachMark`**: shown unless its concept is in `settings.coachMarksSeen`. Dismissed by a click on the target (the
  target's own action still runs) or by `[ GOT IT ]`, whose click and pointer-down stop there (the tap is consumed).
  The caption is a polite live region. It receives the settings store as `memory` from main, never by import (ADR 0007).
- **Settings v2:** `coachMarksSeen: readonly string[]` (frozen, deduplicated, each a non-empty string).
  `SETTINGS_VERSION` is 2; version 1 files are still read field by field, so they keep their values.
- **Styles:** one CSS file per primitive, imported by the component, colors only from the phase aliases.
- **Testing:** unit tests per primitive; E2E on a dev-server harness (`tests/e2e/harness/primitives.html`) until
  screens adopt them.

## Consequences

- WRKR role rows (Story 1.2x), BUILD cards and the goal meter use these primitives instead of raw elements.
- A screen that shows coach marks needs the settings store passed down from main (prop or context).
- A toast is never the only place for something actionable; callers also write it to the log or a sheet.
