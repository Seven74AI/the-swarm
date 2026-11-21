import { computed, signal, type ReadonlySignal } from '@preact/signals-core';

/**
 * The polite announcer (Story 1.32, UX-DR40): one line at a time for screen
 * readers, drawn by `LiveRegion`. Each `announce` gets a new id, so the same
 * line said twice is read twice. Only key changes are announced (see
 * `announcements.ts`); resource values never are. Lines are added, never
 * rewritten, so assistive tech reads each new one once.
 */
export interface Announcement {
  readonly id: number;
  readonly text: string;
}

/** The live region keeps this many recent lines, so two lines said at once are both read. */
export const ANNOUNCER_LINES = 3;

export interface Announcer {
  /** The newest line. */
  readonly current: ReadonlySignal<Announcement | null>;
  /** The newest `ANNOUNCER_LINES` lines, oldest first (what the region holds). */
  readonly lines: ReadonlySignal<readonly Announcement[]>;
  announce(text: string): void;
}

export function createAnnouncer(): Announcer {
  const lines = signal<readonly Announcement[]>([]);
  const current = computed(() => lines.value.at(-1) ?? null);
  let nextId = 1;
  return {
    current,
    lines,
    announce(text) {
      const line = text.trim();
      if (line) lines.value = [...lines.value, { id: nextId++, text: line }].slice(-ANNOUNCER_LINES);
    },
  };
}
