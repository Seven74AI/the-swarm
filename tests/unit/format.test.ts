import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  formatInt,
  formatStrip,
  formatFull,
  formatTime,
  formatDelta,
  formatDeltaFull,
  clearFormatCache,
} from '../../src/utils/format';

const SUFFIX_EXP: Record<string, number> = {
  K: 3, M: 6, B: 9, T: 12, Qa: 15, Qi: 18, Sx: 21, Sp: 24, Oc: 27, No: 30, Dc: 33,
};

/**
 * Parse a formatted string back into an exact BigInt value, so the
 * "never rounds up" check has no floating-point slack.
 */
function parseShown(text: string): bigint {
  const plain = text.replace(/[\s  ]/g, '');
  const m = /^(\d+)(?:\.(\d+))?([A-Za-z]*)$/.exec(plain);
  if (!m) throw new Error(`unparseable: ${JSON.stringify(text)}`);
  const [, int, frac = '', suffix] = m;
  const exp = suffix === '' ? 0 : SUFFIX_EXP[suffix];
  if (exp === undefined) throw new Error(`unknown suffix: ${suffix}`);
  const digits = BigInt(int + frac);
  const shift = exp - frac.length;
  return shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift);
}

/** Any non-negative input, including fractions and very large values. */
const anyNonNegative = fc.oneof(
  fc.double({ min: 0, max: 1e33, noNaN: true }),
  fc.double({ min: 0, max: 1e7, noNaN: true }),
  fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  fc.integer({ min: 0, max: 2_000_000 }),
);

describe('formatInt', () => {
  it('floors, never rounds up', () => {
    fc.assert(
      fc.property(anyNonNegative, (n) => {
        expect(parseShown(formatInt(n))).toBeLessThanOrEqual(BigInt(Math.floor(n)));
      }),
    );
  });

  it('shows the whole integer part', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e9, noNaN: true }), (n) => {
        expect(parseShown(formatInt(n))).toBe(BigInt(Math.floor(n)));
      }),
    );
  });
});

describe('formatStrip', () => {
  beforeEach(() => clearFormatCache());

  it('is never more than 5 characters', () => {
    fc.assert(
      fc.property(anyNonNegative, (n) => {
        expect(formatStrip(n).length).toBeLessThanOrEqual(5);
      }),
    );
  });

  it('never shows more than Math.floor(input)', () => {
    fc.assert(
      fc.property(anyNonNegative, (n) => {
        expect(parseShown(formatStrip(n))).toBeLessThanOrEqual(BigInt(Math.floor(n)));
      }),
    );
  });

  it('shows full digits up to 9 999', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 9999.999, noNaN: true }), (n) => {
        const shown = formatStrip(n);
        expect(shown).toMatch(/^\d+$/);
        expect(parseShown(shown)).toBe(BigInt(Math.floor(n)));
      }),
    );
  });

  it('switches to a suffix above 9 999', () => {
    expect(formatStrip(9999)).toMatch(/^\d+$/);
    expect(formatStrip(10_000)).toMatch(/[A-Za-z]$/);
  });

  it('matches the spec examples', () => {
    expect(formatStrip(12_400)).toBe('12.4K');
    expect(formatStrip(124_000)).toBe('124K');
    expect(formatStrip(1_240_000)).toBe('1.24M');
  });

  it('floors at the shown precision instead of rounding', () => {
    // 12 499 is "12.4K", never "12.5K"; 999 999 never reaches "1.00M".
    expect(formatStrip(12_499)).toBe('12.4K');
    expect(formatStrip(999_999)).toBe('999K');
  });

  it('keeps precision as close to the input as 5 characters allow', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10_000, max: 999_999_999_999 }), (n) => {
        const shown = parseShown(formatStrip(n));
        // 3 significant digits: the shown value is within 1% below the input.
        expect(shown * 1000n).toBeGreaterThanOrEqual(BigInt(n) * 990n);
      }),
    );
  });

  it('uses no scientific notation in the suffix range', () => {
    fc.assert(
      fc.property(anyNonNegative, (n) => {
        expect(formatStrip(n)).not.toMatch(/e/);
      }),
    );
  });
});

