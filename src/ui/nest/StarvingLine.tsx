import { selectVerdict } from '../../state/selectors';
import { sceneBalance } from '../../data/balance/scene';
import { useThrottledSignal } from '../primitives/throttledSignal';
import './nest.css';

/**
 * NEST's starving line (Story 9.16, FR61): while the colony starves, the
 * resource sheet's verdict, `STARVING · AN ANT DIES EVERY <t>`, in warn,
 * under the NEXT ROOM strip. The polite live-region announcement comes from
 * `ui/shell/announcements.ts` on the same edge. Absent otherwise.
 *
 * Hook: `[data-starving-line]`.
 */
export function StarvingLine() {
  const { verdict, text } = useThrottledSignal(selectVerdict, sceneBalance.viewRefreshMs).value;
  if (verdict.kind !== 'starving') return null;
  return (
    <p class="starving-line" data-starving-line="" data-warn="">
      {text}
    </p>
  );
}
