# 0014. One overlay layer; the phase reveal

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  D4 (`lifetime.revealsSeen`), D7 (overlay layer) · Story 1.20 (#250) · AR10, UX-DR27

## Context

The legacy phase transition was a `#phase-transition-overlay` that `UIRoot` built with `innerHTML`. It had
`pointer-events: none`, so it blocked nothing and its click-to-skip could never fire; skipping was gated on
`prestige.count > 0`, not on having seen the reveal. Decision sheets could open over it. The title cinematic and the
Transcendence ending (later stories) need the same full-screen, input-blocking layer.

## Decision

- **`ui/shell/OverlayController.ts`**: `createOverlayController(root?)` → `active` and `held` signals,
  `show({ kind, render(done), onEnd? }) → id`, `end(id)`. One overlay plays at a time; others wait in request order.
  `onEnd` runs exactly once. While one is up, `root` (`<html>`) carries `data-overlay-active="<kind>"`, set
  synchronously in `show`, so CSS keyed to it is in the same style pass as the state write that requested it.
- **`ui/shell/OverlayHost.tsx`** draws the active overlay, keyed by id, after the `SheetHost`. **`SheetHost`** takes
  `held` and draws no sheet while it is true: sheets and decision events requested during an overlay wait, and their
  timers start only when they are drawn.
- **`ui/overlays/PhaseReveal.tsx`**: `bindPhaseReveal({ bus, overlays, revealsSeen, markSeen, reducedMotion })` (main)
  turns `phase_committed` into a reveal. The reveal is a `role="dialog"` for at most `REVEAL_MS` (3.5 s): phase name in
  `display`, one line from `data/content/phaseReveal.ts` typed in (whole under reduced motion). A capture-phase key
  listener swallows every key; once the phase is in `lifetime.revealsSeen`, a tap, Enter or Esc ends it. When it
  ends, `actions.markRevealSeen(phase)` records it (a UI callback, not a bus listener).
- **Cross-fade:** `PhaseReveal.css` registers the `--color-*` aliases with `@property` (`<color>`, initial
  `transparent`, no phase hex) and transitions them on `:root[data-overlay-active="phase-reveal"]` for
  `--reveal-fade`: 3 s, 300 ms under `:root[data-reduced-motion="true"]`. Boot and prestige still repaint at once.
- **Save:** `lifetime: { revealsSeen: string[] }` (v15 → v16 migration, starts empty). Prestige keeps it.

## Consequences

- The legacy overlay, `transition_start` / `transition_complete`, `PhaseContent.triggerTransition` and the lore
  quotes are gone; `phase_committed` reveals the new panels at once, under the reveal.
- E2E: `tests/e2e/helpers/phase.ts` `tapContinue` waits the reveal out by default (`{ reveal: 'keep' }` to inspect
  it); `waitOutReveal(page)` advances a fake clock when one is installed.
- Because the aliases are registered colors, `getComputedStyle` returns them as `rgb()`, not hex.
- The Combat reveal drawing the first enemy (UX-DR27) belongs to Story 8.3, with the vector scenes.
