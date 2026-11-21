import { useEffect, useState } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals';
import type { GameState } from '../state/GameState';
import type { LogEntry } from '../utils/log';
import { Button } from '../ui/primitives/Button';
import type { TickTimings } from './timings';
import './debug.css';

/**
 * The debug overlay (Story 1.34, AR24): FPS, tick time p50/p95, catch-up
 * time, seed, save version and build; a read-only state inspector (each
 * top-level key collapses); the log ring buffer, newest first; EXPORT
 * DIAGNOSTICS (the same file as settings). It refreshes every REFRESH_MS
 * while open and reads the state with `peek()`, so it never re-renders per
 * tick and never writes anything.
 *
 * Hooks: `[data-debug-overlay]`, `[data-debug-stat=fps|tick-p50|tick-p95|catch-up|seed|save-version|build] [data-value]`,
 * `[data-debug-inspector] details[data-key]`, `[data-debug-log] [data-log-entry][data-level]`,
 * `[data-action="export-diagnostics"|"close-debug"]`.
 */

export const REFRESH_MS = 500;

export interface DebugOverlayProps {
  readonly state: ReadonlySignal<GameState>;
  readonly ticks: Pick<TickTimings, 'summary'>;
  /** How long resume-on-load took, or null when there was nothing to catch up. */
  readonly catchUpMs: number | null;
  readonly saveVersion: number;
  readonly build: string;
  /** Frames in the last second, or null while still measuring. */
  readonly fps: () => number | null;
  /** The log ring buffer (`log.entries()`), oldest first. */
  readonly log: () => readonly LogEntry[];
  readonly onExportDiagnostics: () => void;
  readonly onClose: () => void;
}

const ms = (v: number | null): string => (v === null ? 'NONE' : `${v.toFixed(2)} MS`);

function clock(time: number): string {
  const d = new Date(time);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div class="debug-overlay__stat" data-debug-stat={id}>
      <dt>{label}</dt>
      <dd data-value>{value}</dd>
    </div>
  );
}

export function DebugOverlay(props: DebugOverlayProps) {
  const [, setFrame] = useState(0);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const id = setInterval(() => setFrame((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const state = props.state.peek();
  const ticks = props.ticks.summary();
  const fps = props.fps();
  const entries = [...props.log()].reverse();
  const toggle = (key: string, isOpen: boolean): void => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <section class="debug-overlay" data-debug-overlay role="dialog" aria-label="Debug overlay">
      <header class="debug-overlay__head">
        <h2 class="debug-overlay__title">DEBUG</h2>
        <Button verb="CLOSE" data-action="close-debug" onPress={props.onClose} />
      </header>
      <dl class="debug-overlay__stats">
        <Stat id="fps" label="FPS" value={fps === null ? 'MEASURING' : String(fps)} />
        <Stat id="tick-p50" label="TICK P50" value={ms(ticks.p50)} />
        <Stat id="tick-p95" label="TICK P95" value={ms(ticks.p95)} />
        <Stat id="catch-up" label="CATCH-UP" value={props.catchUpMs === null ? 'NONE' : `${props.catchUpMs} MS`} />
        <Stat id="seed" label="SEED" value={String(state.seed)} />
        <Stat id="save-version" label="SAVE VERSION" value={String(props.saveVersion)} />
        <Stat id="build" label="BUILD" value={props.build} />
      </dl>
      <Button verb="EXPORT DIAGNOSTICS" data-action="export-diagnostics" onPress={props.onExportDiagnostics} />
      <h3 class="debug-overlay__subtitle">STATE</h3>
      <div class="debug-overlay__inspector" data-debug-inspector>
        {Object.entries(state).map(([key, value]) => (
          <details
            key={key}
            data-key={key}
            open={open.has(key)}
            onToggle={(e) => toggle(key, (e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>{key}</summary>
            {open.has(key) && <pre>{JSON.stringify(value, null, 2)}</pre>}
          </details>
        ))}
      </div>
      <h3 class="debug-overlay__subtitle">LOG</h3>
      <ol class="debug-overlay__log" data-debug-log>
        {entries.map((e, i) => (
          <li key={`${e.time}-${i}`} data-log-entry data-level={e.level}>
            {`${clock(e.time)} ${e.level.toUpperCase()} [${e.scope}] ${e.message}`}
          </li>
        ))}
      </ol>
    </section>
  );
}
