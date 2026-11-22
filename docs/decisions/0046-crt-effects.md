# 0046. CRT effects: scene surfaces, line-work, and OFF where the device asks for readability

- **Status:** accepted (2026-11-22)
- **Source:** Story 8.4 (#312) · UX-DR36 · DESIGN.md "Elevation & Depth" (CRT effects) · ADR 0007 (settings store),
  ADR 0023 (accessibility floor, `<html data-crt>`), ADR 0041 (type roles), ADR 0043 (only the phase palette)

## Context

Story 1.10 added the `crt` setting (SCENE default, FULL, OFF) and Story 1.32 bound the mode in effect to
`<html data-crt>`, OFF under reduced motion. Nothing drew the effects yet, and the legacy Space styles had text
glows of 12 to 15 px at 50 to 60%, far past the 2 px / 35% the design allows.

## Decision

- **Two hooks.** `[data-crt-surface]` marks a scene surface: the nest scene, the phase reveal and the PAUSED overlay
  (the full-screen overlays). Shell parts (strip, tab bar, sheets) never carry it
  (`tests/unit/ui/theme/crtEffects.test.ts`). `[data-line-work]` marks vector line-work (the enemy creature and the
  vector scenes of Story 8.5 onwards).
- **`ui/styles/crt.css`** holds every effect, keyed to `data-crt`:
  - SCENE: a surface's `::after` draws the scanlines (`z-index: 1`, `pointer-events: none`); its direct children
    other than line-work are lifted to `z-index: 2` (surfaces lay out in flex, so nothing moves), so text is never
    under a scanline. Surfaces need a positioned box (`.nest-scene` is `position: relative`; overlays are fixed).
  - FULL: `body::after`, fixed over the whole viewport above every layer, `pointer-events: none`.
  - Glow tokens: `--crt-line-glow` (`drop-shadow(0 0 3px accent)`) on `[data-line-work]`, and `--crt-text-glow`
    (`0 0 2px`, accent at 35%) on every accent rule set at `value` (15 px) or larger. Every `text-shadow` in the
    styles is this token, so the limit and OFF reach all of them. text-shadow inherits: containers holding smaller
    text (`.sheet__body`) don't take it, and the primary button's cost line resets it.
  - OFF: both tokens are `none`, and every `text-shadow` and `box-shadow` in the page is removed (`!important`, as
    `motion.css` does for reduced motion), the legacy box glows included. Elevation shadows go too: they are scrim
    on near-black and carry no information.
- **Device pixels.** Scanlines are measured only in `--crt-px`, which `ui/theme/crt.ts` sets on `:root` from a stylesheet of its own
  (`<style data-crt-px>`, never an inline style, so the root keeps no inline style):
  `round(dpr) / dpr` CSS px, a whole number of device pixels near one CSS pixel, updated on pixel-ratio change.
  One dark line every three units.
- **OFF at boot.** `Capabilities` gains `reducedTransparency` and `textScale` (root font size / 16, read once). The
  settings store's `crt` in effect is OFF when reduced motion is on, or, from boot, when the device asks for more
  contrast or reduced transparency or the text scale is above 130% (`crtOffAtBoot`). The stored choice is never
  overwritten (settings stay outside the save, no version change). Picking any CRT option in the session, the stored
  one included, is the player's word over the device's and turns the device override off until the next boot.
  `crtOffBy` (`'reducedMotion' | 'device' | null`) feeds a second note on the settings row saying why the effects
  are off; the pressed option stays the player's choice.

## Consequences

- New scene drawings put `data-crt-surface` on their area and `data-line-work` on their line-work; they get the
  scanlines and glow with no CSS of their own.
- `tests/e2e/crt.spec.ts` checks the three modes, the boot rules (contrast, reduced transparency via CDP, text
  scale) and the device-pixel unit at DPR 1, 1.5 and 2.625.
