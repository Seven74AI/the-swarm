import { render } from 'preact';
import type { ReadonlySignal } from '@preact/signals';
import type { GameState } from '../state/GameState';
import { log } from '../utils/log';
import { DebugOverlay } from './DebugOverlay';
import { createFpsMeter, type TickTimings } from './timings';
import { bindDebugToggle } from './toggle';

/**
 * Mount the debug overlay (Story 1.34, AR24). main loads this module only in
 * a dev build or with `?debug=1` (a separate chunk). It adds one empty
 * `[data-debug-root]` to the body, binds the backtick key and the 3-finger
 * long-press, and draws the overlay while it is open; FPS is measured only
 * then.
 */
export interface DebugOverlayDeps {
  readonly state: ReadonlySignal<GameState>;
  readonly ticks: TickTimings;
  readonly catchUpMs: number | null;
  readonly saveVersion: number;
  readonly build: string;
  readonly onExportDiagnostics: () => void;
}

export interface DebugOverlayHandle {
  toggle(): void;
  isOpen(): boolean;
  unmount(): void;
}

export function mountDebugOverlay(deps: DebugOverlayDeps): DebugOverlayHandle {
  const root = document.createElement('div');
  root.setAttribute('data-debug-root', '');
  document.body.append(root);

  let open = false;
  let raf = 0;
  let fps: number | null = null;
  const measure = (): void => {
    const meter = createFpsMeter();
    fps = null;
    const frame = (t: number): void => {
      fps = meter.frame(t) ?? fps;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  const draw = (): void => {
    if (!open) {
      render(null, root);
      return;
    }
    render(
      <DebugOverlay
        state={deps.state}
        ticks={deps.ticks}
        catchUpMs={deps.catchUpMs}
        saveVersion={deps.saveVersion}
        build={deps.build}
        fps={() => fps}
        log={() => log.entries()}
        onExportDiagnostics={deps.onExportDiagnostics}
        onClose={() => toggle()}
      />,
      root,
    );
  };

  const toggle = (): void => {
    open = !open;
    root.toggleAttribute('data-open', open);
    if (open) measure();
    else cancelAnimationFrame(raf);
    draw();
  };

  const unbind = bindDebugToggle(window, toggle);
  root.setAttribute('data-ready', '');
  log.info('debug', 'debug overlay ready: backtick or a 3-finger long-press');
  return {
    toggle,
    isOpen: () => open,
    unmount: () => {
      unbind();
      cancelAnimationFrame(raf);
      render(null, root);
      root.remove();
    },
  };
}
