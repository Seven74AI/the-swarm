import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import { Card, CARD_HIGHLIGHT_MS } from '../../../../src/ui/primitives/Card';
import { formatFull } from '../../../../src/utils/format';

/** Story 1.12 (UX-DR17). */
describe('Card', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const action = (onClick: () => void) => (
    <button type="button" data-action="buy" onClick={onClick}>
      BUY
    </button>
  );

  it('makes only its action tappable', () => {
    const onClick = vi.fn();
    const { container, getByText } = render(
      <Card title="NURSERY" effect="+1 larva slot" cost="40 FOOD" affordable action={action(onClick)} />,
    );
    const root = container.querySelector('[data-card]')!;
    expect(root.tagName).not.toBe('BUTTON');
    expect(root.getAttribute('role')).toBeNull();
    expect(root.hasAttribute('tabindex')).toBe(false);
    fireEvent.click(getByText('NURSERY'));
    fireEvent.click(getByText('+1 larva slot'));
    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelectorAll('button, [role="button"], a, [tabindex]')).toHaveLength(1);
    fireEvent.click(getByText('BUY'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the shortfall of an unaffordable card, marked as warn', () => {
    const { container } = render(
      <Card title="NURSERY" cost="40 FOOD" affordable={false} shortfall={{ amount: 1234, glyph: '△' }} action={action(() => {})} />,
    );
    const short = container.querySelector('[data-shortfall]')!;
    expect(short).not.toBeNull();
    expect(short.textContent).toContain(`needs ${formatFull(1234)} more`);
    expect(short.textContent).toContain('△');
  });

  it('shows no shortfall once affordable', () => {
    const { container } = render(
      <Card title="NURSERY" cost="40 FOOD" affordable shortfall={{ amount: 5 }} action={action(() => {})} />,
    );
    expect(container.querySelector('[data-shortfall]')).toBeNull();
  });

  it('highlights for 2 s the first time it becomes affordable, and only then', () => {
    expect(CARD_HIGHLIGHT_MS).toBe(2000);
    const view = (affordable: boolean) => (
      <Card title="NURSERY" affordable={affordable} shortfall={{ amount: 3 }} action={action(() => {})} />
    );
    const { container, rerender } = render(view(false));
    const card = () => container.querySelector('[data-card]')!;
    expect(card().hasAttribute('data-highlight')).toBe(false);
    rerender(view(true));
    expect(card().hasAttribute('data-highlight')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(CARD_HIGHLIGHT_MS);
    });
    expect(card().hasAttribute('data-highlight')).toBe(false);
    rerender(view(false));
    rerender(view(true));
    expect(card().hasAttribute('data-highlight')).toBe(false);
  });

  it('does not highlight a card that is already affordable when it first renders', () => {
    const { container } = render(<Card title="NURSERY" affordable action={action(() => {})} />);
    expect(container.querySelector('[data-card]')!.hasAttribute('data-highlight')).toBe(false);
  });
});
