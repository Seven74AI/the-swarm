/**
 * Phase theme binding (Story 1.8, UX-DR1).
 *
 * `ui/styles/tokens.css` binds the runtime color aliases (`--color-accent`, …)
 * per phase on `:root[data-phase="<token>"]`. Entering a phase changes that one
 * attribute and nothing else, so components (which reference only aliases)
 * repaint from one token set. A phase's palette lives only in its own block,
 * so no later phase color is reachable before that phase is entered.
 */
import { effect } from '@preact/signals-core';
import { Phase } from '../../phases/phases';
import { selectPhase } from '../../state/selectors';

/** Palette name in DESIGN.md (`colors.<token>-<key>`) for each phase. */
export const PHASE_TOKEN: Readonly<Record<Phase, string>> = {
  [Phase.EGG_LAYING]: 'egg',
  [Phase.COLONY]: 'colony',
  [Phase.COMBAT]: 'combat',
  [Phase.EXPANSION]: 'expansion',
  [Phase.SPACE]: 'space',
  [Phase.TRANSCENDENCE]: 'transcendence',
};

/** The 7 values of every phase palette. */
export const PALETTE_KEYS = ['bg', 'raised', 'line', 'edge', 'dim', 'accent', 'warn'] as const;

/** The runtime aliases a phase binds; `on-accent` is the phase `bg`. */
export const ALIAS_PROPERTIES: readonly string[] = [
  ...PALETTE_KEYS.map((k) => `--color-${k}`),
  '--color-on-accent',
];

/**
 * Keep `root`'s `data-phase` attribute on the current phase's palette.
 * Reacts to the phase slice only (not every tick). Returns a disposer.
 */
export function bindPhaseTheme(root: HTMLElement): () => void {
  return effect(() => {
    const token = PHASE_TOKEN[selectPhase.value as Phase] ?? PHASE_TOKEN[Phase.EGG_LAYING];
    if (root.dataset.phase !== token) root.dataset.phase = token;
  });
}
