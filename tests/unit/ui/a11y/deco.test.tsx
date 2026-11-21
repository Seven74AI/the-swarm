import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import '@preact/signals';
import { decorate, Abbr } from '../../../../src/ui/primitives/Deco';
import { spoken, DECORATION } from '../../helpers/a11y';

/** Story 1.32 (UX-DR40): typed decoration is visual only. */
afterEach(cleanup);

describe('decorate', () => {
  it('looks the same but never reads a separator or an arrow', () => {
    const line = 'LV.2 → 3 · 40 FOOD · you have 7';
    const { container } = render(<p>{decorate(line)}</p>);
    const p = container.querySelector('p')!;
    // Sighted players see the same characters (the hidden words are clipped, not shown).
    const visible = [...p.querySelectorAll('*')].filter((e) => e.classList.contains('visually-hidden'));
    for (const v of visible) v.remove();
    expect(p.textContent!.replace(/\s+/g, ' ')).toBe(line);
    const { container: again } = render(<p>{decorate(line)}</p>);
    const said = spoken(again.querySelector('p')!);
    expect(said).not.toMatch(DECORATION);
    expect(said).toContain('to');
    expect(said).toContain('40 FOOD');
  });

  it('passes plain strings and non-strings through', () => {
    expect(decorate('NO DECORATION')).toBe('NO DECORATION');
    expect(decorate(3)).toBe(3);
  });
});

describe('Abbr', () => {
  it('shows the short form and reads the full word', () => {
    const { container } = render(<p><Abbr shown="CHTN" full="Chitin" /></p>);
    expect(spoken(container.querySelector('p')!)).toBe('Chitin');
    expect(container.querySelector('[aria-hidden="true"]')!.textContent).toBe('CHTN');
  });
});
