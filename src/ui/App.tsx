// Installs the signals integration: a component that reads `selectX.value` re-renders when that
// slice changes, and only then (ADR 0004). Keep this import in the root of the Preact tree.
import '@preact/signals';
import { Shell, type LegacyUi } from './shell/Shell';
import type { TabShell } from './shell/tabShell';
import type { SheetController } from './shell/SheetController';
import { SheetHost } from './shell/SheetHost';

export type { LegacyUi } from './shell/Shell';

/**
 * Root of the Preact UI (Story 1.7, ADR 0004).
 *
 * It renders the tab shell (Story 1.15): strip, tabs, primary zone and tab
 * bar. The legacy `UIRoot` mounts its panels into the shell's host
 * containers once, synchronously inside `render()`, so boot can reveal the
 * phase's panels right after rendering. The hosts have no Preact children, so
 * re-renders never touch the legacy DOM.
 *
 * `sheets` is the one SheetController (Story 1.14): its open sheet is drawn
 * after the shell, so sheets sit above the panels.
 */
export function App({
  legacy,
  shell,
  sheets,
  onContinue,
}: {
  legacy: LegacyUi;
  shell: TabShell;
  sheets?: SheetController;
  /** CONTINUE on NEST (Story 1.19): `actions.continuePhase`. */
  onContinue?: () => { readonly ok: boolean } | void;
}) {
  return (
    <>
      <Shell shell={shell} legacy={legacy} onContinue={onContinue} />
      {sheets && <SheetHost sheets={sheets} />}
    </>
  );
}
