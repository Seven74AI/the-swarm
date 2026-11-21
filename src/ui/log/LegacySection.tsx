import type { ComponentChildren } from 'preact';
import { selectLegacyUnlocked } from '../../state/selectors';
import './log.css';

/**
 * LOG → LEGACY (Story 1.26, UX-DR31): hosts the prestige card
 * (`#prestige-panel`, prestige behind HoldToConfirm) and the Legacy tree
 * (Preact since Story 1.36, `ui/log/Prestige.tsx`). Hidden until the GDD's
 * prestige unlock condition is met, then kept for the runs after
 * (`selectLegacyUnlocked`). Hook: `[data-log-section="legacy"]`.
 */
export function LegacySection({ children }: { children?: ComponentChildren }) {
  return (
    <section
      class="log-section log-legacy"
      data-log-section="legacy"
      aria-labelledby="log-legacy-heading"
      hidden={!selectLegacyUnlocked.value}
    >
      <h2 class="log-heading" id="log-legacy-heading">
        LEGACY
      </h2>
      <div data-legacy-panels="">{children}</div>
    </section>
  );
}
