# 0047. The nest's dot cloud and the scene clock

- **Status:** accepted (2026-11-22)
- **Source:** Story 8.6 (#314) · AR14, NFR2 · architecture D11 and N1 · builds on ADR 0045

## Context

Story 8.5 capped the creatures drawn one by one and dropped the rest from the drawing. A colony of thousands
must still read as crowded, stay smooth on a cheap phone, and keep at most 50 individually animated ants (AR14).

## Decision

- **Cloud by coverage, not by count:** `nestLayout` splits each chamber. While its creatures, all drawn, cover no
  more than `sceneBalance.cloudCoverage` of the chamber's ellipse (areas from the drawn shapes: `ANT_AREA`,
  `BROOD_AREA`), every one is drawn. Past it, the worker chamber keeps as many ants as fit under the threshold,
  clamped to `cloudAntsMin`..`animatedAntsMax`; the brood keeps eggs and larvae in proportion so they just fit.
  The rest is `cloud.count`, drawn as **one `<path>` per chamber** of square dots (1–1.5 viewBox units, about a
  pixel at 1×), each placed by a keyed stream `(chamber kind, i)`, so a growing cloud keeps its dots.
- **Dot cap:** a cloud draws at most `sceneBalance.cloudDotsMax` dots; past that it is as dense as it gets. The
  exact numbers stay in the HTML labels, so the cap hides nothing.
- **Varying opacity in one path:** the cloud is filled with a radial gradient on the phase accent (stops styled
  in `scenes.css`), denser at the chamber's heart and fading to its walls; the dot sizes vary too.
- **Scene clock:** `createSceneClock(env)` runs one rAF loop for every listener, and only while someone
  listens, the page is visible and reduced motion is off (`<html data-reduced-motion>`, or the OS preference where
  main has not bound it). Visual time stands still while stopped and moves at most 100 ms a frame. `useSceneClock`
  subscribes a component; the shared clock is `sceneClock()`.
- **No re-render per frame:** `antPose(ant, tunnels, t)` is pure (chamber ants sway along their heading, every
  `tunnelWalkerEvery`-th ant walks a tunnel and back). Each frame sets the ants' `transform` attributes directly;
  a render (at most 4 Hz, on a view change) draws them at `clock.now()`.
- **Own layer for the ants:** the ants are a second, overlaid SVG with `will-change: transform`, so a frame
  repaints them alone, not the soil pattern, tunnels and cloud. Measured before this split, the whole SVG
  repainted every frame and the in-game frame time roughly doubled.
- **Measurement:** `pnpm perf` (`tests/perf/nestScene.perf.ts`, not CI) builds the game and a harness page with
  the scene alone (`tests/perf/harness/nest.html`), throttles Chromium's CPU through CDP
  (`Emulation.setCPUThrottlingRate`, default 4×) at a Pixel 7 viewport, and reports p50/p95/max frame time
  (rAF start to the task after rendering). The scene's p95 is asserted against 16 ms there.
- **SVG stays:** measured in the cloud build box (desktop Chromium, 4× and 6× throttling) the scene alone stays
  well under 16 ms p95 with 5 000 workers, so the Canvas 2D fallback is not taken. If `pnpm perf` on the reference
  phone ever reports more, the dot cloud moves to Canvas 2D (AR14).

## Consequences

- Story 8.7's camera steps change `ANT_SCALE`, which changes `ANT_AREA` and so where the cloud starts: the rule
  follows what is drawn, with no count to retune.
- Starving (Story 8.7) thins the drawn ants through the view; the cloud rule is unchanged.
- The map and star map (Epic 6) can share `sceneClock()` for any motion of their own.
