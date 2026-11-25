# 0050. The nest's camera steps, wandering ants and a starving colony that thins

- **Status:** accepted (2026-11-22); the camera steps are superseded by Story 9.6 (2026-11-23), see the end. Wandering and the starving colony stand.
- **Source:** Story 8.7 (#315) · UX-DR34 (camera, wandering, starving) · builds on ADRs 0045, 0047 and 0049

## Context

The nest scene (Stories 8.5, 8.6) drew the whole cross-section at one scale, its ants swayed in place, and it did
not know whether the colony starved. UX-DR34 asks for a camera at 2× for a young colony, 1.5× from about 50 workers
and 1× from about 150, easing over 1 s (instant under reduced motion), a drawn worker never under 12 px, ants that
wander gently, and a starving colony that visibly thins while the labels keep the exact count. Story 8.9 (ADR 0049)
had already given `NestScene` a `zoom` prop (1 = close) eased in CSS, and arrival markers for new creatures.

## Decision

- **One camera, Story 8.9's.** `NestSceneArea` picks the step (`cameraStep(workers, previous)`,
  `ui/scenes/nestCamera.ts`, thresholds and zooms in `sceneBalance.cameraSteps`) and passes it as `zoom`
  (`cameraZoom(step)` = step zoom / `CAMERA_CLOSE`, so 2× → 1, 1.5× → 0.75, 1× → 0.5). The scene scales both SVG
  layers by `zoom × CAMERA_CLOSE` about a fixed point, `layout.cameraOrigin`, inside a clipped frame
  (`.nest-camera`); CSS eases it over `feelBalance.cameraPullBackMs` and drops the transition under reduced motion.
  The fixed point is chosen so the 2× frame holds the queen, the whole brood chamber and the workers' door.
- **No pumping at a threshold.** Once pulled back, the camera comes back in only below `cameraZoomInShare` of the
  threshold it passed, so a starving colony hovering at 150 workers keeps its framing.
- **Labels follow the camera.** `chamberAnchor(chamber, layout, cameraRect(...))` places each chamber label through
  the camera, clamped to the stage, so a chamber outside the frame still shows its exact counts at the edge. The
  labels ease with the same duration and curve as the drawing; a screen position under a scale is linear in the
  scale, so an unclamped label stays on its chamber all the way.
- **12 px.** `ANT_SCALE` goes from 1.4 to 1.5 (`ANT_LENGTH` = 15.3 units), and the stage never gets narrower than
  `MIN_STAGE_PX` (283 px), where a worker at 1× is still `antMinPx` long. Measured in e2e on 320 × 568 and
  320 × 400 viewports through `getScreenCTM()`. The bigger ant also moves where the cloud starts (ADR 0047: the
  rule follows what is drawn).
- **The young colony gathers by the door.** Worker `i` sits on the line from `DOOR` to its own point, nearer the
  door for low `i` (`doorFillAnts`), so the first workers are in the close frame. Still keyed by index alone, so
  no ant moves when another arrives.
- **Wandering replaces swaying.** A chamber ant walks a slow closed loop (two sines out of step, `wanderReach`,
  about `wanderMs` a lap, each ant at its own pace) round where it rests, facing the way it goes; still a pure
  `antPose(ant, tunnels, t)` on the scene clock, so reduced motion holds it still.
- **Hatch and walk-in reuse Story 8.9's arrivals.** A new worker gets 8.9's walk-in. A larva that arrives also
  leaves an egg shell beside it (`[data-scene-part="hatch-shell"]`) that fades out over `feelBalance.arriveMs`, so
  the egg visibly becomes the larva; the shell is hidden under reduced motion. No second clock-driven mechanism.
- **Starving comes in through the view.** `NestView.starving` is `selectStarving` (the same `isStarving` rule as
  training and the announcer), so `ui/scenes/` still reads no state. `nestLayout` then draws `starvingShown` of the
  individual workers (at least one) and of the cloud's dots; the left-out ants are `layout.thinned`, so every
  worker is still drawn, in the cloud's count, or thinned. Thinning is state, not motion: it shows under reduced
  motion too. `[data-starving]` marks the scene.
- **Pull-back hook.** `NestSceneArea` calls `cameraPulledBack({ from, to })` (zooms in the prop's terms) once per
  step back, never on mount or when the camera moves in; anything in the UI can listen with
  `onCameraPullBack(listener)` (`ui/nest/cameraPullBack.ts`). A UI event only: not state, not the EventBus. The
  game-feel table's camera row has no haptic or sound, so nothing listens yet.

## Consequences

- The camera eases in CSS, not on the scene clock: a pull-back while the tab is hidden has finished when it shows.
- Scaling the ants layer, which has `will-change: transform`, can leave Chromium rastering it at the scale it had
  when the layer was made; ants may look soft after the camera moves in. If that shows on devices, drop
  `will-change` while the camera eases or re-create the layer after a step.
- The map and star map (Epic 6) can reuse `cameraRect` / `chamberAnchor` for labels over a scaled drawing.

## Superseded: framing to the rooms dug (Story 9.6)

The camera steps (`sceneBalance.cameraSteps`, `nestCamera.ts`, the 2× crop) hid the workers chamber on phones and
are gone, with what served only them: `ui/nest/cameraPullBack.ts`, the `camera-pull-back` feel trigger and
`feelBalance.cameraPullBackMs`. `nestLayout` draws the founding brood and workers chambers plus one small room per
room dug (`view.roomsDug`, from `state.dig`): six under the brood, then rows of eight below the nest, each on a tunnel
to the nest above, at fixed slots so a room never moves. The layout's `width` × `height` is the frame that holds every
room and the next dig face (`digFace`, where the crack grows); the scene uses it as the viewBox and the stage takes its
aspect, so nothing is ever cropped. The frame is always `SCENE_WIDTH` wide, so `MIN_STAGE_PX` keeps a drawn worker at
`antMinPx` or more from a 320 px phone. A room that opens after the first draw arrives (`[data-arrive="room"]`): its
wall fades in and a few crumbs fall over `feelBalance.roomOpenMs`, nothing under reduced motion. The feel table's row
is `room-open` (Story 9.8 adds its sound and haptic). The dot cloud and the 50-ant budget are unchanged.
