# 0049. The game-feel table is data; floats are rate-limited; headlines type in by CSS

- **Status:** accepted (2026-11-22)
- **Source:** Story 8.9 (#317) · FR41 · UX-DR37, UX-DR38 · EXPERIENCE.md → Game Feel & Juice · ADR 0007 (platform
  services), ADR 0008 (Button and hold-repeat), ADR 0044 (audio), ADR 0045 (scenes), ADR 0047 (dot cloud, scene clock)

## Context

Haptics (Story 1.10) and sound (Story 8.8) were already bound to events, each with its own hand-written list. The
table in EXPERIENCE.md also asks for visuals that were missing: an egg that appears by the queen, creatures that
arrive, battle and decision headlines that type in, a light haptic on the press of a buy, and `+N` floats that never
come faster than 8 a second (a held button speeds up to about 16 repeats a second after 1 s).

## Decision

- **`GAME_FEEL`** (`src/platform/gameFeel.ts`): one row per trigger (lay egg, hatch/mature, newly affordable,
  press/hold buy, battle result, decision event, phase change, camera pull-back). Each row lists its visual (a
  description and the UI hooks that draw it), its haptic (a pattern, a `{ win, loss }` pair, or `none`), its sound
  cues (or `none`) and the events that fire it. It lives in platform/ because the bindings read it and platform/
  may not import values from data/. `tests/unit/platform/gameFeel.test.ts` checks that every row has all three
  channels, that every visual hook exists in src/ui (so a haptic or a sound is never the only feedback), that every
  sound agrees with Story 8.8's `SOUND_EVENTS`, and that the haptic binding plays exactly the table.
- **`bindHapticFeedback`** now reads `GAME_FEEL`. **`bindPressHaptics(document, haptics)`** plays the buy row's
  light pattern at pointer-down on a `[data-feel="press"]` button, once per press, not once per repeat. `Button`
  marks every `repeat` button that way. LAY EGG is `data-feel="lay"` instead: each lay's `egg_clicked` already
  plays the light tick. The haptics service still checks the haptics setting at every play.
- **Floats** (`src/ui/primitives/floats.tsx`): `createFloatGate` lets at most `feelBalance.floatMaxPerSec` floats
  through in any closed `floatWindowMs` window. What comes faster is held back and added to the next `+N`, and a
  timer lets it float when the window allows, so the floats add up to what was gained. `useFloats` and `<Floats>`
  draw them (`[data-float]`). LAY EGG uses them with its legacy `.click-particle` look. `Button` takes
  `gain={{ unit }}` and floats `+N UNIT` after each accepted press. The building, Click Power, recruit and train
  buttons use it. Reduced motion: no floating `+N` on buy buttons. LAY EGG's particle stays and does not move,
  as before.
- **`TypeIn`** (`src/ui/primitives/TypeIn.tsx`): the whole text is in the DOM from the first frame, so a focused
  headline is read in full. Only the drawing is revealed, by a CSS `clip-path` in `steps()` of one character
  (`--type-in-chars`), over `min(chars × typeInCharMs, typeInMaxMs)`. Under reduced motion there is no animation.
  The battle summary and decision sheet headlines and the `+N` of a float use it. The phase reveal keeps its own
  JS typing (Story 1.20).
- **Nest scene arrivals** (ADR 0045's dumb view): a creature that first draws after the scene's first draw is
  wrapped in `[data-arrive=egg|larva|worker]`, fixed at its mount. It fades in once over `feelBalance.arriveMs`, and
  a worker walks in from the tunnel side. What is there when the scene opens doesn't arrive. The animation is CSS on
  the wrapper, so it adds no render per frame, and the scene clock still writes each ant's own `transform`
  (ADR 0047). Only drawn creatures arrive: the dot cloud and the 50-ant budget are unchanged.
- **Camera pull-back hook:** `NestScene` takes `zoom` (1 = close) and sets `[data-camera=close|pulled-back]`,
  `--scene-zoom` and `--camera-ms` (`feelBalance.cameraPullBackMs`). Both drawings (the scene and the ants layer) ease to the zoom, with no easing
  under reduced motion. Story 8.7 owns the camera: it computes the zoom and passes it down. No haptic, no sound.
- **Timings** are in `src/data/balance/feel.ts` (`…Ms`, `…PerSec`) and reach CSS as custom properties.

## Consequences

- A new moment adds a row to `GAME_FEEL`, and its visual hook must exist before the test passes. A new sound still
  goes in `SOUND_EVENTS`, and the table test makes the two agree.
- The flash rule holds: each float, arrival and typed headline changes luminance once. `tests/e2e/game-feel.spec.ts`
  holds LAY EGG for 2.6 s and checks both limits: at most 8 floats in any second (with one frame of render jitter)
  and at most 3 luminance changes of the button.
- The Transcendence ending's row ("one long" haptic) is left to the ending's story. `HapticPattern` has no long
  pattern yet.
- Story 8.7 passes `zoom` to `NestScene`. The chamber labels are HTML over the SVG and don't scale with it, so 8.7
  decides how the labels follow the camera.
