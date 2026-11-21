/**
 * The single logger for THE SWARM (architecture AR17).
 *
 * This is the only module allowed to call `console.*` (oxlint `no-console`).
 * Every entry is prefixed `[scope]` and kept in an in-memory ring buffer of the
 * last LOG_BUFFER_SIZE entries, for "Export diagnostics".
 *
 * Printing rules:
 * - error, warn: always.
 * - info: dev builds, or any build opened with `?debug=1`.
 * - debug: dev builds only.
 *
 * Never log per tick or per frame.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly detail: readonly unknown[];
  /** Epoch milliseconds. */
  readonly time: number;
}

export const LOG_BUFFER_SIZE = 200;

type Sink = Record<LogLevel, (...args: unknown[]) => void>;

export interface LoggerOptions {
  /** True in dev builds (`import.meta.env.DEV`). */
  dev: boolean;
  /** Whether `?debug=1` is set. Read on every call; defaults to the page URL. */
  debugParam?: () => boolean;
  /** Where printed entries go. Defaults to the global console. */
  sink?: Sink;
}

export interface Logger {
  error(scope: string, message: string, ...detail: unknown[]): void;
  warn(scope: string, message: string, ...detail: unknown[]): void;
  info(scope: string, message: string, ...detail: unknown[]): void;
  debug(scope: string, message: string, ...detail: unknown[]): void;
  /** A copy of the ring buffer, oldest first. */
  entries(): LogEntry[];
  clear(): void;
}

function urlHasDebugParam(): boolean {
  try {
    const search = globalThis.location?.search ?? '';
    return new URLSearchParams(search).get('debug') === '1';
  } catch {
    return false;
  }
}

const consoleSink: Sink = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args),
  debug: (...args) => console.debug(...args),
};

export function createLogger(options: LoggerOptions): Logger {
  const { dev } = options;
  const debugParam = options.debugParam ?? urlHasDebugParam;
  const sink = options.sink ?? consoleSink;
  const buffer: LogEntry[] = [];

  function shouldPrint(level: LogLevel): boolean {
    switch (level) {
      case 'error':
      case 'warn':
        return true;
      case 'info':
        return dev || debugParam();
      case 'debug':
        return dev;
    }
  }

  function write(level: LogLevel, scope: string, message: string, detail: unknown[]): void {
    buffer.push({ level, scope, message, detail, time: Date.now() });
    if (buffer.length > LOG_BUFFER_SIZE) buffer.splice(0, buffer.length - LOG_BUFFER_SIZE);
    if (!shouldPrint(level)) return;
    try {
      sink[level](`[${scope}] ${message}`, ...detail);
    } catch {
      // A broken console must never take the game down.
    }
  }

  return {
    error: (scope, message, ...detail) => write('error', scope, message, detail),
    warn: (scope, message, ...detail) => write('warn', scope, message, detail),
    info: (scope, message, ...detail) => write('info', scope, message, detail),
    debug: (scope, message, ...detail) => write('debug', scope, message, detail),
    entries: () => buffer.slice(),
    clear: () => {
      buffer.length = 0;
    },
  };
}

/** The shared logger. Import this everywhere: `import { log } from '../utils/log'`. */
export const log: Logger = createLogger({ dev: import.meta.env.DEV });
