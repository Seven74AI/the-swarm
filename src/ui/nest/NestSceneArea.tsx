import { Phase } from '../../phases/phases';
import { selectNestView, selectPhase } from '../../state/selectors';
import { sceneBalance } from '../../data/balance/scene';
import { useThrottledSignal } from '../primitives/throttledSignal';
import { NestScene } from '../scenes/NestScene';
import type { SheetController } from '../shell/SheetController';
import { openChamberPeek } from '../sheets/ChamberPeekSheet';
import { LayEggButton } from './LayEggButton';
import { AutomationRow, type AutomationRowActions } from '../shell/AutomationRow';

/**
 * NEST's scene area (Story 1.22): the nest scene (Story 8.5), in NEST's
 * order between the phase line and goal meter and the event lines.
 *
 * It feeds the scene `selectNestView` at most 4 times a second
 * (`sceneBalance.viewRefreshMs`, AR14) and opens a chamber's peek sheet when
 * the scene asks. The scene itself only draws.
 *
 * After Phase 1 the primary action follows the next-action rule, but the
 * queen still lays eggs on a tap (FR1), and nothing else lays them before
 * automation, so the area holds a secondary LAY EGG (keeping `#click-egg`)
 * under the scene. Under it, once laying can be automated (Story 4.10), the
 * brood's automation target row: `KEEP [−] N [+] IN THE BROOD [AUTO]`.
 *
 * Hooks: `[data-nest-scene]` (the area), `[data-scene="nest"]` (the scene).
 */
export function NestSceneArea({
  lay,
  automation,
  sheets,
}: {
  lay: () => { readonly ok: boolean };
  automation?: AutomationRowActions;
  sheets: SheetController;
}) {
  const view = useThrottledSignal(selectNestView, sceneBalance.viewRefreshMs);
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  return (
    <div class="nest-scene" data-nest-scene="">
      <NestScene view={view.value} onChamber={(id) => openChamberPeek(sheets, id)} />
      {!phase1 && (
        <div class="nest-scene__queen">
          <LayEggButton variant="secondary" lay={lay} />
        </div>
      )}
      {automation && <AutomationRow verb="lay" actions={automation} />}
    </div>
  );
}
