import { describe, it, expect, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bindTips } from '../../../../src/ui/shell/tips';

/**
 * Story 1.30 (UX-DR41, WCAG 1.4.13): what hover shows on a `[data-tooltip]`
 * element, a tap shows too; the bubble stays while the pointer is on it, and
 * Esc dismisses it without moving the pointer or focus.
 */

let unbind = () => {};
afterEach(() => {
  unbind();
  document.body.replaceChildren();
});

function setup() {
  unbind = bindTips(document);
  const a = document.createElement('div');
  a.setAttribute('data-tooltip', 'Each Dig worker adds capacity.');
  const b = document.createElement('div');
  b.setAttribute('data-tooltip', 'Another tip.');
  const inner = document.createElement('span');
  a.appendChild(inner);
  document.body.append(a, b);
  return { a, b, inner };
}

describe('tips (Story 1.30, WCAG 1.4.13)', () => {
  it('a tap opens the tip a hover shows; a second tap closes it', () => {
    const { a, inner } = setup();
    fireEvent.click(inner);
    expect(a.hasAttribute('data-tip-open')).toBe(true);
    fireEvent.click(inner);
    expect(a.hasAttribute('data-tip-open')).toBe(false);
  });

  it('one tip open at a time; a tap elsewhere closes it', () => {
    const { a, b } = setup();
    fireEvent.click(a);
    fireEvent.click(b);
    expect(a.hasAttribute('data-tip-open')).toBe(false);
    expect(b.hasAttribute('data-tip-open')).toBe(true);
    fireEvent.click(document.body);
    expect(b.hasAttribute('data-tip-open')).toBe(false);
  });

  it('Esc dismisses an open tip, and consumes the key (no sheet closes behind it)', () => {
    const { a } = setup();
    fireEvent.click(a);
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    expect(a.hasAttribute('data-tip-open')).toBe(false);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('Esc hides a hovered or focused tip until the pointer or focus leaves', () => {
    const { a } = setup();
    fireEvent.pointerOver(a);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(a.hasAttribute('data-tip-dismissed')).toBe(true);
    fireEvent.pointerLeave(a);
    expect(a.hasAttribute('data-tip-dismissed')).toBe(false);
  });

  it('Esc with no tip showing is left alone', () => {
    setup();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('the CSS keeps the bubble hoverable and shows it for a tap as for a hover', () => {
    const css = readFileSync(resolve(__dirname, '../../../../src/main.css'), 'utf8');
    const rule = css.slice(css.indexOf('[data-tooltip]::after {'), css.indexOf('}', css.indexOf('[data-tooltip]::after {')));
    expect(rule).not.toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/\[data-tooltip\]\[data-tip-open\]::after/);
    expect(css).toMatch(/\[data-tooltip\]\[data-tip-dismissed\]::after/);
    // Hover-only display is limited to devices that hover; a touch tap uses data-tip-open.
    expect(css).toMatch(/@media \(hover: hover\)[^{]*\{[^}]*\[data-tooltip\]:hover::after/);
  });
});
