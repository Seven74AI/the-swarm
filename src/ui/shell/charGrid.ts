/**
 * Measuring the character grid (Story 1.31, UX-DR4; the rules are in
 * `ui/primitives/charGrid.ts`).
 *
 * `createCharGrid({root, measure})` keeps `cols` = whole body-font columns in
 * the content column, and mirrors it on `root` as `data-grid="full|medium|narrow"`
 * and `--grid-cols`, which `reflow.css` keys off. `attach(shell)` measures the
 * shell: the narrowest visible tab column (on desktop each column follows the
 * same rule, so the narrowest decides), against the advance of the body font.
 * It remeasures when the shell or the text size changes (a probe of ten
 * zeros is watched, so a text-size change counts even if the window doesn't).
 */
import { signal, computed, type ReadonlySignal, type Signal } from '@preact/signals-core';
import { gridClass, gridColumns, type GridClass } from '../primitives/charGrid';

export interface GridMeasure {
  /** Content width in CSS px (inside padding). */
  readonly width: number;
  /** Advance width of one character of the body font, in CSS px. */
  readonly advance: number;
}

export interface CharGrid {
  readonly cols: ReadonlySignal<number>;
  readonly grid: ReadonlySignal<GridClass>;
  /** Measure again now. */
  refresh(): void;
  /** Measure this shell from now on; returns the detach. */
  attach(shell: HTMLElement): () => void;
  dispose(): void;
}

export interface CharGridOptions {
  /** Where `data-grid` and `--grid-cols` go (the document root in the app). */
  readonly root: HTMLElement;
  /** A fixed measurement (tests); by default the attached shell is measured. */
  readonly measure?: () => GridMeasure;
  /** The signal to keep the count in (the App passes `appGridCols`); a new one by default. */
  readonly cols?: Signal<number>;
}

const PROBE_CHARS = 10;

function contentWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
}

/** The narrowest visible tab column of the shell, or the shell itself. */
function measureShell(shell: HTMLElement, probe: HTMLElement | null): GridMeasure {
  const columns = [...shell.querySelectorAll<HTMLElement>('[data-tab-panel]')].filter((el) => !el.hidden && el.clientWidth > 0);
  const widths = columns.map(contentWidth);
  const scroller = shell.querySelector<HTMLElement>('[data-shell-scroll]');
  if (scroller && getComputedStyle(scroller).display !== 'contents') {
    // The single column: the scroll area's padding is the page margin.
    widths.push(contentWidth(scroller));
  }
  const width = widths.length > 0 ? Math.min(...widths) : contentWidth(shell);
  const advance = probe ? probe.getBoundingClientRect().width / PROBE_CHARS : 0;
  return { width, advance };
}

export function createCharGrid({ root, measure, cols = signal(Infinity) }: CharGridOptions): CharGrid {
  const grid = computed(() => gridClass(cols.value));
  let shell: HTMLElement | null = null;
  let probe: HTMLElement | null = null;

  const write = () => {
    root.setAttribute('data-grid', grid.value);
    if (Number.isFinite(cols.value)) root.style.setProperty('--grid-cols', String(cols.value));
    else root.style.removeProperty('--grid-cols');
  };

  const refresh = () => {
    const m = measure ? measure() : shell ? measureShell(shell, probe) : { width: 0, advance: 0 };
    cols.value = gridColumns(m.width, m.advance);
    write();
  };

  const attach = (el: HTMLElement): (() => void) => {
    shell = el;
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-grid-probe', '');
    probe.textContent = '0'.repeat(PROBE_CHARS);
    Object.assign(probe.style, {
      position: 'absolute',
      visibility: 'hidden',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      left: '0',
      top: '0',
      fontFamily: 'inherit',
    });
    // Inside the scroll area, so it carries the body font the panels use.
    (el.querySelector('[data-shell-scroll]') ?? el).appendChild(probe);
    // Remeasure on the next frame: writing data-grid changes the layout the observer watches.
    let frame = 0;
    const onResize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        refresh();
      });
    };
    window.addEventListener('resize', onResize);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
    observer?.observe(el);
    observer?.observe(probe);
    for (const col of el.querySelectorAll('[data-tab-panel]')) observer?.observe(col);
    void document.fonts?.ready.then(onResize, () => {});
    refresh();
    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      probe?.remove();
      probe = null;
      shell = null;
    };
  };

  refresh();
  return {
    cols,
    grid,
    refresh,
    attach,
    dispose() {
      root.removeAttribute('data-grid');
      root.style.removeProperty('--grid-cols');
    },
  };
}
