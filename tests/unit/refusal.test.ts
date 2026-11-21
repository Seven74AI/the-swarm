import { describe, expect, it } from 'vitest';
import { REFUSAL_REASONS } from '../../src/actions';
import { REFUSAL_TEXT, explain } from '../../src/ui/panels/refusal';

describe('refusals are explained on the control (Story 1.6)', () => {
  it('has words for every refusal reason', () => {
    for (const reason of REFUSAL_REASONS) expect(REFUSAL_TEXT[reason]?.length ?? 0).toBeGreaterThan(0);
  });

  it('marks a refused control with the reason and clears it on success', () => {
    const btn = document.createElement('button');
    explain(btn, { ok: false, reason: 'cannot_afford' });
    expect(btn.getAttribute('data-refusal')).toBe('cannot_afford');
    expect(btn.title).toBe(REFUSAL_TEXT.cannot_afford);
    expect(btn.classList.contains('action-refused')).toBe(true);

    explain(btn, { ok: true });
    expect(btn.hasAttribute('data-refusal')).toBe(false);
    expect(btn.classList.contains('action-refused')).toBe(false);
  });

  it('passes the result through and tolerates a missing element', () => {
    const r = { ok: false as const, reason: 'locked' as const };
    expect(explain(null, r)).toBe(r);
  });
});
