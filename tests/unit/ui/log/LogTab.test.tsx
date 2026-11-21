import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { createChronicle } from '../../../../src/state/chronicle';
import { formatFull } from '../../../../src/utils/format';
import { ChronicleLog } from '../../../../src/ui/log/ChronicleLog';
import { LifetimeStats } from '../../../../src/ui/log/LifetimeStats';
import { LogSettingsEntry } from '../../../../src/ui/log/LogSettingsEntry';
import { LegacySection } from '../../../../src/ui/log/LegacySection';
import type { LineJump } from '../../../../src/ui/log/jump';
import type { PanelId } from '../../../../src/data/content/tabs';
import { makeState } from '../../helpers/makeState';

/**
 * Story 1.26 (UX-DR30, UX-DR31): LOG shows the full chronicle (newest first,
 * lines that point somewhere jump there), lifetime stats, a settings entry,
 * and LEGACY once the GDD's prestige unlock condition is met.
 */

const initial = gameState.value;
afterEach(() => {
  cleanup();
  gameState.value = initial;
});

const jumpTo = (calls: PanelId[], reachable = true): LineJump => ({
  canJump: () => reachable,
  jump: (t) => {
    calls.push(t);
  },
});

describe('ChronicleLog', () => {
  it('shows every line, newest first, the newest with `> ` and older ones with `· `', () => {
    const c = createChronicle();
    for (let i = 0; i < 12; i++) c.add(`line ${i}`);
    const { container } = render(<ChronicleLog chronicle={c} jump={jumpTo([])} />);
    const lines = [...container.querySelectorAll<HTMLElement>('[data-log-line]')];
    expect(lines.length).toBe(c.entries.value.length);
    expect(lines[0].textContent).toContain('line 11');
    expect(lines[lines.length - 1].textContent).toContain('line 0');
    expect(lines[0].dataset.newest).toBe('true');
    expect(lines[0].querySelector('[data-line-prefix]')!.textContent).toBe('> ');
    expect(lines[1].querySelector('[data-line-prefix]')!.textContent).toBe('· ');
    expect(container.querySelector('[data-chronicle]')!.getAttribute('role')).toBe('log');
  });

  it('follows the chronicle as lines arrive', () => {
    const c = createChronicle();
    c.add('first');
    const { container } = render(<ChronicleLog chronicle={c} jump={jumpTo([])} />);
    const before = container.querySelectorAll('[data-log-line]').length;
    act(() => c.add('second'));
    expect(container.querySelectorAll('[data-log-line]').length).toBeGreaterThan(before);
    expect(container.querySelector('[data-log-line]')!.textContent).toContain('second');
  });

  it('a line that points at something is a button that jumps there', () => {
    const c = createChronicle();
    c.add('plain');
    c.add('built', { target: 'building_panel' });
    const calls: PanelId[] = [];
    const { container } = render(<ChronicleLog chronicle={c} jump={jumpTo(calls)} />);
    const buttons = container.querySelectorAll<HTMLElement>('[data-jump]');
    expect(buttons.length).toBe(1);
    fireEvent.click(buttons[0]);
    expect(calls).toEqual(['building_panel']);
  });

  it('a line whose panel is out of reach is plain text', () => {
    const c = createChronicle();
    c.add('built', { target: 'building_panel' });
    const { container } = render(<ChronicleLog chronicle={c} jump={jumpTo([], false)} />);
    expect(container.querySelector('[data-jump]')).toBeNull();
    expect(container.querySelector('[data-log-line]')!.textContent).toContain('built');
  });
});

describe('LifetimeStats', () => {
  it('shows the lifetime numbers from the state', () => {
    gameState.value = makeState({
      phase: Phase.COLONY,
      stats: { totalEggsLaid: 1234, totalClicks: 56, playTimeMs: 0 },
      battlesWon: 3,
      prestige: { count: 2, totalFoodProduced: 98765 },
    });
    const { container } = render(<LifetimeStats />);
    const stat = (id: string) => container.querySelector(`[data-lifetime-stat="${id}"] [data-value]`)!.textContent;
    expect(stat('eggs')).toBe(formatFull(1234));
    expect(stat('taps')).toBe(formatFull(56));
    expect(stat('food')).toBe(formatFull(98765));
    expect(stat('battles')).toBe(formatFull(3));
    expect(stat('prestiges')).toBe(formatFull(2));
    expect(container.querySelector('[data-lifetime-stat="time"] [data-value]')).not.toBeNull();
  });
});

describe('LogSettingsEntry', () => {
  it('opens the settings screen when there is one', () => {
    let opened = 0;
    const { container } = render(<LogSettingsEntry onOpenSettings={() => opened++} />);
    const btn = container.querySelector<HTMLElement>('[data-action="settings"]')!;
    expect(btn.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.pointerDown(btn);
    fireEvent.pointerUp(btn);
    fireEvent.click(btn);
    expect(opened).toBeGreaterThan(0);
  });

  it('is shown but disabled until the settings screen exists', () => {
    const { container } = render(<LogSettingsEntry />);
    expect(container.querySelector('[data-action="settings"]')!.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('LegacySection', () => {
  const panel = () => {
    const el = document.createElement('div');
    el.id = 'prestige-panel';
    return el;
  };
  const met = {
    buildings: { barracks: { level: 5, count: 0 }, walls: { level: 5 }, warehouse: { level: 5 } },
    prestige: { totalFoodProduced: 100_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
  };

  it('hosts the legacy panels, hidden until the prestige unlock condition is met', () => {
    gameState.value = makeState({ phase: Phase.SPACE });
    const p = panel();
    const { container } = render(<LegacySection panels={[p]} />);
    const section = container.querySelector<HTMLElement>('[data-log-section="legacy"]')!;
    expect(section.contains(p)).toBe(true);
    expect(section.hidden).toBe(true);
    act(() => {
      gameState.value = makeState({ phase: Phase.SPACE, ...met });
    });
    expect(section.hidden).toBe(false);
  });

  it('stays for the runs after a prestige, and after the ending', () => {
    gameState.value = makeState({ phase: Phase.COLONY, prestige: { count: 1 } });
    const { container } = render(<LegacySection panels={[panel()]} />);
    expect(container.querySelector<HTMLElement>('[data-log-section="legacy"]')!.hidden).toBe(false);
    cleanup();
    gameState.value = makeState({ phase: Phase.TRANSCENDENCE, victoryAchieved: true });
    const second = render(<LegacySection panels={[panel()]} />);
    expect(second.container.querySelector<HTMLElement>('[data-log-section="legacy"]')!.hidden).toBe(false);
  });
});
