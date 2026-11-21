import { describe, it, expect } from 'vitest';
import { signal } from '@preact/signals-core';
import { Phase } from '../../../../src/phases/phases';
import { createTabShell } from '../../../../src/ui/shell/tabShell';

function setup(phase: Phase = Phase.COLONY, affordable = '') {
  const ph = signal(phase);
  const aff = signal(affordable);
  const shell = createTabShell({ phase: ph, affordable: aff });
  return { ph, aff, shell };
}

describe('tab shell (Story 1.15)', () => {
  it('opens on NEST and hides the bar in Phase 1', () => {
    const { shell } = setup(Phase.EGG_LAYING);
    expect(shell.active.value).toBe('nest');
    expect(shell.showBar.value).toBe(false);
    expect(shell.tabs.value).toEqual(['nest']);
  });

  it('shows the bar once Colony is entered', () => {
    const { ph, shell } = setup(Phase.EGG_LAYING);
    ph.value = Phase.COLONY;
    expect(shell.showBar.value).toBe(true);
    expect(shell.tabs.value).toContain('wrkr');
  });

  it('switches tabs; tapping the active tab asks to scroll to top instead', () => {
    const { shell } = setup();
    expect(shell.select('wrkr')).toBe('switched');
    expect(shell.active.value).toBe('wrkr');
    expect(shell.select('wrkr')).toBe('top');
    expect(shell.active.value).toBe('wrkr');
  });

  it('ignores a tab the phase has not revealed', () => {
    const { shell } = setup(Phase.COLONY);
    shell.select('front');
    expect(shell.active.value).toBe('nest');
  });

  it('falls back to NEST when the active tab disappears (prestige back to Phase 1)', () => {
    const { ph, shell } = setup(Phase.COMBAT);
    shell.select('front');
    ph.value = Phase.EGG_LAYING;
    expect(shell.active.value).toBe('nest');
  });

  it('keeps each tab scroll position for the session', () => {
    const { shell } = setup();
    shell.rememberScroll('wrkr', 120);
    shell.rememberScroll('nest', 30);
    expect(shell.scrollOf('wrkr')).toBe(120);
    expect(shell.scrollOf('nest')).toBe(30);
    expect(shell.scrollOf('log')).toBe(0);
  });

  it('FRONT opens on the newest segment and remembers the chosen one', () => {
    const { ph, shell } = setup(Phase.COMBAT);
    expect(shell.segments.value).toEqual(['war']);
    expect(shell.segment.value).toBe('war');

    ph.value = Phase.EXPANSION;
    expect(shell.segment.value).toBe('map');

    shell.selectSegment('war');
    expect(shell.segment.value).toBe('war');

    ph.value = Phase.SPACE;
    expect(shell.segment.value).toBe('stars');
  });

  describe('the • dot', () => {
    it('shows no dot at start, even when things are affordable', () => {
      const { shell } = setup(Phase.SPACE, 'building_panel:warehouse');
      expect(shell.dots.value.size).toBe(0);
    });

    it('marks a tab when something on it became affordable while away, and clears on visit', () => {
      const { aff, shell } = setup(Phase.SPACE);
      aff.value = 'building_panel:warehouse';
      expect(shell.dots.value.has('build')).toBe(true);
      expect(shell.dots.value.has('front')).toBe(false);

      shell.select('build');
      expect(shell.dots.value.has('build')).toBe(false);
    });

    it('never marks the active tab', () => {
      const { aff, shell } = setup(Phase.SPACE);
      shell.select('build');
      aff.value = 'building_panel:warehouse';
      expect(shell.dots.value.has('build')).toBe(false);
    });

    it('stays until visited, even if the item drops out of reach again', () => {
      const { aff, shell } = setup(Phase.SPACE);
      aff.value = 'mutation_panel:x';
      aff.value = '';
      expect(shell.dots.value.has('front')).toBe(true);
    });

    it('marks again when an item becomes affordable again after the visit', () => {
      const { aff, shell } = setup(Phase.SPACE);
      aff.value = 'mutation_panel:x';
      shell.select('front');
      shell.select('nest');
      expect(shell.dots.value.has('front')).toBe(false);
      aff.value = '';
      aff.value = 'mutation_panel:x';
      expect(shell.dots.value.has('front')).toBe(true);
    });

    it('ignores items on panels or tabs the phase has not revealed', () => {
      const { aff, shell } = setup(Phase.COLONY);
      aff.value = 'mutation_panel:x|building_panel:warehouse';
      expect(shell.dots.value.size).toBe(0);
    });
  });
});
