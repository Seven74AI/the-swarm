import { selectNestView } from '../../state/selectors';
import { formatFull } from '../../utils/format';
import { Sep } from '../primitives/Deco';
import { AutomationRow, type AutomationRowActions } from '../shell/AutomationRow';

const count = (n: number, one: string, many: string): string => `${formatFull(n)} ${n === 1 ? one : many}`;

/**
 * The brood control (Story 9.7, UX-DR48; DESIGN.md "Brood control"): NEST's
 * one line from Colony on, `BROOD 4 EGGS · 2 LARVAE` then the laying target
 * `KEEP [−] 10 [+] [AUTO]` (the compact automation row). The brood in the
 * scene is the FEED button (Story 9.4); this line carries its counts.
 *
 * Hook: `[data-brood-feed]` (the line), `[data-brood-counts]`.
 */
export function BroodLine({ automation }: { automation?: AutomationRowActions }) {
  const v = selectNestView.value;
  return (
    <div class="brood-line" data-brood-feed="">
      <span class="brood-line__counts" data-brood-counts="">
        BROOD
        <Sep />
        {count(v.eggs, 'EGG', 'EGGS')}
        <Sep />
        {count(v.larvae, 'LARVA', 'LARVAE')}
      </span>
      {automation && <AutomationRow verb="lay" actions={automation} compact />}
    </div>
  );
}
