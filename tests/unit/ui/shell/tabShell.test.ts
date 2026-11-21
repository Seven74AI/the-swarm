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
      aff.value = 'mutation_panel:x|research_panel:voidCrystalSynthesis';
      expect(shell.dots.value.size).toBe(0);
    });
  });
});

describe('tab shell: the latched goal (Story 1.19)', () => {
  function withGoal(met = false) {
    const goalMet = signal(met);
    const shell = createTabShell({ phase: signal(Phase.COLONY), affordable: signal(''), goalMet });
    return { goalMet, shell };
  }

  it('NEST gets • while the goal is met and NEST is not open', () => {
    const { goalMet, shell } = withGoal();
    shell.select('wrkr');
    expect(shell.dots.value.has('nest')).toBe(false);
    goalMet.value = true;
    expect(shell.dots.value.has('nest')).toBe(true);
  });

  it('the dot goes away on NEST and after the commit', () => {
    const { goalMet, shell } = withGoal(true);
    shell.select('wrkr');
    expect(shell.dots.value.has('nest')).toBe(true);
    shell.select('nest');
    expect(shell.dots.value.has('nest')).toBe(false);
    shell.select('wrkr');
    goalMet.value = false;
    expect(shell.dots.value.has('nest')).toBe(false);
  });

  it('exposes goalMet (false when not wired)', () => {
    expect(withGoal(true).shell.goalMet.value).toBe(true);
    expect(setup().shell.goalMet.value).toBe(false);
  });
});

describe('tab shell: desktop columns (Story 1.29)', () => {
  function wideSetup(phase: Phase = Phase.COLONY, isWide = true) {
    const ph = signal(phase);
    const aff = signal('');
    const goalMet = signal(false);
    const wide = signal(isWide);
    const shell = createTabShell({ phase: ph, affordable: aff, goalMet, wide });
    return { ph, aff, goalMet, wide, shell };
  }

  it('uses columns only on a wide viewport and once there is more than NEST', () => {
    expect(wideSetup(Phase.COLONY, true).shell.columns.value).toBe(true);
    expect(wideSetup(Phase.COLONY, false).shell.columns.value).toBe(false);
    expect(wideSetup(Phase.EGG_LAYING, true).shell.columns.value).toBe(false);
    expect(setup().shell.columns.value).toBe(false);
  });

  it('columns 2–3 show BUILD on the first visit, beside NEST', () => {
    const { shell } = wideSetup();
    expect(shell.columnTab.value).toBe('build');
    expect(shell.visible.value).toEqual(['nest', 'build']);
  });

  it('picking a tab fills columns 2–3 with it; picking NEST leaves them on the last tab', () => {
    const { shell } = wideSetup();
    shell.select('wrkr');
    expect(shell.columnTab.value).toBe('wrkr');
    expect(shell.select('nest')).toBe('switched');
    expect(shell.active.value).toBe('nest');
    expect(shell.columnTab.value).toBe('wrkr');
    expect(shell.visible.value).toEqual(['nest', 'wrkr']);
  });

  it('a phone shows only the active tab, and remembers the last tab for a wider window', () => {
    const { shell, wide } = wideSetup(Phase.COLONY, false);
    expect(shell.visible.value).toEqual(['nest']);
    shell.select('log');
    shell.select('nest');
    expect(shell.visible.value).toEqual(['nest']);
    wide.value = true;
    expect(shell.visible.value).toEqual(['nest', 'log']);
  });

  it('falls back to BUILD when the column tab disappears', () => {
    const { shell, ph } = wideSetup(Phase.COMBAT);
    shell.select('front');
    ph.value = Phase.COLONY;
    expect(shell.columnTab.value).toBe('build');
  });

  it('never marks a tab that is on screen with •', () => {
    const { shell, aff, goalMet } = wideSetup(Phase.SPACE);
    shell.select('nest');
    aff.value = 'building_panel:warehouse|mutation_panel:x';
    // BUILD is on screen in columns 2–3 even while NEST is picked.
    expect(shell.dots.value.has('build')).toBe(false);
    expect(shell.dots.value.has('front')).toBe(true);
    shell.select('wrkr');
    goalMet.value = true;
    // NEST stays in column 1, so a met goal needs no dot there.
    expect(shell.dots.value.has('nest')).toBe(false);
  });
});
