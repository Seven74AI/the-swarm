import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { TypeIn, typeInMs } from '../../../../src/ui/primitives/TypeIn';
import { feelBalance } from '../../../../src/data/balance/feel';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Story 8.9 (UX-DR37): a headline types in, one character at a time; the whole text is always there to read. */

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/ui/primitives/TypeIn.css'), 'utf8');

describe('TypeIn', () => {
  afterEach(cleanup);

  it('keeps the whole text in the DOM (assistive tech reads it at once) and steps once per character', () => {
    const el = render(<TypeIn text="VICTORY" />).container.querySelector<HTMLElement>('[data-type-in]')!;
    expect(el.textContent).toBe('VICTORY');
    expect(el.style.getPropertyValue('--type-in-chars')).toBe(String('VICTORY'.length));
    expect(el.style.getPropertyValue('--type-in-ms')).toBe(`${typeInMs('VICTORY')}ms`);
  });

  it('draws given children (decorated text) but steps by the plain text', () => {
    const el = render(
      <TypeIn text="A · B">
        <b>A</b>
      </TypeIn>,
    ).container.querySelector<HTMLElement>('[data-type-in]')!;
    expect(el.querySelector('b')).not.toBeNull();
    expect(el.style.getPropertyValue('--type-in-chars')).toBe('5');
  });

  it('takes longer for longer text, but never longer than the cap', () => {
    expect(typeInMs('AB')).toBeLessThan(typeInMs('ABCDEFGH'));
    expect(typeInMs('X'.repeat(500))).toBeLessThanOrEqual(feelBalance.typeInMaxMs);
  });

  it('animates in CSS, and not at all under reduced motion', () => {
    expect(css).toMatch(/\.type-in\s*\{[^}]*animation:[^}]*steps\(var\(--type-in-chars/);
    expect(css).toMatch(/:root\[data-reduced-motion="true"\] \.type-in\s*\{[^}]*animation:\s*none/);
  });
});
