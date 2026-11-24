import { Phase } from '../../phases/phases';
import { selectFeed, selectNestView, selectNextRoom, selectPhase } from '../../state/selectors';
import { sceneBalance } from '../../data/balance/scene';
import { useThrottledSignal } from '../primitives/throttledSignal';
import { NestScene } from '../scenes/NestScene';
import type { SheetController } from '../shell/SheetController';
import { openChamberPeek } from '../sheets/ChamberPeekSheet';
import { LayEggButton } from './LayEggButton';
import { AutomationRow, type AutomationRowActions } from '../shell/AutomationRow';
import { crackStage } from '../scenes/nestLayout';
import { NextRoomStrip } from './NextRoomStrip';
import { StarvingLine } from './StarvingLine';
import { BroodLine } from './BroodLine';
import { RoomJobsLine } from './RoomJobsLine';
import type { RoomJobActions } from '../sheets/RoomJobSheet';
import { digPulse } from './digPulse';

/**
 * NEST's scene area (Story 1.22): the nest scene (Story 8.5), in NEST's
 * order between the phase line and goal meter and the event lines.
 *
 * It feeds the scene `selectNestView` at most 4 times a second
 * (`sceneBalance.viewRefreshMs`, AR14) and opens a chamber's peek sheet when
 * the scene asks. The scene itself only draws; it frames the rooms dug
 * (Story 9.6, which replaced Story 8.7's camera steps).
 *
 * After Phase 1 the primary action follows the next-action rule, but the
 * queen still lays eggs on a tap (FR1), and nothing else lays them before
 * automation, so the area holds a secondary LAY EGG (keeping `#click-egg`)
 * under the scene. Under it, once laying can be automated (Story 4.10), the
 * brood's automation target row: `KEEP [−] N [+] IN THE BROOD [AUTO]`.
 *
 * From Colony on the NEXT ROOM strip sits under the scene (Story 9.3), the room
 * jobs line under the brood line once a room is dug (Story 9.14), and the
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
  roomJobs,
  sheets,
}: {
  lay: () => { readonly ok: boolean };
  /** FEED (Story 9.4): `actions.feed`. From Colony on the brood button calls it instead of opening its peek. */
  feed?: () => { readonly ok: boolean };
  automation?: AutomationRowActions;
  /** Room jobs (Story 9.14): `actions.setRoomJob`. From Colony on, NEST's room jobs line uses it. */
  roomJobs?: RoomJobActions;
  sheets: SheetController;
}) {
  const feedState = feed ? selectFeed.value : null;
  const view = useThrottledSignal(selectNestView, sceneBalance.viewRefreshMs);
  const room = useThrottledSignal(selectNextRoom, sceneBalance.viewRefreshMs).value;
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  return (
    <div class="nest-scene" data-nest-scene="">
      <NestScene
        view={view.value}
        onChamber={(id) => (id === 'brood' && feed && feedState ? feed() : openChamberPeek(sheets, id))}
        crack={room ? crackStage(room.percent) : 0}
        feed={feedState}
        pulse={phase1 ? 0 : digPulse.value}
        queen={phase1 ? undefined : <LayEggButton variant="secondary" lay={lay} />}
      />
      <NextRoomStrip />
      <StarvingLine />
      {phase1 ? automation && <AutomationRow verb="lay" actions={automation} /> : <BroodLine automation={automation} />}
      {!phase1 && roomJobs && <RoomJobsLine sheets={sheets} actions={roomJobs} />}
    </div>
  );
}
