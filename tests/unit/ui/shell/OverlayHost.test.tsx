import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createOverlayController } from '../../../../src/ui/shell/OverlayController';
import { createSheetController } from '../../../../src/ui/shell/SheetController';
import { OverlayHost } from '../../../../src/ui/shell/OverlayHost';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';

/**
 * Story 1.20 (AR10): the OverlayHost draws the playing overlay; while it is up the
 * SheetHost draws no sheet, so a sheet (a decision event) requested meanwhile
 * waits and only opens (starting its timers) once the overlay ends.
 */
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('OverlayHost', () => {
  it('draws the active overlay and holds sheets until it ends', () => {
    const overlays = createOverlayController();
    const sheets = createSheetController();
    render(
      <>
        <SheetHost sheets={sheets} held={overlays.held} />
        <OverlayHost overlays={overlays} />
      </>,
    );
    let end: () => void = () => {};
    act(() => {
      overlays.show({
        kind: 'phase-reveal',
        render: (done) => {
          end = done;
          return <div data-test-overlay="" />;
        },
      });
    });
    expect(document.querySelector('[data-test-overlay]')).not.toBeNull();

    act(() => {
      sheets.open({ priority: 'decision', render: () => <div data-test-sheet="" /> });
    });
    expect(document.querySelector('[data-test-sheet]')).toBeNull();

    act(() => end());
    expect(document.querySelector('[data-test-overlay]')).toBeNull();
    expect(document.querySelector('[data-test-sheet]')).not.toBeNull();
  });
});
