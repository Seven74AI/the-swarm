import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState } from '../../../../src/state/GameState';
import { Transcendence } from '../../../../src/ui/endgame/Transcendence';
import { formatFull } from '../../../../src/utils/format';

/**
 * Story 1.36: the Transcendence status on NEST, a Preact view replacing the
 * legacy TranscendencePanel (Epic 7 builds the real ending).
 */
describe('Transcendence', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });
  afterEach(() => cleanup());

  const set = (patch: Partial<ReturnType<typeof createInitialState>>) =>
    act(() => {
      gameState.value = { ...gameState.value, ...patch };
    });

  it('names itself and says the stars are still out of reach before victory', () => {
    const c = render(<Transcendence />).container;
    expect(c.textContent).toContain('Transcendence');
    expect(c.textContent).toContain('THE STARS ARE STILL OUT OF REACH');
    expect(c.textContent).not.toContain('THE SWARM TRANSCENDS');
  });

  it('says the swarm transcends once victory is achieved', () => {
    const c = render(<Transcendence />).container;
    set({ victoryAchieved: true });
    expect(c.textContent).toContain('THE SWARM TRANSCENDS.');
  });

  it('shows the legacy stats, following the prestige data', () => {
    const c = render(<Transcendence />).container;
    expect(c.textContent).toContain('Legacy Stats');
    for (const label of ['Prestige Count', 'Legacy Points', 'Lifetime Food']) expect(c.textContent).toContain(label);
    const prestige = { ...gameState.value.prestige, count: 3, legacyPoints: 12345, totalFoodProduced: 98765 };
    set({ prestige });
    const value = (label: string) =>
      [...c.querySelectorAll('.stat-row')].find((r) => r.textContent?.includes(label))?.querySelector('.stat-value')?.textContent;
    expect(value('Prestige Count')).toBe('3');
    expect(value('Legacy Points')).toBe(formatFull(12345));
    expect(value('Lifetime Food')).toBe(formatFull(98765));
  });
});
