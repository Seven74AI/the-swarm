import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { createSheetController } from '../../../src/ui/shell/SheetController';
import { createOverlayController } from '../../../src/ui/shell/OverlayController';
import { App } from '../../../src/ui/App';
import { createPanelReveal } from '../../../src/ui/shell/panelReveal';
import { Panel } from '../../../src/ui/shell/Panel';
import { createTabShell } from '../../../src/ui/shell/tabShell';
import { Phase } from '../../../src/phases/phases';

/**
 * Story 1.7: the Preact root. Since Story 1.15 it draws the tab shell; since
 * Story 1.36 every panel is a Preact view the shell places (UIRoot is gone).
 */
const views = () => ({ strip: <div id="top-bar" />, tabs: { wrkr: <Panel id="worker_assignment" domId="worker-assignment" /> } });
const shell = () => createTabShell({ phase: signal(Phase.COLONY), affordable: signal('') });

describe('App (Preact root)', () => {
  afterEach(() => cleanup());

  it('draws the views synchronously, inside the Preact root', () => {
    const { container } = render(<App views={views()} shell={shell()} />);
    expect(container.querySelector('[data-shell-strip] #top-bar')).not.toBeNull();
  });

  it('shows a panel only once the session reveals it (Story 1.36)', () => {
    const panels = createPanelReveal();
    const { container } = render(<App views={views()} shell={shell()} panels={panels} />);
    expect(container.querySelector('#worker-assignment')).toBeNull();
    act(() => panels.reveal(['worker_assignment']));
    expect(container.querySelector('[data-tab-content="wrkr"] #worker-assignment')).not.toBeNull();
  });

  it('never wipes the views when it re-renders', () => {
    const s = shell();
    const v = views();
    const { container, rerender } = render(<App views={v} shell={s} />);
    const bar = container.querySelector('#top-bar');
    rerender(<App views={v} shell={s} />);
    expect(container.querySelector('#top-bar')).toBe(bar);
  });

  it('draws the open sheet of the SheetController next to the shell (Story 1.14)', () => {
    const sheets = createSheetController();
    const { container } = render(<App views={views()} shell={shell()} sheets={sheets} />);
    expect(container.querySelector('[data-probe]')).toBeNull();
    act(() => void sheets.open({ priority: 'modal', render: () => <p data-probe="" /> }));
    expect(container.querySelector('[data-probe]')).not.toBeNull();
    expect(container.querySelector('#top-bar')).not.toBeNull();
  });

  it('draws the overlay layer above the sheets, which wait while it is up (Story 1.20)', () => {
    const sheets = createSheetController();
    const overlays = createOverlayController();
    const { container } = render(<App views={views()} shell={shell()} sheets={sheets} overlays={overlays} />);
    let id = 0;
    act(() => {
      id = overlays.show({ kind: 'phase-reveal', render: () => <p data-overlay-probe="" /> });
    });
    act(() => void sheets.open({ priority: 'decision', render: () => <p data-probe="" /> }));
    expect(container.querySelector('[data-overlay-probe]')).not.toBeNull();
    expect(container.querySelector('[data-probe]')).toBeNull();
    act(() => overlays.end(id));
    expect(container.querySelector('[data-overlay-probe]')).toBeNull();
    expect(container.querySelector('[data-probe]')).not.toBeNull();
  });
});
