import { useMemo } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals';
import type { SheetController, SheetEntry } from './SheetController';
import { SheetContext, type SheetContextValue } from './Sheet';

/**
 * Draws the open sheet of the `SheetController` (Story 1.14, D7), and only that
 * one: modal sheets never stack. Each sheet gets a fresh subtree (keyed by id), so
 * its timers and focus handling start when it actually opens, not while it waits.
 *
 * While `held` is true (an overlay is up, Story 1.20) no sheet is drawn: the open
 * one and any requested meanwhile wait until the overlay ends.
 */
export function SheetHost({ sheets, held }: { sheets: SheetController; held?: ReadonlySignal<boolean> }) {
  const open = sheets.state.value.open;
  if (held?.value) return null;
  if (!open) return null;
  return <OpenSheet key={open.id} entry={open} sheets={sheets} />;
}

function OpenSheet({ entry, sheets }: { entry: SheetEntry; sheets: SheetController }) {
  const ctx = useMemo<SheetContextValue>(
    () => ({ close: () => sheets.close(entry.id), trigger: entry.trigger }),
    [entry, sheets],
  );
  return <SheetContext.Provider value={ctx}>{entry.render(ctx.close)}</SheetContext.Provider>;
}
