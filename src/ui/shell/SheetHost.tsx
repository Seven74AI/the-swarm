import { useMemo } from 'preact/hooks';
import type { SheetController, SheetEntry } from './SheetController';
import { SheetContext, type SheetContextValue } from './Sheet';

/**
 * Draws the open sheet of the `SheetController` (Story 1.14, D7), and only that
 * one: modal sheets never stack. Each sheet gets a fresh subtree (keyed by id), so
 * its timers and focus handling start when it actually opens, not while it waits.
 */
export function SheetHost({ sheets }: { sheets: SheetController }) {
  const open = sheets.state.value.open;
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
