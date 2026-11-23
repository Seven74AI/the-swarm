// @vitest-environment node
/**
 * Story 9.10 (FR66, UX-DR8): the resource sheet on a phone. Pure parts:
 * the rate formatter, the sparkline and the row order and groups.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatSheetRate, sparkline } from '../../../../src/utils/format';
import { sheetLayout } from '../../../../src/ui/sheets/resourceSheetLayout';
import { sheetBalance } from '../../../../src/data/balance/sheet';
import { RESOURCES, RESOURCE_BY_ID, type ResourceId } from '../../../../src/ui/shell/resourceCatalog';
import type { ResourceRow } from '../../../../src/ui/shell/resourceFeed';

describe('formatSheetRate', () => {
  it('never formats a non-zero rate as zero (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }).filter((r) => r !== 0), (r) => {
        const text = formatSheetRate(r);
        expect(text).not.toMatch(/^[+−-]?0\//);
        expect(text.startsWith(r > 0 ? '+' : '−')).toBe(true);
      }),
    );
  });

  it('reads under 1 a second per minute, whole; from 1 a second per second', () => {
    expect(formatSheetRate(0.6)).toBe('+36/M');
    expect(formatSheetRate(-0.01)).toBe('−1/M');
    expect(formatSheetRate(0.001)).toBe('+1/M');
    expect(formatSheetRate(3.7)).toBe('+3/S');
    expect(formatSheetRate(-12)).toBe('−12/S');
    expect(formatSheetRate(0)).toBe('0');
  });
});

describe('sparkline', () => {
  it('draws one cell per value, low to high, and a flat line when nothing moves', () => {
    const s = sparkline([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...s]).toHaveLength(8);
    expect(s[0]).toBe('▁');
    expect(s[s.length - 1]).toBe('█');
    expect(new Set([...sparkline([5, 5, 5])]).size).toBe(1);
    expect(sparkline([])).toBe('');
  });
});

const row = (id: ResourceId, over: Partial<ResourceRow> = {}): ResourceRow => ({ id, amount: 10, rate: 1, ratePerSec: 1, cap: null, capped: false, unlocked: true, spark: '', ...over });

describe('sheetLayout', () => {
  it('puts falling and capped resources first, the rest in catalog order', () => {
    const rows = [row('eggs'), row('larvae'), row('workers', { cap: 10, capped: true }), row('food', { rate: -2, ratePerSec: -2 })];
    const out = sheetLayout(rows);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].rows.map((r) => r.id)).toEqual(['workers', 'food', 'eggs', 'larvae']);
  });

  it(`past ${'the threshold'} rows, groups by tier, collapsed unless a group holds a falling or capped resource`, () => {
    const rows = RESOURCES.map((d) => row(d.id, d.id === 'chitin' ? { rate: -1, ratePerSec: -1 } : {}));
    expect(rows.length).toBeGreaterThan(sheetBalance.groupAfterRows);
    const out = sheetLayout(rows);
    expect(out.groups.length).toBeGreaterThan(1);
    const battle = out.groups.find((g) => g.rows.some((r) => r.id === 'chitin'))!;
    expect(battle.label).toBe('BATTLE DROPS');
    expect(battle.open).toBe(true);
    expect(battle.rows[0].id).toBe('chitin');
    for (const g of out.groups) {
      if (g !== battle) expect(g.open).toBe(g.rows.some((r) => r.capped || r.ratePerSec < 0));
      for (const r of g.rows) expect(RESOURCE_BY_ID[r.id].tier).toBe(g.tier);
    }
    expect(out.groups.flatMap((g) => g.rows)).toHaveLength(rows.length);
  });

  it('keeps one plain list up to the threshold', () => {
    const rows = RESOURCES.slice(0, sheetBalance.groupAfterRows).map((d) => row(d.id));
    const out = sheetLayout(rows);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].label).toBeNull();
    expect(out.groups[0].open).toBe(true);
  });
});
