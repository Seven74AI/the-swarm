import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { DebugOverlay } from '../../../src/debug/DebugOverlay';
import { createTickTimings } from '../../../src/debug/timings';
import type { LogEntry } from '../../../src/utils/log';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';

/**
 * Story 1.34 (AR24): the overlay shows FPS, tick time p50/p95, catch-up time,
 * seed and save version, a read-only state inspector and a log viewer, and
 * offers EXPORT DIAGNOSTICS.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({ level: 'info', scope: 'save', message: 'loaded', detail: [], time: 1, ...over });

function setup(over: { entries?: LogEntry[]; catchUpMs?: number | null; state?: GameState } = {}) {
  const state = signal(over.state ?? makeState({ seed: 4242 }));
  let clock = 0;
  const ticks = createTickTimings(() => clock);
  for (const ms of [1, 2, 3, 4, 20]) {
    ticks.measure(() => {
      clock += ms;
    });
  }
  const entries = over.entries ?? [entry(), entry({ level: 'error', scope: 'tick', message: 'tick failed' })];
  const onExport = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <DebugOverlay
      state={state}
      ticks={ticks}
      catchUpMs={over.catchUpMs === undefined ? 12 : over.catchUpMs}
      saveVersion={19}
      build="abc1234"
      fps={() => 60}
      log={() => entries}
      onExportDiagnostics={onExport}
      onClose={onClose}
    />,
  );
  const stat = (id: string) => view.container.querySelector(`[data-debug-stat="${id}"] [data-value]`)?.textContent ?? null;
  return { ...view, state, onExport, onClose, stat };
}

describe('DebugOverlay', () => {
  it('shows FPS, tick p50/p95, catch-up time, seed and save version', () => {
    const t = setup();
    expect(t.stat('fps')).toContain('60');
    expect(t.stat('tick-p50')).toMatch(/\d/);
    expect(t.stat('tick-p95')).toMatch(/\d/);
    expect(t.stat('catch-up')).toContain('12');
    expect(t.stat('seed')).toContain('4242');
    expect(t.stat('save-version')).toContain('19');
  });

  it('says when there was no catch-up', () => {
    const t = setup({ catchUpMs: null });
    expect(t.stat('catch-up')).not.toMatch(/\d/);
  });

  it('lists every top-level state key in the inspector, collapsed, and shows its JSON when opened', () => {
    const t = setup();
    const keys = [...t.container.querySelectorAll<HTMLElement>('[data-debug-inspector] [data-key]')].map((el) => el.dataset.key);
    expect(keys).toEqual(Object.keys(t.state.value));
    const resources = t.container.querySelector<HTMLDetailsElement>('[data-debug-inspector] [data-key="resources"]')!;
    expect(resources.open).toBe(false);
    resources.open = true;
    fireEvent(resources, new Event('toggle'));
    expect(resources.querySelector('pre')?.textContent).toContain('"food"');
  });

  it('is read-only: it offers no input and opening the inspector writes nothing', () => {
    const t = setup();
    const before = t.state.value;
    expect(t.container.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0);
    for (const d of t.container.querySelectorAll<HTMLDetailsElement>('[data-debug-inspector] details')) {
      d.open = true;
      fireEvent(d, new Event('toggle'));
    }
    expect(t.state.value).toBe(before);
  });

  it('shows the log ring buffer, newest first, with level and scope', () => {
    const t = setup();
    const lines = [...t.container.querySelectorAll<HTMLElement>('[data-debug-log] [data-log-entry]')];
    expect(lines).toHaveLength(2);
    expect(lines[0].dataset.level).toBe('error');
    expect(lines[0].textContent).toContain('tick');
    expect(lines[0].textContent).toContain('tick failed');
  });

  it('refreshes its numbers and the log while it is open', () => {
    vi.useFakeTimers();
    const entries = [entry()];
    const t = setup({ entries });
    entries.push(entry({ message: 'later' }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(t.container.querySelectorAll('[data-debug-log] [data-log-entry]')).toHaveLength(2);
  });

  it('exports diagnostics and closes', () => {
    const t = setup();
    fireEvent.click(t.container.querySelector('[data-action="export-diagnostics"]')!);
    expect(t.onExport).toHaveBeenCalledTimes(1);
    fireEvent.click(t.container.querySelector('[data-action="close-debug"]')!);
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });
});
