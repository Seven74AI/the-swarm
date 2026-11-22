// Installs the signals integration: a component that reads `selectX.value` re-renders when that
// slice changes, and only then (ADR 0004). Keep this import in the root of the Preact tree.
import '@preact/signals';
import type { ReadonlySignal } from '@preact/signals-core';
import { Shell, type ShellViews } from './shell/Shell';
import { PanelRevealContext, type PanelReveal } from './shell/panelReveal';
import type { TabShell } from './shell/tabShell';
import type { SheetController } from './shell/SheetController';
import { SheetHost } from './shell/SheetHost';
import type { OverlayController } from './shell/OverlayController';
import { OverlayHost } from './shell/OverlayHost';
import { ToastHost, type Toasts } from './primitives/Toast';
import { useEffect, useMemo } from 'preact/hooks';
import { appGridCols } from './primitives/charGrid';
import { createCharGrid } from './shell/charGrid';
import { LiveRegion } from './shell/LiveRegion';
import type { Announcer } from './shell/announcer';
import { CoachHost, type Coach } from './shell/CoachHost';
import type { CoachMarkMemory } from './primitives/CoachMark';

export type { ShellViews } from './shell/Shell';

/**
 * Root of the Preact UI (Story 1.7, ADR 0004).
 *
 * It renders the tab shell (Story 1.15): strip, tabs, primary zone and tab
 * bar, with `views` in them (Story 1.36: every panel is a Preact view; UIRoot
 * is gone). `panels` says which panels the session has revealed: a panel is
 * absent until its phase reveals it.
 *
 * `sheets` is the one SheetController (Story 1.14): its open sheet is drawn
 * after the shell, so sheets sit above the panels.
 *
 * `overlays` is the overlay layer (Story 1.20): the playing overlay is drawn last,
 * above everything, and no sheet is drawn while it is up.
 *
 * `coach` draws the one coach mark main asks for (Story 8.10: LAY EGG, once the
 * queen wakes from the title cinematic), above the shell and below sheets.
 *
 * The character grid (Story 1.31): the shell measures its columns, and every
 * Preact root (sheets and tab hosts included) reads them through `appGridCols`.
 */
export function App({
  views,
  panels,
  shell,
  sheets,
  onContinue,
  overlays,
  toasts,
  tabKeys,
  announcer,
  coach,
}: {
  views?: ShellViews;
  /** Which panels the session has revealed (main reveals them on boot and on each phase commit). */
  panels?: PanelReveal;
  shell: TabShell;
  sheets?: SheetController;
  /** CONTINUE on NEST (Story 1.19): `actions.continuePhase`. */
  onContinue?: () => { readonly ok: boolean } | void;
  overlays?: OverlayController;
  /** One-line toasts, drawn above the primary zone (Story 1.28 first uses them). */
  toasts?: Toasts;
  /** The rail's key hints on desktop (Story 1.29). */
  tabKeys?: ReadonlySignal<readonly string[]>;
  /** The polite live region's lines (Story 1.32). */
  announcer?: Announcer;
  /** The coach mark host and where "seen" is remembered (settings, Story 1.12). */
  coach?: { readonly coach: Coach; readonly memory: CoachMarkMemory };
}) {
  const grid = useMemo(() => createCharGrid({ root: document.documentElement, cols: appGridCols }), []);
  useEffect(() => () => grid.dispose(), [grid]);
  return (
    <PanelRevealContext.Provider value={panels ?? null}>
      <Shell shell={shell} views={views} onContinue={onContinue} tabKeys={tabKeys} grid={grid} />
      {toasts && <ToastHost toasts={toasts} />}
      {announcer && <LiveRegion announcer={announcer} />}
      {coach && <CoachHost coach={coach.coach} memory={coach.memory} />}
      {sheets && <SheetHost sheets={sheets} held={overlays?.held} />}
      {overlays && <OverlayHost overlays={overlays} />}
    </PanelRevealContext.Provider>
  );
}
