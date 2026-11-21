import { useLayoutEffect, useRef } from 'preact/hooks';
import { selectLegacyUnlocked } from '../../state/selectors';
import './log.css';

/**
 * LOG → LEGACY (Story 1.26, UX-DR31): hosts the legacy PrestigePanel
 * (`#prestige-panel`, prestige behind HoldToConfirm) and PrestigeTreePanel.
 * Hidden until the GDD's prestige unlock condition is met, then kept for the
 * runs after (`selectLegacyUnlocked`). Hook: `[data-log-section="legacy"]`.
 */
export function LegacySection({ panels }: { panels: readonly HTMLElement[] }) {
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = body.current;
    if (!host) return;
    for (const p of panels) if (p.parentElement !== host) host.appendChild(p);
  }, [panels]);
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
      <div ref={body} data-legacy-panels="" />
    </section>
  );
}
