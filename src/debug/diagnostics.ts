/**
 * Export diagnostics (Story 1.27; UX-DR32, architecture → Logging).
 *
 * One JSON file a player can attach to a bug report: the log ring buffer, the
 * state as the save serializes it (so the seed comes along once the state has
 * one), the settings, the device capabilities and the build. It is built and
 * downloaded on the device; nothing is sent anywhere (NFR10).
 *
 * Only main imports debug/ (tests/arch/architecture.test.ts). The debug
 * overlay (Story 1.34) offers the same export, and the seed is named at the top.
 */
import type { LogEntry } from '../utils/log';

export const DIAGNOSTICS_FILENAME = 'the-swarm-diagnostics.json';

export interface DiagnosticsInput {
  /** Build identifier (a commit hash, or `dev`). */
  readonly build: string;
  /** Epoch ms of the export. */
  readonly now: number;
  readonly userAgent: string;
  /** The save text (`SaveManager.serialize`). */
  readonly save: string;
  /** The game's seed (Story 1.34), also inside the save; repeated at the top for bug reports. */
  readonly seed?: number;
  readonly settings: unknown;
  readonly capabilities: unknown;
  readonly log: readonly LogEntry[];
}

/** A log detail in a form JSON keeps: Errors by name, message and stack; anything unserializable as text. */
function plainDetail(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  try {
    JSON.stringify(value);
    return value === undefined ? null : value;
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

function parseOrText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function buildDiagnostics(input: DiagnosticsInput): string {
  return JSON.stringify(
    {
      build: input.build,
      exportedAt: new Date(input.now).toISOString(),
      userAgent: input.userAgent,
      seed: input.seed ?? null,
      settings: input.settings,
      capabilities: input.capabilities,
      log: input.log.map((e) => ({ ...e, detail: e.detail.map(plainDetail) })),
      save: parseOrText(input.save),
    },
    null,
    2,
  );
}