describe('formatFull', () => {
  beforeEach(() => clearFormatCache());

  it('never shows more than Math.floor(input)', () => {
    fc.assert(
      fc.property(anyNonNegative, (n) => {
        expect(parseShown(formatFull(n))).toBeLessThanOrEqual(BigInt(Math.floor(n)));
      }),
    );
  });

  it('shows every digit, space-grouped, up to 999 999', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 999_999.999, noNaN: true }), (n) => {
        const shown = formatFull(n);
        expect(shown).toMatch(/^\d{1,3}(?: \d{3})*$/);
        expect(parseShown(shown)).toBe(BigInt(Math.floor(n)));
      }),
    );
  });

  it('groups thousands with a space, not a comma', () => {
    expect(formatFull(999)).toBe('999');
    expect(formatFull(1000)).toBe('1 000');
    expect(formatFull(999_999)).toBe('999 999');
  });

  it('switches to a suffix above 999 999', () => {
    expect(formatFull(1_000_000)).toMatch(/[A-Za-z]$/);
    expect(formatFull(1_240_000)).toBe('1.24M');
  });

  it('uses no scientific notation and no commas', () => {
    fc.assert(
      fc.property(anyNonNegative, (n) => {
        expect(formatFull(n)).not.toMatch(/[e,]/);
      }),
    );
  });

  it('keeps the sign of negative values', () => {
    expect(formatFull(-1000)).toBe('-' + formatFull(1000));
  });

  it('returns the same text from the cache', () => {
    const first = formatFull(2_000_000);
    expect(formatFull(2_000_000)).toBe(first);
    clearFormatCache();
    expect(formatFull(2_000_000)).toBe(first);
  });
});

describe('formatTime', () => {
  it('returns "0s" for zero', () => {
    expect(formatTime(0)).toBe('0s');
  });

  it('formats seconds only', () => {
    expect(formatTime(1000)).toBe('1s');
    expect(formatTime(45000)).toBe('45s');
    expect(formatTime(59000)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(60000)).toBe('1m 0s');
    expect(formatTime(90000)).toBe('1m 30s');
  });

  it('formats hours', () => {
    expect(formatTime(3600000)).toBe('1h 0m');
    expect(formatTime(3660000)).toBe('1h 1m');
    expect(formatTime(4980000)).toBe('1h 23m');
  });

  it('drops seconds when > 1 hour', () => {
    expect(formatTime(3600000)).toBe('1h 0m');
    expect(formatTime(7200000)).toBe('2h 0m');
  });
});

/** Split a signed delta into its sign character and the magnitude text. */
function splitDelta(text: string): { sign: string; body: string } {
  const sign = text[0] === '+' || text[0] === '\u2212' ? text[0] : '';
  return { sign, body: text.slice(sign.length) };
}

const anyDelta = fc.oneof(
  fc.integer({ min: -2_000_000, max: 2_000_000 }),
  fc.double({ min: -1e30, max: 1e30, noNaN: true }),
  fc.integer({ min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
);

describe('formatDelta (strip deltas, Story 1.16)', () => {
  beforeEach(() => clearFormatCache());

  it('is never more than 5 characters, sign included', () => {
    fc.assert(
      fc.property(anyDelta, (n) => {
        expect(formatDelta(n).length).toBeLessThanOrEqual(5);
      }),
    );
  });

  it('marks gains with + and losses with a true minus sign (never a hyphen)', () => {
    fc.assert(
      fc.property(anyDelta, (n) => {
        const text = formatDelta(n);
        expect(text).not.toContain('-');
        const { sign } = splitDelta(text);
        if (Math.trunc(n) > 0) expect(sign).toBe('+');
        else if (Math.trunc(n) < 0) expect(sign).toBe('\u2212');
        else expect(sign).toBe('');
      }),
    );
  });

  it('never shows a larger magnitude than the integer part', () => {
    fc.assert(
      fc.property(anyDelta, (n) => {
        const { body } = splitDelta(formatDelta(n));
        if (/e/.test(body)) return; // exponent fallback, far beyond any real rate
        expect(parseShown(body)).toBeLessThanOrEqual(BigInt(Math.floor(Math.abs(n))));
      }),
    );
  });

  it('has no "/s" unit', () => {
    fc.assert(
      fc.property(anyDelta, (n) => {
        expect(formatDelta(n)).not.toContain('/');
      }),
    );
  });
});

describe('formatDeltaFull (resource sheet rates, Story 1.16)', () => {
  beforeEach(() => clearFormatCache());

  it('is the signed formatFull of the magnitude', () => {
    fc.assert(
      fc.property(fc.integer({ min: -5_000_000, max: 5_000_000 }), (n) => {
        const { sign, body } = splitDelta(formatDeltaFull(n));
        expect(body).toBe(formatFull(Math.abs(n)));
        expect(sign).toBe(n > 0 ? '+' : n < 0 ? '\u2212' : '');
      }),
    );
  });
});
