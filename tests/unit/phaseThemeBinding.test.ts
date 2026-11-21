/**
 * Phase theme binding (Story 1.8): a phase change rebinds the aliases by
 * changing one attribute on the root, and nothing else on it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindPhaseTheme, PHASE_TOKEN } from '../../src/ui/theme/phaseTheme';
import { gameState } from '../../src/state/gameSignal';
import { createInitialState } from '../../src/state/GameState';
import { PHASE_ORDER, Phase } from '../../src/phases/phases';

describe('bindPhaseTheme', () => {
  let root: HTMLElement;
  let dispose: () => void;

  beforeEach(() => {
    gameState.value = createInitialState();
    root = document.createElement('html');
    dispose = bindPhaseTheme(root);
  });

  afterEach(() => {
    dispose();
    gameState.value = createInitialState();
  });

  it('binds the current phase palette on mount', () => {
    expect(root.dataset.phase).toBe(PHASE_TOKEN[gameState.value.phase as Phase]);
  });

  it('changes only the data-phase attribute when the phase changes', () => {
    root.className = 'keep';
    root.setAttribute('lang', 'en');
    for (const phase of PHASE_ORDER) {
      const before = [...root.attributes].filter((a) => a.name !== 'data-phase').map((a) => `${a.name}=${a.value}`);
      gameState.value = { ...gameState.value, phase };
      expect(root.dataset.phase).toBe(PHASE_TOKEN[phase]);
      const after = [...root.attributes].filter((a) => a.name !== 'data-phase').map((a) => `${a.name}=${a.value}`);
      expect(after).toEqual(before);
      expect(root.getAttribute('style')).toBeNull();
    }
  });

  it('does not rewrite the attribute on ticks that keep the phase', () => {
    const writes: string[] = [];
    const obs = new MutationObserver((records) => records.forEach((r) => writes.push(r.attributeName ?? '')));
    obs.observe(root, { attributes: true });
    gameState.value = { ...gameState.value, stats: { ...gameState.value.stats, totalClicks: 1 } };
    gameState.value = { ...gameState.value, stats: { ...gameState.value.stats, totalClicks: 2 } };
    expect(obs.takeRecords().length + writes.length).toBe(0);
    obs.disconnect();
  });

  it('stops following the phase once disposed', () => {
    dispose();
    const bound = root.dataset.phase;
    gameState.value = { ...gameState.value, phase: PHASE_ORDER[PHASE_ORDER.length - 1] };
    expect(root.dataset.phase).toBe(bound);
    dispose = () => {};
  });
});
