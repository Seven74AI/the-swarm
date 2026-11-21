# 0010. One HoldToConfirm primitive guards every irreversible action

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  UI component patterns, `ui/primitives/` · Story 1.13 (#243) · UX-DR21

## Context

Prestige wipes a run, research cancel loses half its cost, and save import (Story 2.11) replaces the game. A stray tap
must never trigger them. The player picks how deliberate the confirm is (Story 1.10 settings: `confirmStyle`
`hold` | `twoTaps`, `confirmHoldMs`), and ui/ may not import platform values (ADR 0007).

## Decision

- **`src/ui/primitives/HoldToConfirm.tsx`** is the one control for irreversible actions. It takes
  `settings: ReadonlySignal<ConfirmSettings>` (`confirmStyle`, `confirmHoldMs`). main.tsx passes
  `platform.settings.settings` to `UIRoot` (`confirmSettings`), which hands it to the panels. ui/ imports only the
  `ConfirmStyle` type from platform/.
- **Hold mode** (default): pointer-down, or Enter/Space held on the focused control, starts a square ring of 8 block
  cells (a 3×3 grid without its centre) that fills clockwise over `confirmHoldMs`. The action fires once, when the
  ring completes. Release, drag-off, pointer-cancel or blur before that drains the ring (at twice the fill speed) and
  fires nothing. A click (tap or keyboard activation) never fires. Ring shape and timing helpers live in
  `src/ui/primitives/holdConfirm.ts` (UI feel, not balance).
- **Two-tap mode:** the first tap or keyboard activation arms the control for `ARM_MS` (5 s), re-labelled
  `> TAP AGAIN TO <VERB>` in inverse video (`data-armed`). A second tap inside the window fires; otherwise it disarms.
- The control keeps Enter and Space to itself (`stopPropagation`), so page shortcuts such as Space-to-pause don't see
  them while it is focused.
- It looks like a primary `Button` (it uses `Button.css`, pressed in inverse video, disabled through `aria-disabled`).
  It does not wrap `Button`: Button fires on release and its repeat timing is fixed, while a confirm needs its own
  configurable hold and must never fire on release. ADR 0008's "reuse Button" note is met by sharing its styles and
  conventions, not its timers.
- Hooks for legacy selectors: `class` (e.g. `btn-prestige`), `title` and `data-*` go onto the `<button>`.
- **Legacy panels** render it into a persistent host element with Preact's `render()`, outside the markup they
  rebuild, so a re-render never drops a running hold. `ResearchPanel` now patches progress bars in place and rebuilds
  only when what it offers changes.

## Consequences

- Story 2.11's save import uses `HoldToConfirm`; no other confirm dialog or `confirm()` call should appear.
- E2E drives a hold with `pointerdown`, a wait past the hold (or `page.clock.runFor`), then `pointerup`.
