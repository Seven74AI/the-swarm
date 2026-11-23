import { Phase } from '../../phases/phases';
import { selectFeed, selectNestView, selectNextRoom, selectPhase } from '../../state/selectors';
import { sceneBalance } from '../../data/balance/scene';
import { useThrottledSignal } from '../primitives/throttledSignal';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { NestScene } from '../scenes/NestScene';
import { cameraStep, cameraZoom } from '../scenes/nestCamera';
import type { SheetController } from '../shell/SheetController';
import { openChamberPeek } from '../sheets/ChamberPeekSheet';
import { LayEggButton } from './LayEggButton';
import { cameraPulledBack } from './cameraPullBack';
import { AutomationRow, type AutomationRowActions } from '../shell/AutomationRow';
import { crackStage } from '../scenes/nestLayout';
import { NextRoomStrip } from './NextRoomStrip';

/**
 * NEST's scene area (Story 1.22): the nest scene (Story 8.5), in NEST's
 * order between the phase line and goal meter and the event lines.
 *
 * It feeds the scene `selectNestView` at most 4 times a second
 * (`sceneBalance.viewRefreshMs`, AR14) and opens a chamber's peek sheet when
 * the scene asks. The scene itself only draws. It picks the camera step from
 * the colony's size (Story 8.7, `cameraStep`, with the last step held so it
 * never pumps at a threshold), hands it to the scene as `zoom`, and sends
 * each pull-back out through `onCameraPullBack` (`./cameraPullBack`).
 *
 * After Phase 1 the primary action follows the next-action rule, but the
 * queen still lays eggs on a tap (FR1), and nothing else lays them before
 * automation, so the area holds a secondary LAY EGG (keeping `#click-egg`)
 * under the scene. Under it, once laying can be automated (Story 4.10), the
 * brood's automation target row: `KEEP [−] N [+] IN THE BROOD [AUTO]`.
 *
 * From Colony on the NEXT ROOM strip sits under the scene (Story 9.3), and the
 * scene's dig-face crack follows the same `selectNextRoom`. From Colony on a tap
 * on the brood FEEDs it (Story 9.4, `selectFeed`) instead of opening its peek;
 * the workers chamber keeps its peek, and Phase 1 keeps the brood's.
 *
 * Hooks: `[data-nest-scene]` (the area), `[data-scene="nest"]` (the scene).
 */
export function NestSceneArea({
  lay,
  feed,
  automation,
  sheets,
}: {
  lay: () => { readonly ok: boolean };
  /** FEED (Story 9.4): `actions.feed`. From Colony on the brood button calls it instead of opening its peek. */
  feed?: () => { readonly ok: boolean };
  automation?: AutomationRowActions;
  sheets: SheetController;
}) {
  const feedState = feed ? selectFeed.value : null;
  const view = useThrottledSignal(selectNestView, sceneBalance.viewRefreshMs);
  const room = useThrottledSignal(selectNextRoom, sceneBalance.viewRefreshMs).value;
  const zoom = useCameraZoom(view.value.workers);
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  return (
    <div class="nest-scene" data-nest-scene="">
      <NestScene
        view={view.value}
        onChamber={(id) => (id === 'brood' && feed && feedState ? feed() : openChamberPeek(sheets, id))}
        zoom={zoom}
        crack={room ? crackStage(room.percent) : 0}
        feed={feedState}
      />
      <NextRoomStrip />
      {!phase1 && (
        <div class="nest-scene__queen">
          <LayEggButton variant="secondary" lay={lay} />
        </div>
      )}
      {automation && <AutomationRow verb="lay" actions={automation} />}
    </div>
  );
}

/** The camera's zoom for the scene (1 = close), following the colony; each step back is announced once. */
function useCameraZoom(workers: number): number {
  const last = useRef<number | null>(null);
  const moved = useMemo(() => {
    const from = last.current;
    const to = cameraStep(workers, from);
    last.current = to;
    return { from, to };
  }, [workers]);
  useEffect(() => {
    if (moved.from !== null && moved.to > moved.from) cameraPulledBack({ from: cameraZoom(moved.from), to: cameraZoom(moved.to) });
  }, [moved]);
  return cameraZoom(moved.to);
}
