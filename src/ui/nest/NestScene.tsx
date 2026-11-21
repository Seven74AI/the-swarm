import { Phase } from '../../phases/phases';
import { selectPhase } from '../../state/selectors';
import { LayEggButton } from './LayEggButton';
import { AutomationRow, type AutomationRowActions } from '../shell/AutomationRow';

/**
 * NEST's scene area (Story 1.22), a placeholder until Story 8.5 draws the
 * nest. It keeps the scene's place in NEST's order: phase line and goal
 * meter, scene, event lines.
 *
 * After Phase 1 the primary action follows the next-action rule, but the
 * queen still lays eggs on a tap (FR1), and nothing else lays them before
 * automation. Until Story 8.5 makes the drawn queen tappable, the placeholder
 * holds a secondary LAY EGG (keeping `#click-egg`), so eggs stay producible.
 *
 * Under the queen, once laying can be automated (Story 4.10), the brood's
 * automation target row: `KEEP [−] N [+] IN THE BROOD [AUTO]`.
 *
 * Hooks: `[data-nest-scene="placeholder"]`.
 */
export function NestScene({ lay, automation }: { lay: () => { readonly ok: boolean }; automation?: AutomationRowActions }) {
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  return (
    <div class="nest-scene" data-nest-scene="placeholder" role="group" aria-label="Nest">
      <p class="nest-scene__caption">THE BROOD CHAMBER</p>
      {!phase1 && (
        <div class="nest-scene__queen">
          <LayEggButton variant="secondary" lay={lay} />
        </div>
      )}
      {automation && <AutomationRow verb="lay" actions={automation} />}
    </div>
  );
}
