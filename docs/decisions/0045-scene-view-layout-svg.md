# 0045. Scenes are views: a throttled view, a pure layout, a dumb SVG

- **Status:** accepted (2026-11-22)
- **Source:** Story 8.5 (#313) · FR44, AR14, UX-DR34 · architecture D11 and N1 (countable-ant nest scene)

## Context

NEST's scene area was a placeholder (Story 1.22). The nest scene draws the colony as countable creatures, and the
map and star map (Epic 6) are to follow the same pattern. A scene that read `gameState` would redraw 20 times a
second and could become a second source of truth for numbers.

## Decision

- **View:** `selectNestView` (`state/selectors.ts`, type and derivation in `state/nestView.ts`) holds whole counts
  (workers, eggs, larvae, floored). It keeps its reference while no count changes, so a tick that only moves food
  notifies nobody.
- **4 Hz:** `throttleSignal` / `useThrottledSignal` (`ui/primitives/throttledSignal.ts`) follow a signal at most once
  per `sceneBalance.viewRefreshMs` (`data/balance/scene.ts`, 250 ms). A change after a quiet period shows at once,
  and the latest change always arrives when the period ends.
- **Layout:** `nestLayout(view)` (`ui/scenes/nestLayout.ts`) is pure and deterministic. Each placement comes from a
  keyed stream (`utils/rng.ts` `keyedStream`) keyed by what it places (a chamber id, a creature kind and index), so
  creature `i` keeps its place when another arrives. The number of creatures drawn one by one is capped by
  `sceneBalance.drawn*Max`.
- **SVG:** `NestScene` (`ui/scenes/`) gets `view` and `onChamber` as props. The drawing is `aria-hidden` and colored
  only by CSS classes on the phase's `--color-*` tokens (`ui/scenes/scenes.css`), with no paint attributes. The
  numbers are HTML: the root is a group labelled with its counts, and each chamber's label is a button
  (44 px target, anchored at the chamber and shifted by the same share of its own size so it never leaves the scene).
- **Container:** `ui/nest/NestSceneArea` reads the throttled view, renders the scene, keeps the secondary LAY EGG
  (`#click-egg`) and the brood's automation row, and opens `ChamberPeekSheet` (`ui/sheets/`) through the
  `SheetController` at `peek` priority.
- **Boundary:** `tests/arch/sceneBoundary.test.ts`: files in `ui/scenes/` never touch `gameState`, import no value
  from `state/`, `actions/`, `systems/`, `engine/`, `persistence/`, `platform/` or `phases/`, write no signal, use no
  storage and draw no `Math.random`.

## Consequences

- Story 8.6 (dot cloud, ≤ 50 animated ants) changes the caps into a cloud split inside `nestLayout`; Story 8.7
  (camera, wandering) adds the camera step to the view and a scene clock beside the layout. Neither changes the
  labels, which already come from the view.
- `MapGrid` and `StarMap` (Epic 6) follow the same split in `ui/scenes/`.
- The glow on the line-work is a CRT effect (Story 8.4, under `data-crt`), not part of the scene's CSS.
