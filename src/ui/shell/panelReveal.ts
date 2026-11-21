import { createContext } from 'preact';
import { signal, type ReadonlySignal } from '@preact/signals-core';
import type { PanelId } from '../../data/content/tabs';

/** Each panel a phase reveals starts its reveal animation this much after the one before (Story 1.20's cascade). */
export const REVEAL_STAGGER_MS = 150;

/**
 * Which panels the session has revealed (Story 1.36, replacing UIRoot's lazy
 * `createPanel` and `showPanel`). A panel is not in the DOM until its phase
 * reveals it, then it stays for the session: a prestige never takes it away.
 * UI state only, never saved.
 */
export interface PanelReveal {
  readonly revealed: ReadonlySignal<ReadonlySet<PanelId>>;
  /**
   * Reveal these panels, in order. Every one is announced, revealed before or not. Newly
   * revealed ones cascade in, `REVEAL_STAGGER_MS` apart by their place in `ids` (the phase's panels).
   */
  reveal(ids: readonly PanelId[]): void;
  /** The reveal animation's delay for a panel, from its place in the reveal that showed it. */
  delayOf(id: PanelId): number;
}

export function createPanelReveal({ onReveal }: { onReveal?: (id: PanelId) => void } = {}): PanelReveal {
  const revealed = signal<ReadonlySet<PanelId>>(new Set());
  const delays = new Map<PanelId, number>();
  return {
    revealed,
    reveal(ids) {
      const next = new Set(revealed.peek());
      ids.forEach((id, i) => {
        if (next.has(id)) return;
        delays.set(id, i * REVEAL_STAGGER_MS);
        next.add(id);
      });
      if (next.size !== revealed.peek().size) revealed.value = next;
      for (const id of ids) onReveal?.(id);
    },
    delayOf: (id) => delays.get(id) ?? 0,
  };
}

/** The session's panel reveal, provided by App. Without one, every panel shows (unit tests, harness pages). */
export const PanelRevealContext = createContext<PanelReveal | null>(null);
