# 0008. One Button primitive owns press feedback, hold-repeat and the flash rule

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  UI component patterns, `ui/primitives/` · Story 1.11 (#241) · FR45, UX-DR11, UX-DR20, UX-DR38, NFR1

## Context

Every buy, assign and lay needs the same press feel on a phone: feedback before the state write, a cancel by dragging
off, repeat while held, and no flashing. Each panel doing this itself would drift, and the flash rule could only be
checked one button at a time.

## Decision

- **`src/ui/primitives/Button.tsx`** is the one button. Variants: `primary` (`> ` prefix, block cursor, 1.5 px accent
  border), `secondary` (dim, no border, at least 44 px) and disabled (`disabled="<reason>"`: dashed `edge` border,
  reason on the cost line, `aria-disabled` so it stays focusable). `data-*` props go straight onto the `<button>`.
- **Press:** pointer-down sets a `useSignal` bound to `data-pressed`, so inverse video lands in the same task, with no
  re-render and before any state write. The action fires on pointer-up over the button; `pointerleave` and
  `pointercancel` cancel. Implicit touch capture is released so dragging off is seen. Keyboard activation
  (`click` with `detail === 0`) fires once.
- **Hold-repeat** (`repeat` prop): timing lives in `src/ui/primitives/holdRepeat.ts` (UI feel, not balance). A press
  shorter than `HOLD_DELAY_MS` is a tap. Held longer, the action fires every `REPEAT_INTERVAL_MS` (about 8/s), then
  every `FAST_REPEAT_INTERVAL_MS` once the hold has lasted `ACCELERATE_AFTER_MS`. Every repeat calls the same
  `onPress` (an action). The first `{ ok: false }` stops the repeat, and a release after repeats fires nothing more.
- **Flash rule:** the button inverts once per press and never per repeat. The cursor blinks through CSS (1 Hz,
  5 cycles, then steady) after mount and after each release, and holds steady while pressed. Under reduced motion it
  is always steady: `ui/theme/reducedMotion.ts` mirrors the setting in effect (Story 1.10, passed in by main) onto
  `<html data-reduced-motion>`, so ui/ never imports a platform value.
- **Truncation:** the verb and the target are separate flex boxes. Only the target shrinks, with an ellipsis.
- **Focus:** `src/ui/styles/base.css` gives every focusable control a 2 px `accent` outline at a 2 px offset.
- **Testing:** until a game screen adopts the primitive, E2E drives it on a dev-server-only harness page
  (`tests/e2e/harness/button.html`), which the build doesn't include.

## Consequences

- Later primitives (Stepper, HoldToConfirm) reuse `Button` and `holdRepeat.ts` rather than their own timers.
- The cost line is always the button's second line. The "moves inside below 560 px" rule needs no special case
  until a screen places a cost line outside a button.
